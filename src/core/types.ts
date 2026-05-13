export type CloudiaMode = "flow" | "cumulus";
export type TimeOfDay = "dawn" | "afternoon" | "sunset" | "night";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface CloudiaPalette {
  skyTop: RgbColor;
  skyMid: RgbColor;
  horizon: RgbColor;
  cloudLight: RgbColor;
  cloudShadow: RgbColor;
}

export interface CameraPreset {
  speed: number;
  height: number;
  horizon: number;
  fov: number;
  drift: number;
}

export interface CloudPreset {
  density: number;
  coverage: number;
  softness: number;
  noiseScale: number;
  detailScale: number;
  thickness: number;
  edgeFalloff: number;
  steps: number;
  lightSteps: number;
}

export interface LightingPreset {
  sunX: number;
  sunY: number;
  sunZ: number;
  absorption: number;
  scattering: number;
  highlight: number;
  shadowTint: number;
}

export interface CumulusPreset {
  baseRadius: number;
  compression: number;
  expansion: number;
  burst: number;
  darkness: number;
  stormDarkening: number;
}

export interface WeatherPreset {
  storm: number;
  rain: number;
  droplets: number;
  mist: number;
  blur: number;
  easing: number;
}

export interface InputPreset {
  handTracking: boolean;
  smoothing: number;
  opennessThreshold: number;
  compressionThreshold: number;
  stormHoldMs: number;
}

export interface EmbedPreset {
  autoplay: boolean;
  handTracking: boolean;
  reducedMotion: boolean;
  pixelRatioCap: number;
}

export interface CloudiaPreset {
  schemaVersion: 1;
  mode: CloudiaMode;
  timeOfDay: TimeOfDay;
  palette: CloudiaPalette;
  camera: CameraPreset;
  cloud: CloudPreset;
  lighting: LightingPreset;
  cumulus: CumulusPreset;
  weather: WeatherPreset;
  input: InputPreset;
  embed: EmbedPreset;
}
