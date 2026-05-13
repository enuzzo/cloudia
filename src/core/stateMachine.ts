import { clamp01, damp } from "./easing";

export interface WeatherRuntimeState {
  storm: number;
  rain: number;
  droplets: number;
  mist: number;
  blur: number;
  burst?: number;
}

export interface WeatherIntent {
  stormIntent: number;
  compression: number;
  release: boolean;
}

export function updateWeatherState(
  current: WeatherRuntimeState,
  intent: WeatherIntent,
  easing: number,
): WeatherRuntimeState {
  const stormTarget = clamp01(intent.stormIntent);
  const storm = damp(current.storm, stormTarget, easing);
  const burstTarget = intent.release ? clamp01(1 - intent.compression) : 0;

  return {
    storm,
    rain: damp(current.rain, stormTarget, easing * 1.2),
    droplets: damp(current.droplets, stormTarget, easing * 1.1),
    mist: damp(current.mist, Math.max(stormTarget, burstTarget * 0.4), easing),
    blur: damp(current.blur, stormTarget * 0.75, easing),
    burst: damp(current.burst ?? 0, burstTarget, easing),
  };
}
