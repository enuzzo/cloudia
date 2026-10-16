/** CPU macro-density diagnostics only. No rendered-image or visual acceptance. */
import {writeFileSync} from 'node:fs';
import {generateVolume,voxelCenter,cloudParameters,iceHeights,BOUNDS_SIZE,VOLUME_RESOLUTION,DETAIL_RESOLUTION} from '../src/cumulonimbus/volume';

const output=process.argv[2],size=Number(process.argv[3]??64);
if(!output||!Number.isInteger(size)||size<24||size>VOLUME_RESOLUTION) throw new Error('Usage: bun scripts/qa-morphology.ts <output.json> [resolution 24..256] [seeds...]');
const seeds=process.argv.slice(4).map(Number);
if(!seeds.length) seeds.push(72,73,74,1571198069);
if(!seeds.every(Number.isSafeInteger)) throw new Error('Seeds must be safe integers');
const cases=[];
for(const seed of seeds) {
  const begin=performance.now(),volume=generateVolume(size,seed),generationMs=performance.now()-begin;
  const {data}=volume,n=size**3,visited=new Uint8Array(n),queue=new Uint32Array(n);
  const sections=Array.from({length:size},(_,y)=>({height:voxelCenter(y,1,size),mass:0,firstX:0,firstZ:0,occupied:0,dense:0}));
  let mass=0,occupied=0,bulkMass=0,largestBulkMass=0,bulkComponents=0;
  const first=[0,0,0],second=[0,0,0],denseThreshold=.16*255;
  for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const d=data[((z*size+y)*size+x)*4]/255,p=[voxelCenter(x,0,size),sections[y].height,voxelCenter(z,2,size)];
    mass+=d;sections[y].mass+=d;sections[y].firstX+=d*p[0];sections[y].firstZ+=d*p[2];
    if(d>0) {occupied++;sections[y].occupied++;}
    if(d*255>denseThreshold) {bulkMass+=d;sections[y].dense++;}
    for(let a=0;a<3;a++) {first[a]+=d*p[a];second[a]+=d*p[a]**2;}
  }
  // Face-connected bulk components distinguish a replenished body from isolated
  // floating billows. Thin detached wisps remain outside this bulk criterion.
  for(let i=0;i<n;i++) {
    if(visited[i]||data[i*4]<=denseThreshold) continue;
    let read=0,write=1,componentMass=0;queue[0]=i;visited[i]=1;bulkComponents++;
    while(read<write) {
      const index=queue[read++],x=index%size,y=Math.floor(index/size)%size,z=Math.floor(index/(size*size));
      componentMass+=data[index*4]/255;
      const neighbors=[x?index-1:-1,x<size-1?index+1:-1,y?index-size:-1,y<size-1?index+size:-1,z?index-size*size:-1,z<size-1?index+size*size:-1];
      for(const neighbor of neighbors) if(neighbor>=0&&!visited[neighbor]&&data[neighbor*4]>denseThreshold) {visited[neighbor]=1;queue[write++]=neighbor;}
    }
    largestBulkMass=Math.max(largestBulkMass,componentMass);
  }
  const centroid=first.map(v=>v/mass),cellVolume=BOUNDS_SIZE.reduce((a,b)=>a*b,1)/n;
  const bandCentroidX=(minY:number,maxY:number)=>{
    const band=sections.filter(s=>s.height>=minY&&s.height<=maxY);
    return band.reduce((sum,s)=>sum+s.firstX,0)/band.reduce((sum,s)=>sum+s.mass,0);
  };
  const lowerCentroidX=bandCentroidX(.9,2),upperCentroidX=bandCentroidX(3.5,Infinity);
  const upperProfile=Array.from({length:size},()=>({x:0,height:0}));
  for(let x=0;x<size;x++) {
    upperProfile[x].x=voxelCenter(x,0,size);
    for(let y=0;y<size;y++) for(let z=0;z<size;z++) if(data[((z*size+y)*size+x)*4]>denseThreshold) upperProfile[x].height=sections[y].height;
  }
  cases.push({seed,parameters:cloudParameters(seed),ice:iceHeights(seed),macroResolution:size,detailResolution:volume.detail.size,
    generationMs,occupiedFraction:occupied/n,integratedDensity:mass*cellVolume,centroid,
    spread:second.map((v,a)=>Math.sqrt(Math.max(0,v/mass-centroid[a]**2))),
    lean:{lowerBand:[.9,2],upperBand:[3.5,null],lowerCentroidX,upperCentroidX,displacementX:upperCentroidX-lowerCentroidX},
    bulk:{threshold:denseThreshold/255,components:bulkComponents,largestMassFraction:largestBulkMass/bulkMass},
    sections:sections.map(({firstX,firstZ,...s})=>({...s,mass:s.mass*cellVolume,centroidX:s.mass?firstX/s.mass:null,centroidZ:s.mass?firstZ/s.mass:null,area:s.occupied*BOUNDS_SIZE[0]*BOUNDS_SIZE[2]/size**2,denseArea:s.dense*BOUNDS_SIZE[0]*BOUNDS_SIZE[2]/size**2})),upperProfile});
  console.log(JSON.stringify({seed,size,generationMs,bulkConnectedFraction:largestBulkMass/bulkMass,integratedDensity:mass*cellVolume,centroid}));
}
writeFileSync(output,JSON.stringify({date:new Date().toISOString(),method:'CPU macro-density moments, vertical sections and six-neighbor bulk connectivity. Diagnostic sampling only; no browser, GPU or visual claim.',configuredQuality:{macro:VOLUME_RESOLUTION,detail:DETAIL_RESOLUTION},cases},null,2)+'\n');
