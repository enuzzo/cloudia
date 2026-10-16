import { DataTexture, DataUtils, Vector4, Data3DTexture, LinearFilter, MeshBasicNodeMaterial, NoColorSpace, QuadMesh,
  RGBAFormat, RGFormat, RedFormat, NearestFilter, RepeatWrapping, ClampToEdgeWrapping, UnsignedByteType, HalfFloatType, Storage3DTexture, Vector2, Vector3, type Node, WebGPURenderer } from 'three/webgpu';
import { Fn, instanceIndex, vec3, wgsl, wgslFn, storageTexture3D, textureStore, texture3D, texture, uniform, uv } from 'three/tsl';
import {WeatherState,WEATHER_SCENES,type AtmosphereIntent,type WeatherScene} from './weatherState';
import {solarDirection} from './sun';
import {interpolateSolarDirection} from './solarTransition';
import {OrbitView,probeApproach,comparisonSurfaceDistance,comparisonCameraTarget,type ApproachProbe} from './camera';
import {precipitationFootprint,precipitationSourceBounds,RAIN_MAP_SIZE,RAIN_SAMPLE_STEP,RAIN_EXTINCTION} from './precipitation';
import {DispersalState,nextMorphologySeed,type WeatherImpulse} from './weatherInteraction';
import { createCloudIntegrator } from './cloudShader';
import {SKY_LUT_SIZE} from './atmosphere';
import {SkyCache,type SkyResult} from './skyCache';
import {createFlash,flashIntensity,thunderPlan,type Flash} from './storm';
import { motionState,FLOW_WGSL,type MotionState } from './motion';
import { MOTION_FIELD_SIZE,fillMotionField,writeFilteredSourcePosition } from './motionField';
import { EXTINCTION, ICE_EXTINCTION, DETAIL_RESOLUTION, SUN_LEFT, VOLUME_RESOLUTION, cloudParameters, morphologyFamily, iceHeights, sampleCloudDensity, BOUNDS_MIN, BOUNDS_SIZE, type CloudVolume } from './volume';
import { conservativeEmptyStep } from './emptyTraversal';
import {clampCameraAboveLandscape,CAMERA_TERRAIN_CLEARANCE_KM,TERRAIN_HASH_ID} from './landscape';
import {TerrainMesh,type TerrainSampler} from './terrainMesh';
import {terrainSurfaceSample,TERRAIN_SURFACE_WGSL} from './terrainSurface';
import {loadTerrainDem,createDemTerrainSampler,TERRAIN_DEM_ID} from './terrainDem';
import {loadTerrainCover,TERRAIN_COVER_ID} from './terrainCover';
import {createTerrainCoverTextures,type TerrainCoverTextures} from './terrainCoverTextures';
import { FrameMeasurement, summarizeFrames, summarizeSamples } from './performance';
import {QueuePrefixMeasurement} from './queuePrefixMeasurement';
import {resolveThree186TimestampBatch,type TimestampPoolKind} from './three186TimestampBatch';
import {TimestampBatchMeasurement,type TimestampDrawCounters} from './timestampBatchMeasurement';
import type {RenderHost,Viewport,RenderEvent} from './renderProtocol';
import type {NarrowCloudVolume} from './narrowCloud';
import {readDensityR8,type DensityR8Packet} from './densityR8';
import {NativeFrameExporter,type NativeFrameExportEvent} from './nativeFrameExport';

const RENDERER_VERSION='experiment-v58-triangle-texel-shadow';

export const QUALITY = {
  native: {label:'Alta · 100% / 128 passi', scale:1, steps:128},
  ultra: {label:'Massima · 100% / 384 passi', scale:1, steps:384},
  balanced: {label:'Fluida · 75% / 96 passi', scale:.75, steps:96},
} as const;
export type Quality = keyof typeof QUALITY;
type CloudTextures = {source:NarrowCloudVolume&DensityR8Packet;macro:Data3DTexture;density:Data3DTexture|null;sunset:Data3DTexture;detail:Data3DTexture;narrow:Data3DTexture;supportBounds:CloudVolume['supportBounds']};

export class GPUSceneEngine {
  private renderer: WebGPURenderer | null = null;
  private device: GPUDevice | null = null;
  private quad: QuadMesh | null = null;
  private material: MeshBasicNodeMaterial | null = null;
  private terrainRaster:TerrainMesh|null=null;
  private terrainSample:TerrainSampler=terrainSurfaceSample;
  private terrainCover:TerrainCoverTextures|null=null;
  private readonly terrainRequest=new AbortController();
  private volume: Data3DTexture | null = null;
  private detailVolume: Data3DTexture | null = null;
  private narrowCloudVolume:Data3DTexture|null=null;
  private densityR8Volume:Data3DTexture|null=null;
  private integratorUsesDensityR8=false;
  private integratorUsesNarrow:boolean|null=null;
  private cameraVolume:CloudVolume|null=null;
  private approachSurface=.4;private approachTime=-1000;
  private approachProbe:(ApproachProbe&{cpuMs:number;fieldFillMs:number;boundaryMs:number})|null=null;
  private readonly approachField=new Uint16Array(MOTION_FIELD_SIZE**3*4);
  private approachFieldTime=NaN;private approachFieldDispersion=NaN;
  private frozenMotionState:MotionState|null=null;
  private readonly inspection=uniform(0);private readonly ground=uniform(1);
  private readonly rainTexture=new DataTexture(new Uint8Array(RAIN_MAP_SIZE**2*2),RAIN_MAP_SIZE,RAIN_MAP_SIZE,RGFormat,UnsignedByteType);
  private sunsetVolume: Data3DTexture | null = null;
  private readonly sunsetAmount=uniform(0);
  private readonly sunFrom=new Vector3(); private readonly sunTarget=new Vector3();
  private lightSideFrom=0;private lightSideTarget=0;
  private sunsetFrom=0; private sunsetTarget=0;
  private worker: Worker | null = null;
  private raf = 0;
  private destroyed = false;
  private deviceLost = false;
  private releasingGPU = false;
  private initialization: Promise<void> | null = null;
  private cleanup: Promise<void> | null = null;
  private rejectVolume: ((reason: Error)=>void) | null = null;
  private ready = false;
  private regenerating = false;
  private seed = 71;
  private paused = false;
  private orbit = false;
  private simulationTime = 0;
  private previous = 0;
  private uiTime = 0;
  private timestampPending = false;
  private timestampTime = 0;
  private timestampPromise: Promise<void> | null = null;
  private timestampSupported = false;
  private gpuMs: number | null = null;
  private computeMs:number|null=null;
  private queueMs:number|null=null;
  private queuePromise:Promise<void>|null=null;
  private queuePending=false;
  private queueTime=0;
  private readonly profiling:boolean;
  private readonly comparisonSurface:number|null;
  private readonly comparisonTarget:[number,number,number]|null;
  private readonly timingMode:string;
  private readonly frozenFlow:boolean;
  private frameLimit:number;
  private viewport:Viewport;
  private visible:boolean;
  private clockSample:Record<string,number>|null=null;
  private framesInFlight=0;
  private skippedFrames=0;
  private readonly frameCompletions=new Set<Promise<void>>();
  private intervals: number[] = [];
  private measurement: FrameMeasurement | null = null;
  private queuePrefix:QueuePrefixMeasurement|null=null;
  private timestampBatch:TimestampBatchMeasurement|null=null;
  private timestampDrawSerial=0;
  private benchmarkCompletion:Promise<void>|null=null;
  private benchmarkGeneration=0;
  private benchmarkContext: Record<string, unknown> = {};
  private report: Record<string, unknown> | null = null;
  private readonly frameExporter:NativeFrameExporter|null;
  private frameExportDisplayRequest:number|null=null;
  private shadowReadBusy=false;
  private frameDrawSerial=0;
  private quality: Quality = 'ultra';
  private outputMode = 'screen';
  private outputWidth = 0;
  private outputHeight = 0;
  private internalWidth = 0;
  private internalHeight = 0;
  private dirtySize = true;
  private side = 0;
  private speed=1;
  private readonly view=new OrbitView();
  private readonly cloudCenter=new Vector3(0,3,0);
  private readonly viewFocus=new Vector3(0,3,0);
  private readonly dispersal=new DispersalState();
  private readonly forcing=uniform(new Vector2(0,0));
  private readonly wind=uniform(new Vector2());
  private windStrength=.55;
  private gustStart=-100;
  private gustStrength=0;
  private readonly flowFamily=uniform(0);
  private skyMode:WeatherScene='storm';
  private readonly weatherState=new WeatherState();
  private readonly skyCache=new SkyCache();
  private skyRequest=0;private skyPending=false;
  private atmosphereProgress=1;
  private readonly atmosphereBlend=uniform(1);
  private readonly precipitationTime=uniform(0);
  private readonly diagnostic=uniform(0);
  private diagnosticName:string;
  private readonly skyFromData=new Float32Array(SKY_LUT_SIZE**2*4);
  private readonly skyFromPacked=new Uint16Array(SKY_LUT_SIZE**2*4);
  private readonly skyFromTexture=new DataTexture(this.skyFromPacked,SKY_LUT_SIZE,SKY_LUT_SIZE,RGBAFormat,HalfFloatType);
  private readonly solarFrom=new Vector3(); private readonly solarTarget=new Vector3();
  private readonly ambientFrom=new Vector3(); private readonly ambientTarget=new Vector3();
  private weatherFrom=new Vector2(1.8,1); private weatherTarget=new Vector2(1.8,1);
  private stormAuto=false;
  private stormDistance=3;
  private weatherTime=0;
  private forcingTime=0;
  private nextFlash=12;
  private flashSerial=0;
  private activeFlash:Flash|null=null;
  private flashAnnounced=false;
  private flashPreview=false;
  private readonly skyData=new Float32Array(SKY_LUT_SIZE**2*4);
  private readonly skyPacked=new Uint16Array(SKY_LUT_SIZE**2*4);
  private readonly skyTexture=new DataTexture(this.skyPacked,SKY_LUT_SIZE,SKY_LUT_SIZE,RGBAFormat,HalfFloatType);
  private readonly solarColor=uniform(new Vector3());
  private readonly ambientColor=uniform(new Vector3());
  private readonly weather=uniform(new Vector3(1,0,0));
  private readonly flash=uniform(new Vector4(0,3.5,.5,0));
  private readonly flashTop=uniform(new Vector3());
  private readonly flashBend=uniform(new Vector3());
  private readonly flashEnd=uniform(new Vector3());
  private readonly flashBranch=uniform(new Vector3());
  private adapterInfo: Record<string, unknown> = {};
  private readonly origin = uniform(new Vector3(0,3.5,16));
  private readonly forward = uniform(new Vector3(0,0,-1));
  private readonly right = uniform(new Vector3(1,0,0));
  private readonly up = uniform(new Vector3(0,1,0));
  private readonly aspect = uniform(16/9);
  private readonly resolution = uniform(new Vector2(1280,720));
  private readonly rainBounds = uniform(new Vector4(0,0,0,0));
  private readonly stepSize = uniform(7/128);
  private readonly emptyStep = uniform(7/128);
  private readonly drift = uniform(new Vector3());
  private readonly growth = uniform(new Vector3(.68,.88,.58));
  private readonly supportMin=uniform(new Vector3(-5,-.5,-3.5));
  private readonly supportMax=uniform(new Vector3(5,8,3.5));
  private readonly flowTime=uniform(0);
  private readonly seedPhase=uniform(0);
  private readonly currentFlow=new Storage3DTexture(MOTION_FIELD_SIZE,MOTION_FIELD_SIZE,MOTION_FIELD_SIZE);
  private readonly interpolateFlow=Fn(()=>{
    const x=instanceIndex.mod(MOTION_FIELD_SIZE).toFloat(), y=instanceIndex.div(MOTION_FIELD_SIZE).mod(MOTION_FIELD_SIZE).toFloat(), z=instanceIndex.div(MOTION_FIELD_SIZE**2).toFloat();
    const p=vec3(x.add(.5).div(MOTION_FIELD_SIZE).mul(10).sub(5),y.add(.5).div(MOTION_FIELD_SIZE).mul(8.5).sub(.5),z.add(.5).div(MOTION_FIELD_SIZE).mul(7).sub(3.5));
    textureStore(storageTexture3D(this.currentFlow).toWriteOnly(),vec3(x,y,z),wgslFn(FLOW_WGSL)({p,time:this.flowTime,seedPhase:this.seedPhase,family:this.flowFamily,dispersion:this.forcing.x,iceRange:this.iceRange}));
  })().compute(MOTION_FIELD_SIZE**3);
  private readonly sun = uniform(new Vector3(...SUN_LEFT).normalize());
  private readonly lightSide = uniform(0);
  private readonly iceRange = uniform(new Vector2());
  constructor(private readonly host:RenderHost) {
    const params=new URLSearchParams(host.search),requested=Number(params.get('seed'));
    this.diagnosticName=params.get('ablation')??'full';
    if(params.has('seed')&&Number.isInteger(requested)&&requested>=0&&requested<=0xffffffff) this.seed=requested;
    this.profiling=params.get('profile')==='1';this.comparisonSurface=comparisonSurfaceDistance(host.search);this.comparisonTarget=comparisonCameraTarget(host.search);this.timingMode=params.get('timing')??'stages';this.frozenFlow=params.get('flow')==='frozen';
    this.frameExporter=this.profiling?new NativeFrameExporter(this.onFrameExport,()=>this.refreshFrameExportAvailability()):null;
    this.diagnostic.value=this.profiling?Math.max(0,['full','density','cache','no-flow','no-detail','no-flash'].indexOf(this.diagnosticName)):0;
    this.frameLimit=[1,2].includes(Number(params.get('inflight')))?Number(params.get('inflight')):0;
    this.viewport={...host.viewport};this.visible=host.visible;
    if(this.profiling){this.outputMode='1080';this.simulationTime=60;}
  }
  private emit(event:RenderEvent){this.host.emit(event);}
  private text(field:'status'|'metrics'|'result'|'dynamics',text:string){this.emit({type:'text',field,text});}
  private state(){this.emit({type:'view',approach:this.view.approach});this.emit({type:'state',paused:this.paused,orbit:this.orbit,side:this.side});}
  async start() {
    try {
      if (!navigator.gpu) throw new Error('Questo browser non espone WebGPU. Apri Cloudia in una versione recente di Chrome o Edge con accelerazione grafica.');
      const adapter = await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(this.destroyed) return;
      if(!adapter) throw new Error('Nessun adattatore WebGPU disponibile.');
      const info=adapter.info;
      this.adapterInfo={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter};
      const device=await adapter.requestDevice({requiredFeatures:this.timingMode!=='off'&&adapter.features.has('timestamp-query')?['timestamp-query']:[]});
      if(this.destroyed) { device.destroy(); return; }
      this.device=device;
      const renderer = new WebGPURenderer({canvas:this.host.canvas as HTMLCanvasElement,antialias:false,device,reversedDepthBuffer:true,trackTimestamp:this.timingMode!=='off'});
      this.renderer = renderer;
      const originalDeviceLost=renderer.onDeviceLost.bind(renderer);
      renderer.onDeviceLost=(info)=>{
        if(this.destroyed || this.releasingGPU) return;
        originalDeviceLost(info);
        if(this.deviceLost) return;
        this.deviceLost=true; this.ready=false; this.frameExporter?.dispose();cancelAnimationFrame(this.raf);
        this.worker?.terminate(); this.worker=null;
        this.rejectVolume?.(new Error('Connessione alla GPU persa')); this.rejectVolume=null;
        this.invalidate('Connessione alla GPU persa');
        this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false); this.setButtonEnabled('new-cloud',false);
        this.text('status','Connessione alla GPU persa. Ricarica la scena.');
        this.emit({type:'statusState',state:'failed'});
        void this.releaseGPU();
      };
      this.initialization=renderer.init().then(()=>{});
      await this.initialization;
      if(this.destroyed || this.deviceLost) { await this.releaseGPU(); return; }
      if(!('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend)) throw new Error('WebGPU non è disponibile sulla GPU selezionata. Il vecchio laboratorio resta accessibile con ?legacy.');
      // Timestamp queries are optional; RAF measurements remain available without them.
      this.timestampSupported = this.timingMode!=='off' && renderer.hasFeature('timestamp-query');
      const [measuredTerrain,measuredCover]=await Promise.all([loadTerrainDem(this.terrainRequest.signal),loadTerrainCover(this.terrainRequest.signal)]);
      if(this.destroyed||this.deviceLost){await this.releaseGPU();return;}
      this.terrainSample=createDemTerrainSampler(measuredTerrain,terrainSurfaceSample);
      if(measuredCover.minX!==-64||measuredCover.minZ!==-64||measuredCover.side*measuredCover.spacingKm!==128)throw new Error('Estensione della copertura del suolo incompatibile con il terreno');
      this.terrainCover=createTerrainCoverTextures(measuredCover);
      const texture = await this.loadVolume();
      if(this.destroyed || this.deviceLost) { this.disposeCloudTextures(texture); return; }
      device.pushErrorScope?.('validation');
      this.createTerrain();
      this.installVolume(texture);
      this.applySize();
      this.renderTerrain();
      this.quad!.render(renderer); // Compile the shader before declaring the scene ready.
      const shaderError=await device.popErrorScope?.();
      if(shaderError)throw new Error(`Compilazione GPU fallita: ${shaderError.message.slice(0,500)}`);
      if(this.destroyed||this.deviceLost)return;
      this.ready=true;
      this.text('status',`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`);
      this.emit({type:'statusState',state:'loaded'});
      this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      this.setButtonEnabled('new-cloud',true);this.setButtonEnabled('family',true);this.emit({type:'ready'});
      this.refreshFrameExportAvailability();
      this.previous=0;
      if(!!this.visible) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      this.text('status',error instanceof Error ? error.message : String(error));
      this.emit({type:'statusState',state:'failed'});
      await this.releaseGPU();
    }
  }
  private disposeCloudTextures(textures:CloudTextures){
    textures.macro.dispose();textures.detail.dispose();textures.sunset.dispose();textures.narrow.dispose();textures.density?.dispose();
  }
  private installVolume(textures: CloudTextures) {
    const oldMaterial=this.material, oldVolume=this.volume, oldDetail=this.detailVolume,oldSunset=this.sunsetVolume,oldNarrow=this.narrowCloudVolume,oldDensity=this.densityR8Volume;
    this.cameraVolume=textures.source;
    const rainMap=precipitationFootprint(textures.source);
    this.rainTexture.image.data=rainMap;
    this.rainBounds.value.fromArray(precipitationSourceBounds(rainMap)??[0,0,0,0]);
    this.rainTexture.minFilter=LinearFilter;this.rainTexture.magFilter=LinearFilter;this.rainTexture.colorSpace=NoColorSpace;this.rainTexture.generateMipmaps=false;this.rainTexture.needsUpdate=true;
    this.approachTime=-1000;this.approachProbe=null;this.approachFieldTime=NaN;
    this.volume=textures.macro;this.detailVolume=textures.detail;this.sunsetVolume=textures.sunset;this.narrowCloudVolume=textures.narrow;this.densityR8Volume=textures.density; this.material=new MeshBasicNodeMaterial();
    this.updateAtmosphere();
    this.iceRange.value.fromArray(iceHeights(this.seed));
    this.cloudCenter.fromArray(textures.supportBounds.min).add(new Vector3().fromArray(textures.supportBounds.max)).multiplyScalar(.5);
    this.viewFocus.copy(this.cloudCenter);
    // Added inverse shear plus any flow halo clipped by the texture-domain box.
    this.supportMin.value.fromArray(textures.supportBounds.min).sub(new Vector3(1.3,0,.65));
    this.supportMax.value.fromArray(textures.supportBounds.max).add(new Vector3(1.3,0,.65));
    this.flowFamily.value=this.seed%3;
    this.emit({type:'morphology',family:morphologyFamily(this.seed),seed:this.seed});
    this.seedPhase.value=(this.seed%71)/71*.35;
    this.updateEvolution();
    this.frozenMotionState=motionState(this.simulationTime,this.seed);this.frozenMotionState.dispersion=this.forcing.value.x;
    this.currentFlow.type=HalfFloatType;this.currentFlow.format=RGBAFormat;this.currentFlow.colorSpace=NoColorSpace;
    this.currentFlow.generateMipmaps=false;
    this.configureIntegrator();
    this.quad=new QuadMesh(this.material);
    this.renderer?.compute(this.interpolateFlow); // Initialize this seed even for the frozen diagnostic control.
    oldMaterial?.dispose(); oldVolume?.dispose();oldDetail?.dispose();oldSunset?.dispose();oldNarrow?.dispose();oldDensity?.dispose();
  }
  private createTerrain(){
    const shade=wgslFn(`fn terrainRasterColour(point:vec3<f32>,normal:vec3<f32>,height:f32,coast:f32,distance:f32,sun:vec3<f32>,solar:vec3<f32>,ambient:vec3<f32>,solarVisibility:f32,coverMapA:texture_2d<f32>,coverSamplerA:sampler,coverMapB:texture_2d<f32>,coverSamplerB:sampler)->vec3<f32>{
      let pixelKm=max(max(length(dpdx(point)),length(dpdy(point))),.00001);
      // Cell edges at -64/+64km; UV texel centres match the source cell means.
      // Hardware area mips avoid point-sampling cover at coarse mesh vertices.
      let coverUV=(point.xz+vec2<f32>(64.0))/128.0;
      let a=textureSample(coverMapA,coverSamplerA,coverUV);
      let b=textureSample(coverMapB,coverSamplerB,coverUV);
      let total=max(dot(a+b,vec4<f32>(1.0)),.00001);
      let measured=(1.0-smoothstep(48.0,64.0,abs(point.x)))*(1.0-smoothstep(48.0,64.0,abs(point.z)));
      let coverA=mix(vec4<f32>(1.0,0.0,0.0,0.0),a/total,measured);
      let coverB=b*(measured/total);
      return terrainSurfaceMaterial(point,height,coast,normal,distance,pixelKm,sun,solar,ambient,solarVisibility,coverA,coverB);
    }`,[wgsl(TERRAIN_SURFACE_WGSL)]);
    if(!this.terrainCover)throw new Error('Copertura del suolo non preparata');
    const coverMapA=texture(this.terrainCover.coverA),coverMapB=texture(this.terrainCover.coverB);
    this.terrainRaster=new TerrainMesh({cellsPerSide:256,levels:9,normalMode:'geometry',sample:this.terrainSample,shade:({positionWorld,normal,height,coast,distance,shadowVisibility})=>
      shade({point:positionWorld,normal,height,coast,distance,sun:this.sun,solar:this.solarColor,ambient:this.ambientColor,solarVisibility:shadowVisibility,coverMapA,coverSamplerA:coverMapA,coverMapB,coverSamplerB:coverMapB}) as Node<'vec3'>});
  }
  private renderTerrain(){
    if(this.renderer&&this.terrainRaster&&this.ground.value>.001)this.terrainRaster.render(this.renderer,{
      origin:this.origin.value,forward:this.forward.value,right:this.right.value,up:this.up.value,
      aspect:this.aspect.value,tanFov:.2867,inspection:this.inspection.value},this.sun.value);
  }
  private configureIntegrator(){
    const useNarrow=this.weatherState.targetRain>.001||this.weatherState.rain>.001;
    if(!this.material||!this.terrainRaster||!this.volume||!this.detailVolume||!this.sunsetVolume||(useNarrow&&!this.narrowCloudVolume))return;
    this.approachTime=-1000;this.approachFieldTime=NaN;
    if(this.diagnostic.value===3)this.approachField.fill(0);
    const volumeNode=texture3D(this.volume),detailNode=texture3D(this.detailVolume);
    const flowNode=texture3D(this.currentFlow),sunsetNode=texture3D(this.sunsetVolume);
    const skyNode=texture(this.skyTexture),skyFromNode=texture(this.skyFromTexture),rainNode=texture(this.rainTexture);
    const parameters={inspection:this.inspection,ground:this.ground,terrainRaster:texture(this.terrainRaster.texture),rainBounds:this.rainBounds,rainMap:rainNode,rainSampler:rainNode,sunsetLight:sunsetNode,sunsetSampler:sunsetNode,sunsetAmount:this.sunsetAmount,precipitationTime:this.precipitationTime,atmosphereBlend:this.atmosphereBlend,skyFrom:skyFromNode,skyFromSampler:skyFromNode,skyLUT:skyNode,skySampler:skyNode,solarColor:this.solarColor,ambientColor:this.ambientColor,weather:this.weather,forcing:this.forcing,wind:this.wind,flash:this.flash,flashTop:this.flashTop,flashBend:this.flashBend,flashEnd:this.flashEnd,flashBranch:this.flashBranch,uv:uv(),volume:volumeNode,volumeSampler:volumeNode,detail:detailNode,detailSampler:detailNode,flow:flowNode,flowSampler:flowNode,iceRange:this.iceRange,
      origin:this.origin,forward:this.forward,right:this.right,up:this.up,aspect:this.aspect,tanFov:uniform(.2867),
      stepSize:this.stepSize,emptyStep:this.emptyStep,resolution:this.resolution,drift:this.drift,growth:this.growth,supportMin:this.supportMin,supportMax:this.supportMax,sun:this.sun,lightSide:this.lightSide,extinction:uniform(EXTINCTION),iceExtinction:uniform(ICE_EXTINCTION)};
    const useDensityR8=useNarrow&&this.densityR8Volume!==null;
    const densityParameters=useDensityR8&&this.densityR8Volume?{...parameters,densityR8:texture3D(this.densityR8Volume)}:parameters;
    const integrate=createCloudIntegrator(this.diagnostic.value,useNarrow,useDensityR8);
    if(useNarrow&&this.narrowCloudVolume)this.material.fragmentNode=integrate({...densityParameters,narrowCloud:texture3D(this.narrowCloudVolume)});
    else this.material.fragmentNode=integrate(densityParameters);
    this.material.needsUpdate=true;
    this.integratorUsesNarrow=useNarrow;this.integratorUsesDensityR8=useDensityR8;
  }
  private syncIntegratorVariant(){
    if(this.ready&&this.integratorUsesNarrow!==(this.weatherState.targetRain>.001||this.weatherState.rain>.001))this.configureIntegrator();
  }
  private async newCloud(family?:number) {
    if(!this.ready) return;
    this.clearStorm();this.invalidate('Nuova nube'); this.ready=false;this.regenerating=true;
    this.refreshFrameExportAvailability();
    this.setButtonEnabled('family',false);this.setButtonEnabled('new-cloud',false); this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.emit({type:'statusState',state:'loading'}); this.text('status','Formazione di una nuova nube…');
    this.seed=nextMorphologySeed(crypto.getRandomValues(new Uint32Array(1))[0],this.seed,family);
    try {
      const texture=await this.loadVolume();
      if(this.destroyed || this.deviceLost) {this.disposeCloudTextures(texture);return;}
      this.regenerating=false; // No visibility restart while GPU resources are being swapped.
      cancelAnimationFrame(this.raf);
      try { await this.device?.queue.onSubmittedWorkDone(); }
      catch(error){this.disposeCloudTextures(texture);throw error;}
      if(this.destroyed||this.deviceLost){this.disposeCloudTextures(texture);return;}
      this.simulationTime=0;this.dispersal.recover();this.dispersal.amount=0;this.view.reset();this.orbit=false;this.installVolume(texture);this.state();
      this.previous=0; this.intervals=[]; this.ready=true;
      this.text('status',`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`); this.emit({type:'statusState',state:'loaded'});
      this.setButtonEnabled('family',true);this.setButtonEnabled('new-cloud',true); this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      this.refreshFrameExportAvailability();
      if(!!this.visible) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      cancelAnimationFrame(this.raf);this.text('status',error instanceof Error?error.message:String(error)); this.emit({type:'statusState',state:'failed'});
    } finally {this.regenerating=false;}
  }
  private loadVolume(): Promise<CloudTextures> {
    this.worker = new Worker(new URL('./volume.worker.ts',import.meta.url),{type:'module'});
    return new Promise((resolve,reject)=>{
      const worker=this.worker!;
      this.rejectVolume=reject;
      worker.onmessage=(event: MessageEvent<{progress?:number;volume?:NarrowCloudVolume&DensityR8Packet;error?:string}>)=>{
        if(this.destroyed || this.deviceLost) return;
        if(event.data.progress!==undefined) this.text('status',`Formazione della nube e della luce · ${Math.round(event.data.progress*100)}%`);
        if(event.data.error) { worker.terminate(); this.worker=null; this.rejectVolume=null; reject(new Error(event.data.error)); }
        if(event.data.volume) {
          const {size,data,detail,sunsetLight}=event.data.volume;
          const sunsetTexture=new Data3DTexture(sunsetLight,size,size,size);
          sunsetTexture.format=RGFormat;sunsetTexture.type=UnsignedByteType;sunsetTexture.colorSpace=NoColorSpace;
          sunsetTexture.minFilter=LinearFilter;sunsetTexture.magFilter=LinearFilter;sunsetTexture.unpackAlignment=1;
          sunsetTexture.generateMipmaps=false;sunsetTexture.needsUpdate=true;
          const texture = new Data3DTexture(data,size,size,size);
          texture.format=RGBAFormat; texture.type=UnsignedByteType; texture.colorSpace=NoColorSpace;
          texture.minFilter=LinearFilter; texture.magFilter=LinearFilter; texture.unpackAlignment=1;
          texture.generateMipmaps=false; texture.needsUpdate=true;
          const detailTexture=new Data3DTexture(detail.data,detail.size,detail.size,detail.size);
          detailTexture.format=RGBAFormat;detailTexture.type=UnsignedByteType;detailTexture.colorSpace=NoColorSpace;
          detailTexture.minFilter=LinearFilter;detailTexture.magFilter=LinearFilter;detailTexture.unpackAlignment=1;
          detailTexture.wrapS=RepeatWrapping;detailTexture.wrapT=RepeatWrapping;detailTexture.wrapR=RepeatWrapping;
          detailTexture.generateMipmaps=false;detailTexture.needsUpdate=true;
          // Legacy/fixture payloads keep the original path through an occupied 1-texel mask.
          const narrowMask=event.data.volume.narrowMask??{size:1,data:new Uint8Array([255])};
          const narrowTexture=new Data3DTexture(narrowMask.data,narrowMask.size,narrowMask.size,narrowMask.size);
          narrowTexture.format=RedFormat;narrowTexture.type=UnsignedByteType;narrowTexture.colorSpace=NoColorSpace;
          narrowTexture.minFilter=NearestFilter;narrowTexture.magFilter=NearestFilter;narrowTexture.unpackAlignment=1;
          narrowTexture.generateMipmaps=false;narrowTexture.needsUpdate=true;
          const densityPayload=readDensityR8(event.data.volume);
          let densityTexture:Data3DTexture|null=null;
          if(densityPayload){
            densityTexture=new Data3DTexture(densityPayload.data,size,size,size);
            densityTexture.format=RedFormat;densityTexture.type=UnsignedByteType;densityTexture.colorSpace=NoColorSpace;
            densityTexture.minFilter=LinearFilter;densityTexture.magFilter=LinearFilter;densityTexture.unpackAlignment=1;
            densityTexture.wrapS=ClampToEdgeWrapping;densityTexture.wrapT=ClampToEdgeWrapping;densityTexture.wrapR=ClampToEdgeWrapping;
            densityTexture.generateMipmaps=false;densityTexture.flipY=false;densityTexture.needsUpdate=true;
          }
          worker.terminate(); this.worker=null; this.rejectVolume=null; resolve({source:event.data.volume,macro:texture,density:densityTexture,detail:detailTexture,sunset:sunsetTexture,narrow:narrowTexture,supportBounds:event.data.volume.supportBounds});
        }
      };
      worker.onerror=()=>{ worker.terminate(); this.worker=null; this.rejectVolume=null; reject(new Error('La generazione del volume è fallita. Ricarica la scena.')); };
      worker.postMessage({size:VOLUME_RESOLUTION,seed:this.seed});
    });
  }
  private readTimestampCounters():TimestampDrawCounters{
    const info=this.renderer!.info;
    return {frame:info.frame,renderFrameCalls:info.render.frameCalls,computeFrameCalls:info.compute.frameCalls};
  }
  private frame = (now: number) => {
    if(this.destroyed || this.deviceLost || !this.visible || !this.renderer || !this.quad) return;
    const cpuStart=performance.now();
    this.clockSample??={rafTimestamp:now,localNow:cpuStart,localTimeOrigin:performance.timeOrigin};
    this.raf=requestAnimationFrame(this.frame);
    if(this.frameLimit && this.framesInFlight>=this.frameLimit) {this.skippedFrames++;return;}
    if(this.dirtySize) this.applySize();
    const interval=this.previous ? now-this.previous : 0;
    this.previous=now;
    if(interval>0) { this.intervals.push(interval); if(this.intervals.length>180) this.intervals.shift(); }
    if(!this.paused) this.simulationTime+=Math.min(interval/1000,.05)*this.speed;
    const weatherDelta=this.paused?0:Math.max(0,interval/1000);
    this.weatherTime+=Math.max(0,interval/1000);
    // Control transitions remain responsive while cloud/rain motion is paused.
    this.advanceAtmosphere(Math.max(0,interval/1000));
    this.forcingTime+=weatherDelta;
    this.dispersal.step(weatherDelta,this.forcingTime);
    this.forcing.value.set(this.dispersal.amount,0);
    const t=this.simulationTime;
    const gustAge=this.forcingTime-this.gustStart,gust=gustAge>=0&&gustAge<4?this.gustStrength*Math.sin(Math.PI*gustAge/4):0;
    const windStrength=Math.min(1,this.windStrength+gust);
    this.wind.value.set(windStrength*(.52+.23*Math.sin(t*.055+this.seedPhase.value*3)),windStrength*.26*Math.sin(t*.031+.6));
    this.updateStorm();
    this.updateEvolution();
    this.drift.value.set(this.windStrength*(.32*Math.sin(t*.027)+.11*Math.sin(t*.071)),Math.sin(t*.04)*.015,0);
    if(this.comparisonTarget)this.viewFocus.fromArray(this.comparisonTarget);
    const focus=this.viewFocus.toArray(),autoYaw=this.orbit?Math.sin(t*.075)*.38:0;
    if(this.comparisonSurface===null&&this.view.approach>0&&this.cameraVolume&&now-this.approachTime>150){
      const approach=this.view.approach;this.view.approach=0;
      const home=this.view.frame(focus,this.aspect.value,autoYaw);this.view.approach=approach;
      const state=motionState(this.simulationTime,this.seed);state.dispersion=this.dispersal.amount;
      const volume=this.cameraVolume,ice=this.iceRange.value.toArray(),wind=this.wind.value.toArray(),drift=this.drift.value.toArray();
      const probeStarted=performance.now();
      // Match the renderer's filtered half-float field. Analytic thermals can
      // place the estimated front over 100 m behind the rendered front.
      const fieldState=this.frozenFlow?this.frozenMotionState??state:state;
      if(this.diagnostic.value!==3&&(this.approachFieldTime!==fieldState.time||this.approachFieldDispersion!==fieldState.dispersion)){
        fillMotionField(this.approachField,MOTION_FIELD_SIZE,fieldState,ice);
        this.approachFieldTime=fieldState.time;this.approachFieldDispersion=fieldState.dispersion??0;
      }
      const fieldFilled=performance.now();
      const q=new Float64Array(4);
      const probe=probeApproach(focus,home.origin,p=>{
        writeFilteredSourcePosition(p.map((v,i)=>v-drift[i]),state,ice,wind,this.approachField,q);
        if(q[0]<BOUNDS_MIN[0]||q[0]>BOUNDS_MIN[0]+BOUNDS_SIZE[0]||q[1]<BOUNDS_MIN[1]||q[1]>BOUNDS_MIN[1]+BOUNDS_SIZE[1]||q[2]<BOUNDS_MIN[2]||q[2]>BOUNDS_MIN[2]+BOUNDS_SIZE[2])return 0;
        const height=Math.max(0,Math.min(1,(q[1]-ice[0])/(ice[1]-ice[0])));
        const amount=height*height*(3-2*height); // Match shader smoothstep, including the ice boundary.
        // Dynamic dispersal and metre-scale inspection erosion only remove
        // density; omitting those terms keeps this boundary estimate outside.
        return sampleCloudDensity(volume,volume.detail,q[0],q[1],q[2],amount,q[3]);
      },{min:this.supportMin.value.toArray().map((v,i)=>v+drift[i]),max:this.supportMax.value.toArray().map((v,i)=>v+drift[i])});
      this.approachSurface=probe.distance;
      const probeEnded=performance.now();
      this.approachProbe={...probe,cpuMs:probeEnded-probeStarted,fieldFillMs:fieldFilled-probeStarted,boundaryMs:probeEnded-fieldFilled};
      this.approachTime=now;
    }
    this.inspection.value=this.view.approach;
    const camera=this.view.frame(focus,this.aspect.value,autoYaw,this.comparisonSurface??this.approachSurface);
    if(this.ground.value>0)camera.origin=clampCameraAboveLandscape(camera.origin,CAMERA_TERRAIN_CLEARANCE_KM,this.terrainRaster?.surfaceY(camera.origin[0],camera.origin[2])??null);
    else camera.origin[1]=Math.max(-3.8,camera.origin[1]);
    this.origin.value.fromArray(camera.origin);
    this.forward.value.copy(this.viewFocus).sub(this.origin.value).normalize();
    this.right.value.crossVectors(this.forward.value,new Vector3(0,1,0)).normalize();
    this.up.value.crossVectors(this.right.value,this.forward.value).normalize();
    const timestampBatch=this.timestampBatch;
    const countersBefore=timestampBatch?this.readTimestampCounters():null;
    const computeStart=performance.now();
    if(!this.frozenFlow) this.renderer.compute(this.interpolateFlow);
    const renderStart=performance.now();
    this.renderTerrain();
    this.quad.render(this.renderer);
    if(this.frameExporter){
      this.frameDrawSerial++;
      if(this.frameExporter.waiting&&this.frameExportOwnerReady()&&!this.benchmarkActive())this.frameExporter.capture(this.host.canvas,this.frameExportMetadata(now));
    }
    const drawId=timestampBatch?++this.timestampDrawSerial:0,countersAfter=timestampBatch?this.readTimestampCounters():null;
    const measured=this.measurement;
    let measuredIntervalId:number|null=null,completed=false;
    if(measured&&!measured.result&&!measured.cancelReason){
      const intervalCount=measured.intervals.length;
      measured.recordStages(renderStart-computeStart,performance.now()-renderStart);
      measured.recordDispatch(Math.max(0,cpuStart-now));measured.recordCPU(performance.now()-cpuStart);measured.record(now);
      if(measured.intervals.length>intervalCount)measuredIntervalId=measured.intervals.length;
      if(now>=measured.start+measured.warmup)this.queuePrefix?.recordSubmission(now);
      completed=!!measured.result&&!this.report;
    }
    if(timestampBatch&&countersBefore&&countersAfter)timestampBatch.recordDraw({id:drawId,measuredIntervalId,before:countersBefore,after:countersAfter});
    if(completed)this.finishBenchmark();
    if(now-this.uiTime>500) { this.uiTime=now; this.updateMetrics(now); }
    if(this.timestampSupported && !this.timestampPending && now-this.timestampTime>=200) {
      this.timestampPending=true; this.timestampTime=now;
      const run=this.measurement,renderer=this.renderer,started=performance.now(),batchRun=this.timestampBatch;
      const resolve=(kind:TimestampPoolKind)=>batchRun?
        resolveThree186TimestampBatch(renderer,kind,{revision:'186',requestAppDrawId:drawId}).then(batch=>{
          batchRun.recordBatch(batch);
          if(batch.status==='error')throw new Error(batch.reason??'Timestamp batch failed');
        }):renderer.resolveTimestampsAsync(kind);
      this.timestampPromise=Promise.all([resolve('render'),...(this.timingMode==='render'?[]:[resolve('compute')])]).then(()=>{
        if(this.destroyed || !this.renderer) return;
        const ms=renderer.info.render.timestamp,compute=renderer.info.compute.timestamp;
        if(Number.isFinite(ms) && ms>0) {this.gpuMs=ms;run?.recordGPU(ms,'render',started);}
        if(this.timingMode!=='render' && !this.frozenFlow && Number.isFinite(compute) && compute>=0) {this.computeMs=compute;run?.recordGPU(compute,'compute',started);}
      }).catch(()=>{ this.timestampSupported=false; this.gpuMs=null; }).finally(()=>{this.timestampPending=false;});
    }
    if(this.timingMode==='queue' && !this.frameLimit && !this.queuePending && this.device && now-this.queueTime>=500) {
      this.queuePending=true;this.queueTime=now;
      const started=performance.now(),run=this.measurement;
      this.queuePromise=this.device.queue.onSubmittedWorkDone().then(()=>{
        if(this.destroyed) return;
        this.queueMs=performance.now()-started;run?.recordQueue(this.queueMs,started);
      }).catch(()=>{}).finally(()=>{this.queuePending=false;});
    }
    if(this.frameLimit && this.device) {
      this.framesInFlight++;
      const started=performance.now(),run=this.measurement;
      const completion=this.device.queue.onSubmittedWorkDone().then(()=>{
        if(this.destroyed) return;
        this.queueMs=performance.now()-started;run?.recordQueue(this.queueMs,started);
      }).catch(()=>{}).finally(()=>{this.framesInFlight--;this.frameCompletions.delete(completion);});
      this.frameCompletions.add(completion);
    }
  };
  private frameExportMetadata(rafTimestamp:number):Record<string,unknown>{
    const dimensions=(texture:Data3DTexture|null)=>texture?[texture.image.width,texture.image.height,texture.image.depth]:null;
    return {
      schemaVersion:1,rendererVersion:RENDERER_VERSION,threeRevision:'186',executionThread:this.host.thread,
      scope:'Lossless PNG of the canvas bitmap at this submitted draw; excludes page UI, linear/HDR buffers and compositor presentation. Capture is not a performance sample.',
      uniformScope:'CPU-side values submitted to Three uniforms at this draw; GPU float32 rounding is not read back.',
      frame:{ownerDrawSerial:this.frameDrawSerial,rafTimestamp,localSnapshotTime:performance.now(),localTimeOrigin:performance.timeOrigin,date:new Date().toISOString(),counterScope:'Frame-loop draw calls in this engine owner, including regeneration draws; not GPU completion or presentation'},
      ready:this.ready,regenerating:this.regenerating,seed:this.seed,family:morphologyFamily(this.seed),
      terrainRaster:this.terrainRaster?.stats(),
      quality:this.quality,nominalSteps:QUALITY[this.quality].steps,stepSizeKm:this.stepSize.value,emptyStepKm:this.emptyStep.value,
      output:[this.outputWidth,this.outputHeight],internal:[this.internalWidth,this.internalHeight],outputMode:this.outputMode,
      canvas:[this.host.canvas.width,this.host.canvas.height],viewport:{...this.viewport},
      rendererOutputColorSpace:this.renderer?.outputColorSpace,rendererToneMapping:this.renderer?.toneMapping,
      volume:dimensions(this.volume),detailVolume:dimensions(this.detailVolume),motionField:[MOTION_FIELD_SIZE,MOTION_FIELD_SIZE,MOTION_FIELD_SIZE],
      ablation:this.diagnosticName,ablationCode:this.diagnostic.value,flowMode:this.frozenFlow?'frozen':'full',flowSampled:this.diagnostic.value!==3,flowComputeThisDraw:!this.frozenFlow,
      densitySampling:this.densitySamplingReport(),narrowCloudSpecialization:this.integratorUsesNarrow?'rain':'dry',
      camera:{origin:this.origin.value.toArray(),target:this.viewFocus.toArray(),forward:this.forward.value.toArray(),right:this.right.value.toArray(),up:this.up.value.toArray(),
        yaw:this.view.yaw,pitch:this.view.pitch,approach:this.inspection.value,aspect:this.aspect.value,tanHalfVerticalFov:.2867,
        comparisonSurfaceKm:this.comparisonSurface,comparisonTargetKm:this.comparisonTarget,probeSkipped:this.comparisonSurface!==null,
        surfaceEstimateKm:this.comparisonSurface===null?this.approachSurface:null,probe:this.approachProbe,probeAgeMs:this.approachProbe?rafTimestamp-this.approachTime:null,
        ground:this.ground.value,terrainClearanceKm:CAMERA_TERRAIN_CLEARANCE_KM},
      clocks:{simulationTime:this.simulationTime,forcingTime:this.forcingTime,weatherTime:this.weatherTime,
        precipitationUniformTime:this.precipitationTime.value,flowUniformTime:this.flowTime.value,
        flowFieldTime:this.frozenFlow?this.frozenMotionState?.time??null:this.flowTime.value,
        flowFieldDispersion:this.frozenFlow?this.frozenMotionState?.dispersion??null:this.forcing.value.x,
        note:'Precipitation uniform is applied before this frame advances forcingTime. A frozen flow texture retains its installation time/dispersion even while flowUniformTime advances.'},
      paused:this.paused,orbit:this.orbit,speed:this.speed,
      material:{growth:this.growth.value.toArray(),drift:this.drift.value.toArray(),wind:this.wind.value.toArray(),forcing:this.forcing.value.toArray(),
        iceRange:this.iceRange.value.toArray(),seedPhase:this.seedPhase.value,flowFamily:this.flowFamily.value,
        supportMin:this.supportMin.value.toArray(),supportMax:this.supportMax.value.toArray(),extinctionPerKm:EXTINCTION,iceExtinctionPerKm:ICE_EXTINCTION},
      weather:{skyIntent:this.skyMode,rain:this.weather.value.z,targetRain:this.weatherState.targetRain,haze:this.weather.value.x,overcast:this.weather.value.y,
        skyPending:this.skyPending,atmosphereProgress:this.atmosphereProgress,atmosphereBlend:this.atmosphereBlend.value,windStrength:this.windStrength,dispersion:this.forcing.value.x,
        precipitationBounds:this.rainBounds.value.toArray(),precipitationStepKm:RAIN_SAMPLE_STEP,precipitationExtinctionPerKm:RAIN_EXTINCTION},
      skyTextures:{requestSerial:this.skyRequest,requestedSide:this.side,
        from:{uuid:this.skyFromTexture.uuid,version:this.skyFromTexture.version,width:this.skyFromTexture.image.width,height:this.skyFromTexture.image.height,type:this.skyFromTexture.type,colorSpace:this.skyFromTexture.colorSpace},
        to:{uuid:this.skyTexture.uuid,version:this.skyTexture.version,width:this.skyTexture.image.width,height:this.skyTexture.image.height,type:this.skyTexture.type,colorSpace:this.skyTexture.colorSpace},
        scope:'Owner-local texture objects and upload revisions; not portable content hashes.'},
      lighting:{sunDirection:this.sun.value.toArray(),lightSide:this.lightSide.value,sunsetAmount:this.sunsetAmount.value,
        solarColor:this.solarColor.value.toArray(),ambientColor:this.ambientColor.value.toArray(),flash:this.flash.value.toArray(),
        flashTop:this.flashTop.value.toArray(),flashBend:this.flashBend.value.toArray(),flashEnd:this.flashEnd.value.toArray(),flashBranch:this.flashBranch.value.toArray(),flashCount:this.flashSerial},
      terrain:{surfaceId:TERRAIN_DEM_ID,coverId:TERRAIN_COVER_ID,hash:TERRAIN_HASH_ID,verticalExaggeration:1,originDegrees:[44,10],axisX:'west',axisZ:'north'},
    };
  }
  /** Explicit profile-only readback, independent from native PNG and FPS collection. */
  private async readShadowTexels(){
    if(!this.profiling||new URLSearchParams(this.host.search).get('shadowProbe')!=='1'||!this.frameExportOwnerReady()||this.frameExportBusy()||this.benchmarkActive())return;
    const renderer=this.renderer,terrain=this.terrainRaster;if(!renderer||!terrain)return;
    if(!this.paused||this.skyPending||this.atmosphereProgress!==1){this.text('result','Fissa la scena e attendi il cielo assestato prima del readback.');return;}
    this.shadowReadBusy=true;this.refreshFrameExportAvailability();
    const shadow=terrain.shadow,target=shadow.target,start=performance.now(),before=shadow.stats(),sunBefore=this.sun.value.toArray();
    const snapshot=this.frameExportMetadata(start);
    const selected=[{"id":"L1-artifact","pixel":[1067,1248],"cpuBaselineKm":15.696154315411782,"cpuClippedKm":15.718109606469762,"qLookupKm":15.50604719760997,"physicallyLit":false},{"id":"L1-control","pixel":[1069,1248],"cpuBaselineKm":15.280342904313791,"cpuClippedKm":15.571982399091235,"qLookupKm":15.514424307352824,"physicallyLit":false},{"id":"L2-artifact","pixel":[1011,1235],"cpuBaselineKm":14.603874701222615,"cpuClippedKm":14.719211174686103,"qLookupKm":14.55703025311887,"physicallyLit":false},{"id":"L2-control","pixel":[1011,1235],"cpuBaselineKm":14.603874701222615,"cpuClippedKm":14.719211174686103,"qLookupKm":14.62369042096359,"physicallyLit":false},{"id":"L3-artifact","pixel":[883,1303],"cpuBaselineKm":18.80640944537438,"cpuClippedKm":18.850593004729017,"qLookupKm":18.709249409426626,"physicallyLit":false},{"id":"L3-control","pixel":[882,1303],"cpuBaselineKm":18.767551431994647,"cpuClippedKm":18.81803184329584,"qLookupKm":18.783166376834107,"physicallyLit":false},{"id":"C1-ocean","pixel":[792,1104],"cpuBaselineKm":4.892108997159529,"cpuClippedKm":4.892208716958345,"qLookupKm":4.969217800263517,"physicallyLit":true},{"id":"C2-coastal-lowland","pixel":[796,1171],"cpuBaselineKm":9.002180272333735,"cpuClippedKm":9.002180272333973,"qLookupKm":9.084590732009218,"physicallyLit":true},{"id":"C3-plain","pixel":[614,1234],"cpuBaselineKm":12.808981129294102,"cpuClippedKm":12.808981129294146,"qLookupKm":12.884028655524803,"physicallyLit":true},{"id":"C4-ridge-L1","pixel":[1048,1258],"cpuBaselineKm":16.044086694431268,"cpuClippedKm":16.079579360018663,"qLookupKm":16.32263826352736,"physicallyLit":true},{"id":"C5-ridge-L2","pixel":[996,1263],"cpuBaselineKm":15.870794695770332,"cpuClippedKm":15.93873281023448,"qLookupKm":16.0428199406176,"physicallyLit":true},{"id":"C6-ridge-L3","pixel":[856,1342],"cpuBaselineKm":20.589270311925713,"cpuClippedKm":20.604799937207073,"qLookupKm":20.751235009751746,"physicallyLit":true}];
    try{
      const unique=new Map<string,Promise<{heightKm:number;bits:number;returnedElements:number}>>();
      for(const row of selected){
        const [x,y]=row.pixel,key=x+','+y;
        if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=target.width||y>=target.height)throw new RangeError('Probe texel outside target');
        if(!unique.has(key))unique.set(key,renderer.readRenderTargetPixelsAsync(target,x,y,1,1).then(value=>{
          if(!(value instanceof Float32Array)||value.length<1||!Number.isFinite(value[0]))throw new Error('Expected finite R32F readback');
          return {heightKm:value[0],bits:new Uint32Array(value.buffer,value.byteOffset,1)[0],returnedElements:value.length};
        }));
      }
      const rows=await Promise.all(selected.map(async row=>({...row,...await unique.get(row.pixel[0]+','+row.pixel[1])!})));
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      const after=shadow.stats(),stable=this.terrainRaster===terrain&&shadow.target===target&&before.cache.valid&&after.cache.valid&&before.cache.submissions===after.cache.submissions&&before.cache.epoch===after.cache.epoch&&JSON.stringify(sunBefore)===JSON.stringify(this.sun.value.toArray());
      this.emit({type:'report',report:{...snapshot,reportKind:'terrain-shadow-R32F-readback-v1',scope:'Explicit GPU R32F texel copies at fixed addresses; not a PNG, FPS sample, triangle-ID readback or compositor measurement.',status:'READBACK_COMPLETE',stableShadowDuringRead:stable,startedAtMs:start,finishedAtMs:performance.now(),uniqueTexels:unique.size,rows,cacheBefore:before.cache,cacheAfter:after.cache,sourceWitnessSHA256:'f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc',note:'CPU reference coordinates/heights are frozen Float64 witness values. The GPU may choose a different raster winner; closeness to a formula alone is not proof of fallback or winner identity.'}});
      this.text('result','Readback GPU completato:12 record,11 texel R32F. Dati diagnostici nel JSON; non è una misura FPS.');
    }catch(error){
      if(!this.destroyed&&!this.deviceLost&&!this.releasingGPU){this.emit({type:'report',report:{reportKind:'terrain-shadow-R32F-readback-v1',status:'READBACK_ERROR',message:error instanceof Error?error.message:String(error)}});this.text('result','Readback GPU non riuscito.');}
    }finally{this.shadowReadBusy=false;if(!this.destroyed)this.refreshFrameExportAvailability();}
  }
  private benchmarkActive(){return !!this.benchmarkCompletion||!!this.measurement&&!this.measurement.result&&!this.measurement.cancelReason;}
  private frameExportBusy(){return this.shadowReadBusy||!!this.frameExporter?.busy||this.frameExportDisplayRequest!==null;}
  private frameExportOwnerReady(){return this.ready&&!!this.renderer&&!!this.quad&&!!this.device&&this.visible&&!this.destroyed&&!this.deviceLost&&!this.releasingGPU&&!this.regenerating;}
  private refreshFrameExportAvailability(){
    if(!this.profiling)return;
    const enabled=this.frameExportOwnerReady()&&!this.frameExportBusy()&&!this.benchmarkActive();
    this.setButtonEnabled('frame-capture',enabled);this.setButtonEnabled('benchmark',enabled);this.setButtonEnabled('sustained',enabled);
    this.setButtonEnabled('shadow-probe',enabled&&new URLSearchParams(this.host.search).get('shadowProbe')==='1');
  }
  private onFrameExport=(event:NativeFrameExportEvent)=>{
    if(this.destroyed||this.deviceLost||this.releasingGPU)return;
    if(event.state==='ready')this.frameExportDisplayRequest=event.requestId;
    this.emit({...event,busy:event.busy||this.frameExportDisplayRequest!==null});
  };
  exportFrame(requestId:number){
    if(!this.frameExporter||this.destroyed||this.deviceLost)return;
    const message=!this.visible?'Rendi visibile la scena prima di acquisire.':!this.frameExportOwnerReady()?'Attendi la preparazione della scena.':
      this.benchmarkActive()?'Termina la misura prima di acquisire il PNG.':this.frameExportDisplayRequest!==null?'Attendi la preparazione dei dati del PNG.':null;
    if(message){this.emit({type:'frameExport',requestId,state:'error',busy:this.frameExportBusy(),message});this.refreshFrameExportAvailability();return;}
    this.frameExporter.request(requestId);
  }
  clearFrameExport(requestId:number){this.frameExporter?.clear(requestId);this.refreshFrameExportAvailability();}
  finishFrameExportDisplay(requestId:number){
    if(this.frameExportDisplayRequest!==requestId)return;
    this.frameExportDisplayRequest=null;this.refreshFrameExportAvailability();
  }
  private updateAtmosphere(){
    const request=++this.skyRequest;
    if(!this.quad){this.applySky(this.skyCache.prime(this.skyMode,this.side));return;}
    this.skyPending=true;
    void this.skyCache.request(this.skyMode,this.side).then(result=>{
      if(this.destroyed||this.deviceLost||request!==this.skyRequest)return;
      this.skyPending=false;this.invalidate('Cielo pronto');this.applySky(result);
    }).catch(error=>{if(!this.destroyed&&request===this.skyRequest){this.skyPending=false;this.text('status',error.message);}});
  }
  private applySky(result:SkyResult){
    const {haze,overcast}=result;
    // Snapshot the currently displayed radiance, including interrupted transitions.
    const blend=this.atmosphereBlend.value;
    for(let i=0;i<this.skyData.length;i++)this.skyFromData[i]+=(this.skyData[i]-this.skyFromData[i])*blend;
    this.solarFrom.copy(this.solarColor.value);this.ambientFrom.copy(this.ambientColor.value);
    this.weatherFrom.set(this.weather.value.x,this.weather.value.y);this.weatherTarget.set(haze,overcast);
    this.sunsetFrom=this.sunsetAmount.value;this.sunsetTarget=result.sunset;
    // Direction and cached visibility start from the same displayed state as
    // radiance. A pending request changes intent, never the current lighting.
    this.sunFrom.copy(this.sun.value);this.sunTarget.fromArray(solarDirection(result.side,!!result.sunset));
    this.lightSideFrom=this.lightSide.value;this.lightSideTarget=result.side;
    this.skyData.set(result.data);
    this.solarTarget.fromArray(result.solar);this.ambientTarget.fromArray(result.ambient);
    const initial=!this.quad;
    if(initial){this.sunFrom.copy(this.sunTarget);this.lightSideFrom=this.lightSideTarget;this.sunsetFrom=this.sunsetTarget;this.skyFromData.set(this.skyData);this.solarFrom.copy(this.solarTarget);this.ambientFrom.copy(this.ambientTarget);}
    for(let i=0;i<this.skyData.length;i++){
      this.skyPacked[i]=DataUtils.toHalfFloat(this.skyData[i]);this.skyFromPacked[i]=DataUtils.toHalfFloat(this.skyFromData[i]);
    }
    for(const tex of [this.skyTexture,this.skyFromTexture]){tex.minFilter=LinearFilter;tex.magFilter=LinearFilter;tex.colorSpace=NoColorSpace;tex.generateMipmaps=false;tex.needsUpdate=true;}
    this.atmosphereProgress=initial?1:0;this.advanceAtmosphere(0);
  }
  private advanceAtmosphere(dt:number){
    this.atmosphereProgress=Math.min(1,this.atmosphereProgress+dt/2.4);
    const t=this.atmosphereProgress,b=t*t*(3-2*t);this.atmosphereBlend.value=b;
    this.sunsetAmount.value=this.sunsetFrom+(this.sunsetTarget-this.sunsetFrom)*b;
    this.lightSide.value=this.lightSideFrom+(this.lightSideTarget-this.lightSideFrom)*b;
    interpolateSolarDirection(this.sunFrom,this.sunTarget,b,this.sun.value);
    this.solarColor.value.copy(this.solarFrom).lerp(this.solarTarget,b);this.ambientColor.value.copy(this.ambientFrom).lerp(this.ambientTarget,b);
    this.weatherState.step(dt);this.weather.value.set(this.weatherFrom.x+(this.weatherTarget.x-this.weatherFrom.x)*b,this.weatherFrom.y+(this.weatherTarget.y-this.weatherFrom.y)*b,this.weatherState.rain);
    this.precipitationTime.value=this.forcingTime;
    this.syncIntegratorVariant();
  }
  atmosphere(intent:AtmosphereIntent){
    this.invalidate('Scenario atmosferico modificato');this.weatherState.apply(intent);
    if(intent.type==='scene'){this.skyMode=this.weatherState.scene;this.updateAtmosphere();this.stormAuto=this.skyMode==='storm';this.clearStorm();this.emit({type:'stormState',auto:this.stormAuto});}
    this.syncIntegratorVariant();
  }
  private makeFlash(seed:number){
    const height=cloudParameters(this.seed).towerHeight*motionState(this.simulationTime,this.seed).height;
    return createFlash(seed,this.stormDistance,this.weatherTime,{height,centerX:this.cloudCenter.x});
  }
  private triggerFlash(){
    if(!this.ready||!this.flashPreview&&this.activeFlash&&this.weatherTime-this.activeFlash.start<.9)return;
    this.flashPreview=false;
    this.activeFlash=this.makeFlash((this.seed+ ++this.flashSerial*7919)>>>0);
    this.flashAnnounced=false;
    this.nextFlash=this.weatherTime+7+((this.activeFlash.seed%113)/113)*11;
  }
  private updateStorm(){
    if(this.stormAuto&&!this.flashPreview&&!this.paused&&this.simulationTime>20&&this.weatherTime>=this.nextFlash)this.triggerFlash();
    const f=this.activeFlash;
    this.flash.value.w=this.flashPreview?.85:f?flashIntensity(f,this.weatherTime):0;
    if(f){
      const shear=(p:readonly number[])=>{
        const h=Math.max(0,Math.min(1,(p[1]-.72)/6.2))**1.5;
        return [p[0]+this.wind.value.x*h,p[1],p[2]+this.wind.value.y*h];
      };
      const center=shear(f.position);
      this.flash.value.set(center[0],center[1],center[2],this.flash.value.w);
      this.flashTop.value.fromArray(shear(f.channel[0]));this.flashBend.value.fromArray(shear(f.channel[2]));this.flashEnd.value.fromArray(shear(f.channel[3]));this.flashBranch.value.fromArray(shear(f.branch));
      if(!this.flashPreview&&!this.flashAnnounced&&this.flash.value.w>0){
        this.flashAnnounced=true;this.emit({type:'flash',seed:f.seed,distance:f.distance,delay:thunderPlan(f.distance,f.seed).delay,emittedAt:Date.now()});
      }
      if(this.weatherTime>f.start+f.duration&&!this.flashPreview)this.activeFlash=null;
    }
  }
  private clearStorm(){this.activeFlash=null;this.flash.value.w=0;this.flashPreview=false;this.nextFlash=this.weatherTime+12;this.emit({type:'silence'});}
  private updateEvolution() {
    const evolution=motionState(this.simulationTime,this.seed);
    this.growth.value.set(1/evolution.height,1/evolution.width,1/evolution.anvil);
    this.emptyStep.value=conservativeEmptyStep(this.stepSize.value,evolution,this.wind.value.toArray(),this.iceRange.value.toArray(),
      Math.max(Math.abs(this.supportMin.value.x),Math.abs(this.supportMax.value.x)));
    this.flowTime.value=this.simulationTime;
  }
  private applySize() {
    if(!this.renderer) return;
    const pixelScale=this.outputMode==='screen'?this.viewport.dpr:1;
    this.outputWidth=this.outputMode==='720'?1280:this.outputMode==='1080'?1920:Math.max(1,Math.round(this.viewport.width*pixelScale));
    this.outputHeight=this.outputMode==='720'?720:this.outputMode==='1080'?1080:Math.max(1,Math.round(this.viewport.height*pixelScale));
    this.internalWidth=Math.round(this.outputWidth*QUALITY[this.quality].scale);
    this.internalHeight=Math.round(this.outputHeight*QUALITY[this.quality].scale);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.internalWidth,this.internalHeight,false);
    this.terrainRaster?.resize(this.internalWidth,this.internalHeight);
    this.aspect.value=this.outputWidth/this.outputHeight;
    this.emit({type:'layout',fixed:this.outputMode==='720'||this.outputMode==='1080'});
    this.resolution.value.set(this.internalWidth,this.internalHeight);
    this.stepSize.value=7/QUALITY[this.quality].steps;
    // Deformation changes the material-space distance of a world step. Retain
    // ordinary integration steps until a new accelerated margin is proven.
    this.emptyStep.value=this.stepSize.value;
    this.dirtySize=false;
    this.intervals=[]; this.previous=0;
  }
  private updateMetrics(now: number) {
    const stats=summarizeFrames(this.intervals);
    if(!this.ready)return;
    this.text('status',this.simulationTime<38?`WebGPU · formazione accelerata · ${Math.round(Math.min(1,this.simulationTime/38)*100)}%`:'WebGPU · convezione attiva');
    this.text('dynamics',`Correnti ascendenti e discendenti · vento ${Math.round(this.windStrength*100)}%\nDispersione ${Math.round(this.dispersal.amount*100)}% · vista ${(this.view.yaw*180/Math.PI).toFixed(0)}° / ${(this.view.pitch*180/Math.PI).toFixed(0)}°`);
    this.text('metrics',`${this.host.thread==='worker'?'Worker WebGPU':'WebGPU'} · ${stats.fps.toFixed(1)} fps rAF · ${this.adapterInfo.description || this.adapterInfo.vendor || 'GPU non identificata'}\nOutput ${this.outputWidth}×${this.outputHeight} · interno ${this.internalWidth}×${this.internalHeight}\n${QUALITY[this.quality].steps} passi nominali · mediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} ms\nGPU rendering ${this.gpuMs===null?'non disponibile':`${this.gpuMs.toFixed(2)} ms`} · flusso ${this.computeMs===null?'n/d':`${this.computeMs.toFixed(3)} ms`}\n${this.queueMs===null?'':`Coda completata: ${this.queueMs.toFixed(2)} ms · non è presentazione\n`}Volume ${VOLUME_RESOLUTION}³ + dettaglio ${DETAIL_RESOLUTION}³ · nessun TAA\nTempo della nube: ${this.simulationTime.toFixed(1)} s · seme: ${this.seed}\nForma: ${morphologyFamily(this.seed)} · vento ${Math.round(this.windStrength*100)}% · dispersione ${Math.round(this.dispersal.amount*100)}%\nCielo: ${this.skyMode} · velocità ${this.speed}× · lampi: ${this.flashSerial} · luce ${this.flash.value.w.toFixed(2)}`);
    if(this.measurement && !this.measurement.result && !this.measurement.cancelReason) {
      const remaining=Math.max(0,(this.measurement.start+this.measurement.warmup+this.measurement.duration-now)/1000);
      this.text('result',`Misura in corso · ${Math.ceil(remaining)} s · ${this.measurement.intervals.length} frame raccolti`);
    }
  }
  private densitySamplingReport(){
    const usesR8=this.integratorUsesDensityR8&&this.densityR8Volume!==null;
    const image=(usesR8?this.densityR8Volume:this.volume)?.image;
    const extraBytes=this.densityR8Volume?.image.data?.byteLength??0;
    return {path:usesR8?'r8unorm-extracted-r':'macro-rgba8-r',format:usesR8?'r8unorm':'rgba8unorm',
      dimensions:image?[image.width,image.height,image.depth]:null,textureBytes:image?.data?.byteLength??0,
      extraCpuPayloadBytes:extraBytes,extraGpuPayloadBytes:extraBytes,
      sampling:'same volumeSampler; linear/clamp-to-edge/mip0; NoColorSpace',
      reason:usesR8?'rain with valid densityR8 payload':this.densityR8Volume?'dry weather; R8 retained but not bound':'missing or invalid densityR8 payload',
      allocationAccounting:'nominal payload; GPU upload/residency not measured',
      fallback:usesR8||this.densityR8Volume?null:'missing or invalid densityR8 payload'};
  }
  private startBenchmark(duration: number) {
    if(!this.ready || !this.visible || this.benchmarkCompletion || this.frameExportBusy()) return;
    if(this.dirtySize) this.applySize();
    this.invalidate('Nuova misura');
    this.report=null; this.emit({type:'report',report:null}); this.setButtonEnabled('export',false);
    this.measurement=new FrameMeasurement(performance.now(),duration,2000);
    this.queuePrefix=this.device?new QueuePrefixMeasurement(this.device.queue):null;
    this.timestampBatch=this.timestampSupported?new TimestampBatchMeasurement():null;
    this.benchmarkGeneration++;
    this.benchmarkContext={date:new Date().toISOString(),backend:'WebGPU',adapter:this.adapterInfo,threeRevision:'186',quality:this.quality,
      output:[this.outputWidth,this.outputHeight],internal:[this.internalWidth,this.internalHeight],nominalSteps:QUALITY[this.quality].steps,
      cloudExtinctionPerKm:EXTINCTION,iceExtinctionPerKm:ICE_EXTINCTION,mediaIntegration:'co-located cloud/rain exponential segments',virgaReachVariation:'broad advected sheets, 0.7–1.3 of weak fall distance',precipitationMaxStepKm:RAIN_SAMPLE_STEP,precipitationExtinctionPerKm:RAIN_EXTINCTION,precipitationSourceBounds:this.rainBounds.value.toArray(),
      rendererVersion:RENDERER_VERSION,terrainSurfaceId:TERRAIN_DEM_ID,terrainCover:{id:TERRAIN_COVER_ID,year:2021,sourceClasses:12,materialGroups:8,scope:'Class-area fractions, not physical canopy density or measured albedo; two core RGBA8 textures sampled per terrain fragment with area mips; weights renormalized after filtering',...this.terrainCover?.stats},terrainGeography:{dataset:'Copernicus GLO-90 DSM',originDegrees:[44,10],axisX:'west',axisZ:'north',gridSpacingKm:.125,measuredSquareHalfWidthKm:48,authoredBlendOuterKm:64,verticalExaggeration:1},terrainRaster:this.terrainRaster?.stats(),navigationVersion:'filtered-field-triangulated-terrain-clearance-v4',terrainCameraClearanceKm:CAMERA_TERRAIN_CLEARANCE_KM,terrainHash:TERRAIN_HASH_ID,skyCalculation:'cached dedicated worker',skyPending:this.skyPending,solarVisibility:'256-cubed day + RG8 low-sun endpoints',sunDirection:this.sun.value.toArray(),sunsetAmount:this.sunsetAmount.value,extraSunsetTextureBytes:VOLUME_RESOLUTION**3*2,probeImplementation:'compile-time specialization',ablation:this.diagnosticName,ablationWarning:this.diagnostic.value?'Diagnostic only; output/workload differs. Costs are not additive.':null,executionThread:this.host.thread,clockSample:this.clockSample,skippedFramesScope:'includes warmup',profiling:this.profiling,timingMode:this.timingMode,automaticComputeReadback:this.timingMode==='render',maxFramesInFlight:this.frameLimit||null,skippedFramesAtStart:this.skippedFrames,queueSampling:this.frameLimit?'after-each-submitted-frame':'every-500ms-in-queue-mode',flowMode:this.frozenFlow?'frozen':'full',simulationTimeStart:this.simulationTime,motionModel:'16-cubed analytic updraft/downdraft/outflow/dispersal, inverse height-dependent shear, co-deformed approximate light',supportBounds:{min:this.supportMin.value.toArray(),max:this.supportMax.value.toArray()},flashCountStart:this.flashSerial,camera:{comparisonSurfaceKm:this.comparisonSurface,comparisonTargetKm:this.comparisonTarget,probeSkipped:this.comparisonSurface!==null,approach:this.view.approach,origin:this.origin.value.toArray(),probeFlow:'16-cubed half-float CPU reference, filtered; dynamic dispersal/micro erosion omitted conservatively',probeFieldBytes:this.approachField.byteLength,surfaceEstimateKm:this.comparisonSurface===null?this.approachSurface:null,probe:this.approachProbe,probeAgeMs:this.approachProbe?performance.now()-this.approachTime:null,altitudeKm:this.origin.value.y+4,ground:this.ground.value,yaw:this.view.yaw,pitch:this.view.pitch,target:this.viewFocus.toArray()},weather:{wind:this.windStrength,dispersion:this.dispersal.amount,sky:this.skyMode,rain:this.weatherState.rain,atmosphereTransition:this.atmosphereProgress,speed:this.speed,autoLightning:this.stormAuto,distanceKm:this.stormDistance,flashPreview:this.flashPreview},outputMode:this.outputMode,emptyStepWorld:this.emptyStep.value,volume:[VOLUME_RESOLUTION,VOLUME_RESOLUTION,VOLUME_RESOLUTION],detailVolume:[DETAIL_RESOLUTION,DETAIL_RESOLUTION,DETAIL_RESOLUTION],seed:this.seed,shape:cloudParameters(this.seed),sun:this.side===0?'left':'right',orbit:this.orbit,paused:this.paused,
      densitySamplingStart:this.densitySamplingReport(),
      narrowCloudSkip:{method:'point-nearest-after-flow-v3-weather-specialization-trial',specialization:this.integratorUsesNarrow?'rain':'dry',boundInIntegrator:this.integratorUsesNarrow===true,selection:'targetRain > 0.001 or actual rain > 0.001; dry uses original WGSL signature',resolution:this.narrowCloudVolume?[this.narrowCloudVolume.image.width,this.narrowCloudVolume.image.height,this.narrowCloudVolume.image.depth]:null,extraMaskBytes:this.narrowCloudVolume?.image.data?.byteLength??0,unqualifiedPayload:'fully occupied compatibility mask'},
      clockStateStart:{forcingTime:this.forcingTime,weatherTime:this.weatherTime,precipitationUniformTime:this.precipitationTime.value},
      userAgent:navigator.userAgent,devicePixelRatio:this.viewport.dpr,
      method:'Visible requestAnimationFrame intervals, CPU compute/render submission and callback dispatch delay. GPU render and compute timestamps sampled separately; their last-frame samples are not necessarily paired. Optional queue completion latency includes GPU work, readback and JS delivery; not compositor presentation.',warmupMs:2000,targetDurationMs:duration};
    this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.refreshFrameExportAvailability();
    this.text('result','Riscaldamento · 2 s…');
  }
  private finishBenchmark() {
    const run=this.measurement,prefix=this.queuePrefix,batchRun=this.timestampBatch,generation=this.benchmarkGeneration;
    if(!run?.result||this.benchmarkCompletion)return;
    const stats=run.result,gpu=run.gpuSamplesMs,cpu=run.cpuSamplesMs;
    const legacy={...this.benchmarkContext,terrainRasterEnd:this.terrainRaster?.stats(),densitySamplingEnd:this.densitySamplingReport(),simulationTimeEnd:this.simulationTime,narrowCloudSpecializationEnd:this.integratorUsesNarrow?'rain':'dry',flashCountEnd:this.flashSerial,skippedFrames:this.skippedFrames-(this.benchmarkContext.skippedFramesAtStart as number),emptyStepWorldEnd:this.emptyStep.value,stats,
      clockStateEnd:{forcingTime:this.forcingTime,weatherTime:this.weatherTime,precipitationUniformTime:this.precipitationTime.value},
      gpu:summarizeSamples(gpu),cpu:summarizeSamples(cpu),gpuCompute:summarizeSamples(run.computeSamplesMs),queueCompletion:summarizeSamples(run.queueSamplesMs),
      rafDispatch:summarizeSamples(run.dispatchSamplesMs),cpuCompute:summarizeSamples(run.cpuComputeSamplesMs),cpuRender:summarizeSamples(run.cpuRenderSamplesMs),
      frameIntervalsMs:run.intervals,gpuSamplesMs:gpu,cpuSamplesMs:cpu,computeSamplesMs:run.computeSamplesMs,queueSamplesMs:run.queueSamplesMs,
      dispatchSamplesMs:run.dispatchSamplesMs,cpuComputeSamplesMs:run.cpuComputeSamplesMs,cpuRenderSamplesMs:run.cpuRenderSamplesMs};
    this.text('result','Campionamento concluso · attendo il prefisso GPU finale (massimo 5 s)…');
    const completion=(prefix?prefix.finish():Promise.resolve(null)).then(queuePrefix=>{
      if(this.destroyed||this.deviceLost||this.measurement!==run||this.queuePrefix!==prefix||this.benchmarkGeneration!==generation)return;
      const timestampPasses=batchRun?.finish()??null;
      this.timestampBatch=null;
      this.report={...legacy,metricsSchemaVersion:3,measurementVersion:'submission-queue-prefix-v2-pass-ledger',timestampPasses,
        submissionFps:stats.fps,submissionPacing:stats,gpuRenderPassSumMs:legacy.gpu,presentedCanvasFps:null,queuePrefix,
        metricSemantics:{historicalFields:'unchanged',stats:'accepted render-submission intervals',gpu:'sparse last-resolved-frame sum of render-pass intervals',
          queuePrefix:'benchmark-only completion notifications for immutable logical submitted prefixes; not physical queue depth',
          timestampPasses:'optional pinned-Three-186 fresh query pairs mapped by unchanged-frame and unique call ranges; complete measured draws only, explicit coverage; no extra queries or final readback wait',
          presentedCanvasFps:'unmeasured; does not block this report'}};
      this.queuePrefix=null;this.emit({type:'report',report:this.report});
      const queueStatus=queuePrefix?({completed:'completato',incomplete:'incompleto',timeout:'tempo scaduto',cancelled:'annullato','not-started':'non avviato'}[queuePrefix.status]):'non disponibile';
      this.text('result',`Ultima misura completata · ${stats.fps.toFixed(1)} fps invio · ${(stats.durationMs/1000).toFixed(1)} s · ${stats.frames} intervalli\nMediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} · p99 ${stats.p99Ms.toFixed(2)}\n${stats.over33Ms} oltre 33,34 ms · completamento coda: ${queueStatus}`);
      this.setButtonEnabled('benchmark',true);this.setButtonEnabled('sustained',true);this.setButtonEnabled('export',true);
    }).catch(error=>{
      if(this.destroyed||this.measurement!==run||this.benchmarkGeneration!==generation)return;
      this.queuePrefix?.cancel('Errore chiusura misura');this.queuePrefix=null;this.measurement=null;
      this.timestampBatch?.close();this.timestampBatch=null;
      this.text('result',`Chiusura della misura fallita: ${error instanceof Error?error.message:String(error)}`);
      this.setButtonEnabled('benchmark',this.ready);this.setButtonEnabled('sustained',this.ready);
    }).finally(()=>{if(this.benchmarkCompletion===completion)this.benchmarkCompletion=null;this.refreshFrameExportAvailability();});
    this.benchmarkCompletion=completion;
  }
  private invalidate(reason: string) {
    this.frameExporter?.cancelPending(reason);
    const collecting=this.measurement&&!this.measurement.result&&!this.measurement.cancelReason;
    if(collecting||this.benchmarkCompletion){
      this.benchmarkGeneration++;this.measurement?.cancel(reason);this.measurement=null;
      this.queuePrefix?.cancel(reason);this.queuePrefix=null;
      this.timestampBatch?.close();this.timestampBatch=null;
      this.text('result',`Misura annullata: ${reason}.`);
      this.setButtonEnabled('benchmark',this.ready);this.setButtonEnabled('sustained',this.ready);
    }
    this.refreshFrameExportAvailability();
  }
  private setButtonEnabled(action:string,enabled:boolean){
    if(this.profiling&&enabled&&['benchmark','sustained','frame-capture'].includes(action))enabled=!this.frameExportBusy();
    this.emit({type:'enabled',action,enabled});
  }
  action(action:string){
    if(this.destroyed) return;
    if(action==='probe-reference'&&this.profiling){
      this.invalidate('Stato di confronto');this.simulationTime=60;this.forcingTime=0;this.weatherTime=0;this.paused=true;this.orbit=false;this.view.reset();this.viewFocus.copy(this.cloudCenter);this.windStrength=.55;this.gustStart=-100;this.dispersal.recover();this.dispersal.amount=0;this.skyMode='storm';this.weatherState.apply({type:'rain',amount:0});this.weatherState.rain=0;this.stormAuto=false;this.clearStorm();this.side=0;this.updateAtmosphere();this.state();this.emit({type:'stormState',auto:false});return;
    }
    if(action==='shadow-probe'){void this.readShadowTexels();return;}
    if(action==='benchmark'||action==='sustained'){this.startBenchmark(action==='benchmark'?30000:90000);return;}
    if(action==='new-cloud'){void this.newCloud();return;}
    this.invalidate('Controlli modificati');
    if(action==='center'){this.view.reset();this.orbit=false;this.viewFocus.copy(this.cloudCenter).add(this.drift.value);}
    if(action==='disperse'){this.dispersal.burst(this.forcingTime);}
    if(action==='condense'){this.dispersal.recover();}
    if(action==='gust'){this.gustStart=this.forcingTime;this.gustStrength=.5;}
    if(action==='lightning'){this.triggerFlash();return;}
    if(action==='flash-preview'){
      this.clearStorm();this.flashPreview=true;this.activeFlash=this.makeFlash((this.seed+7919)>>>0);return;
    }
    if(action==='storm-auto'){this.stormAuto=!this.stormAuto;this.nextFlash=this.weatherTime+1;this.emit({type:'stormState',auto:this.stormAuto});return;}
    if(action==='mature'){this.simulationTime=60;this.paused=false;this.clearStorm();}
    if(action==='pause'||action==='reset')this.clearStorm();
    if(action==='pause')this.paused=!this.paused;
    if(action==='orbit')this.orbit=!this.orbit;
    if(action==='light'){this.side=1-this.side;this.updateAtmosphere();}
    if(action==='reset'){this.view.reset();this.viewFocus.copy(this.cloudCenter);this.dispersal.recover();this.dispersal.amount=0;this.simulationTime=0;this.orbit=false;this.paused=false;this.side=0;this.updateAtmosphere();}
    this.state();
  }
  zoom(delta:number){this.invalidate('Avvicinamento modificato');this.view.zoom(delta);this.approachTime=-1000;this.emit({type:'view',approach:this.view.approach});}
  rotate(dx:number,dy:number,width:number,height:number){
    if(this.destroyed||this.deviceLost)return;
    this.invalidate('Camera ruotata');this.approachTime=-1000;this.view.drag(dx,dy,width,height);
    if(this.orbit){this.orbit=false;this.state();}
  }
  impulse(impulse:WeatherImpulse){
    if(this.destroyed||this.deviceLost)return;
    if(impulse.strength!==undefined&&!Number.isFinite(impulse.strength))return;
    const strength=Number.isFinite(impulse.strength)?Math.max(0,Math.min(1,impulse.strength!)):1;
    this.invalidate('Effetto atmosferico');
    if(impulse.type==='disperse')this.dispersal.burst(this.forcingTime,strength);
    if(impulse.type==='condense')this.dispersal.recover();
    if(impulse.type==='gust'){this.gustStart=this.forcingTime;this.gustStrength=strength*.5;}
    if(impulse.type==='lightning')this.triggerFlash();
  }
  change(name:string,value:string){
    if(this.destroyed) return;
    if(name==='ablation'&&this.profiling){this.invalidate('Sonda modificata');this.diagnosticName=value;this.diagnostic.value=Math.max(0,['full','density','cache','no-flow','no-detail','no-flash'].indexOf(value));this.configureIntegrator();return;}
    if(name==='family'){const families=['congestus','multicell','sheared'];if(families.includes(value))void this.newCloud(families.indexOf(value));return;}
    if(name==='wind'){this.invalidate('Vento modificato');const n=Number(value);if(Number.isFinite(n))this.windStrength=Math.max(0,Math.min(1,n/100));return;}
    if(name==='dispersion'){this.invalidate('Dispersione modificata');this.dispersal.set(Number(value)/100);return;}
    if(name==='speed'){this.invalidate('Velocità modificata');this.speed=[.5,1,2,4].includes(Number(value))?Number(value):1;return;}
    if(name==='zoom'){const next=Number(value)/100;if(Number.isFinite(next))this.zoom(next-this.view.approach);return;}
    if(name==='ground'){this.invalidate('Paesaggio modificato');this.ground.value=value==='0'?0:1;return;}
    if(name==='sky'){if(value in WEATHER_SCENES)this.atmosphere({type:'scene',scene:value as WeatherScene});return;}
    if(name==='rain'){this.atmosphere({type:'rain',amount:Number(value)/100});return;}
    if(name==='distance'){this.invalidate('Distanza del temporale modificata');this.stormDistance=[1,3,8].includes(Number(value))?Number(value):3;return;}
    if(name==='inflight'){this.invalidate('Gestione della coda modificata');this.frameLimit=[1,2].includes(Number(value))?Number(value):0;return;}
    this.invalidate('Qualità o risoluzione modificata');
    if(name==='quality'&&value in QUALITY)this.quality=this.profiling?value as Quality:'ultra';
    if(name==='output')this.outputMode=this.profiling?value:'screen';
    this.dirtySize=true;
  }
  resize(viewport:Viewport){this.viewport={...viewport};this.invalidate('Finestra ridimensionata');this.dirtySize=true;}
  visibility(visible:boolean){
    this.visible=visible;
    if(!visible){this.clearStorm();cancelAnimationFrame(this.raf);this.invalidate('Scheda nascosta');}
    else if((this.ready||this.regenerating)&&!this.destroyed&&!this.deviceLost){cancelAnimationFrame(this.raf);this.previous=0;this.intervals=[];this.raf=requestAnimationFrame(this.frame);}
    this.refreshFrameExportAvailability();
  }
  private releaseGPU(): Promise<void> {
    this.frameExporter?.dispose();this.frameExportDisplayRequest=null;
    this.terrainRequest.abort();
    this.cleanup ??= (async()=>{
      // Init can allocate Three's internal animation manager after teardown was requested.
      this.queuePrefix?.cancel('Rilascio GPU');this.queuePrefix=null;
      this.timestampBatch?.close();this.timestampBatch=null;
      await this.benchmarkCompletion;
      await this.initialization?.catch(()=>{});
      await this.timestampPromise;
      await this.queuePromise;
      await Promise.all(this.frameCompletions);
      this.releasingGPU=true;
      this.terrainRaster?.dispose();this.terrainRaster=null;this.terrainSample=terrainSurfaceSample;this.terrainCover?.dispose();this.terrainCover=null;
      this.skyRequest++;this.skyCache.destroy();this.rainTexture.dispose();this.cameraVolume=null;this.material?.dispose(); this.volume?.dispose();this.detailVolume?.dispose();this.sunsetVolume?.dispose();this.narrowCloudVolume?.dispose();this.densityR8Volume?.dispose();this.currentFlow.dispose();this.skyTexture.dispose();this.skyFromTexture.dispose();this.interpolateFlow.dispose(); this.renderer?.dispose(); this.device?.destroy();
    })();
    return this.cleanup;
  }
  destroy():Promise<void>{
    this.destroyed=true;this.ready=false;this.frameExporter?.dispose();cancelAnimationFrame(this.raf);this.worker?.terminate();this.worker=null;
    this.rejectVolume?.(new Error('Scena chiusa'));this.rejectVolume=null;
    this.invalidate('Scena chiusa');return this.releaseGPU();
  }
}
