import * as THREE from "three";
import type { CloudiaPreset } from "../core/types";
import { cloudFragmentShader } from "./cloudFragment";
import { cloudVertexShader } from "./cloudVertex";

export interface CloudEngineRuntime {
  storm: number;
  compression: number;
  expansion: number;
}

export class CloudEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly resizeObserver: ResizeObserver;
  private animationId = 0;
  private startedAt = performance.now();
  private runtime: CloudEngineRuntime = { storm: 0, compression: 0, expansion: 0 };

  constructor(
    private readonly host: HTMLElement,
    preset: CloudiaPreset,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, preset.embed.pixelRatioCap));
    this.host.appendChild(this.renderer.domElement);

    this.material = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMode: { value: preset.mode === "flow" ? 0 : 1 },
        uStorm: { value: 0 },
        uCompression: { value: 0 },
        uExpansion: { value: preset.cumulus.expansion },
        uSkyTop: { value: this.color(preset.palette.skyTop) },
        uSkyMid: { value: this.color(preset.palette.skyMid) },
        uHorizon: { value: this.color(preset.palette.horizon) },
        uCloudLight: { value: this.color(preset.palette.cloudLight) },
        uCloudShadow: { value: this.color(preset.palette.cloudShadow) },
      },
      depthWrite: false,
      depthTest: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(quad);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
  }

  start(): void {
    this.startedAt = performance.now();
    const frame = () => {
      this.animationId = requestAnimationFrame(frame);
      this.render();
    };
    frame();
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  setPreset(preset: CloudiaPreset): void {
    this.material.uniforms.uMode.value = preset.mode === "flow" ? 0 : 1;
    this.material.uniforms.uExpansion.value = preset.cumulus.expansion;
  }

  setRuntime(runtime: Partial<CloudEngineRuntime>): void {
    this.runtime = { ...this.runtime, ...runtime };
  }

  private render(): void {
    this.material.uniforms.uTime.value = (performance.now() - this.startedAt) / 1000;
    this.material.uniforms.uStorm.value = this.runtime.storm;
    this.material.uniforms.uCompression.value = this.runtime.compression;
    this.material.uniforms.uExpansion.value = this.runtime.expansion;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  private color(color: { r: number; g: number; b: number }): THREE.Color {
    return new THREE.Color(color.r, color.g, color.b);
  }
}
