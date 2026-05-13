# Cloudia Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cloudia Lab as a modular Vite + Three.js WebGL prototype with Flow clouds, Cumulus interaction, weather effects, optional MediaPipe hand tracking, preset export, and a future-ready embed adapter.

**Architecture:** Keep the visual engine independent from the lab UI. The app state flows from input controllers into semantic gesture/weather state, then into shader uniforms and overlay layers. The embed adapter reuses the engine without React, lil-gui, or lab chrome.

**Tech Stack:** Vite, TypeScript, Three.js, GLSL-in-TS strings, lil-gui, MediaPipe Tasks Vision, Vitest, Browser plugin QA.

---

## File Structure

Create and maintain this structure:

```text
cloudia/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  src/
    main.ts
    styles.css
    core/
      types.ts
      defaultPreset.ts
      easing.ts
      presetStore.ts
      stateMachine.ts
      easing.test.ts
      presetStore.test.ts
      stateMachine.test.ts
    input/
      gestureMapper.ts
      handTracker.ts
      inputController.ts
      gestureMapper.test.ts
    render/
      CloudEngine.ts
      shaderChunks.ts
      cloudVertex.ts
      cloudFragment.ts
    weather/
      WeatherLayer.ts
      WeatherLayer.test.ts
    lab/
      LabApp.ts
      LabUI.ts
    embed/
      CloudiaHero.ts
      CloudiaHero.test.ts
  examples/
    elementor-hero.html
  scripts/
    qa-browser-smoke.mjs
  docs/
    VISUAL_QA.md
```

Responsibility map:

- `core/`: serializable state, preset shape, math helpers, weather transitions.
- `input/`: pointer/touch/hand tracking normalization and gesture semantics.
- `render/`: Three.js setup and shader code. No GUI code here.
- `weather/`: overlay canvas for rain, droplets, mist, and storm fog.
- `lab/`: browser lab composition and tuning UI.
- `embed/`: minimal public API for WordPress/Elementor-style mounting.
- `scripts/`: QA helpers that can run against a local dev server.
- `docs/`: durable project notes, visual QA ledgers, and gotchas.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Create package scripts and dependencies**

Add this `package.json`:

```json
{
  "name": "cloudia",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "qa:browser": "node scripts/qa-browser-smoke.mjs"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.22-rc.20250304",
    "lil-gui": "^0.20.0",
    "three": "^0.181.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Add TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts", "scripts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add first HTML and CSS shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Cloudia Lab: volumetric WebGL clouds with hand-tracked weather control."
    />
    <title>Cloudia Lab</title>
  </head>
  <body>
    <main id="cloudia-lab" class="cloudia-lab" data-testid="cloudia-lab">
      <div class="cloudia-stage" data-testid="cloudia-stage"></div>
      <section class="cloudia-panel" aria-label="Cloudia lab status">
        <p class="cloudia-kicker">Cloudia Lab</p>
        <h1>Volumetric weather, currently pretending to be a UI.</h1>
        <p id="cloudia-status">Booting shader lab...</p>
      </section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #0b1020;
  color: #f8fbff;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-width: 320px;
  min-height: 100%;
  overflow: hidden;
}

body {
  min-height: 100vh;
}

.cloudia-lab {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(35, 67, 133, 0.5), rgba(18, 12, 38, 0.95)),
    #11182d;
}

.cloudia-stage {
  position: absolute;
  inset: 0;
}

.cloudia-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.cloudia-panel {
  position: absolute;
  left: clamp(18px, 3vw, 42px);
  bottom: clamp(18px, 3vw, 42px);
  width: min(420px, calc(100vw - 36px));
  color: #f7fbff;
  text-shadow: 0 1px 18px rgba(8, 12, 24, 0.55);
  pointer-events: none;
}

.cloudia-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  opacity: 0.72;
}

.cloudia-panel h1 {
  margin: 0 0 12px;
  font-size: clamp(24px, 4vw, 52px);
  line-height: 1.02;
  letter-spacing: 0;
}

.cloudia-panel p:last-child {
  margin: 0;
  max-width: 34rem;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(247, 251, 255, 0.78);
}
```

- [ ] **Step 4: Add minimal entry**

Create `src/main.ts`:

```ts
import "./styles.css";

const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");
if (status) {
  status.textContent = "Lab shell ready. The clouds are still paperwork.";
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
bun install
```

Expected: dependencies are installed and `bun.lock` is created.

- [ ] **Step 6: Verify scaffold**

Run:

```bash
bun run typecheck
bun run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock tsconfig.json vite.config.ts vitest.config.ts index.html src/main.ts src/styles.css docs/WORKLOG.md
git commit -m "chore: scaffold cloudia lab"
```

## Task 2: Core Types, Presets, And Serialization

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/defaultPreset.ts`
- Create: `src/core/presetStore.ts`
- Create: `src/core/presetStore.test.ts`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Write failing preset tests**

Create `src/core/presetStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultPreset } from "./defaultPreset";
import { exportPresetJson, importPresetJson } from "./presetStore";

describe("presetStore", () => {
  it("exports stable pretty JSON for the active preset", () => {
    const json = exportPresetJson(defaultPreset);
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain('"mode": "flow"');
    expect(json.endsWith("\n")).toBe(true);
  });

  it("round-trips a preset without losing nested weather settings", () => {
    const json = exportPresetJson({
      ...defaultPreset,
      weather: { ...defaultPreset.weather, storm: 0.72, mist: 0.44 },
    });
    const result = importPresetJson(json);
    expect(result.weather.storm).toBe(0.72);
    expect(result.weather.mist).toBe(0.44);
  });

  it("rejects preset JSON with an unsupported schema version", () => {
    const badJson = JSON.stringify({ ...defaultPreset, schemaVersion: 99 });
    expect(() => importPresetJson(badJson)).toThrow("Unsupported Cloudia preset schema");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test src/core/presetStore.test.ts
```

Expected: FAIL because `defaultPreset` or `presetStore` does not exist.

- [ ] **Step 3: Add complete core types**

Create `src/core/types.ts`:

```ts
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
```

- [ ] **Step 4: Add default preset**

Create `src/core/defaultPreset.ts`:

```ts
import type { CloudiaPreset } from "./types";

export const defaultPreset: CloudiaPreset = {
  schemaVersion: 1,
  mode: "flow",
  timeOfDay: "sunset",
  palette: {
    skyTop: { r: 0.34, g: 0.5, b: 0.92 },
    skyMid: { r: 0.78, g: 0.64, b: 0.92 },
    horizon: { r: 1.0, g: 0.74, b: 0.62 },
    cloudLight: { r: 1.0, g: 0.84, b: 0.78 },
    cloudShadow: { r: 0.45, g: 0.44, b: 0.72 },
  },
  camera: {
    speed: 0.055,
    height: 0.34,
    horizon: 0.42,
    fov: 1.1,
    drift: 0.12,
  },
  cloud: {
    density: 0.62,
    coverage: 0.48,
    softness: 0.58,
    noiseScale: 1.55,
    detailScale: 4.2,
    thickness: 0.42,
    edgeFalloff: 0.55,
    steps: 72,
    lightSteps: 6,
  },
  lighting: {
    sunX: -0.42,
    sunY: 0.55,
    sunZ: 0.72,
    absorption: 1.35,
    scattering: 0.58,
    highlight: 0.84,
    shadowTint: 0.46,
  },
  cumulus: {
    baseRadius: 0.38,
    compression: 0,
    expansion: 0.2,
    burst: 0,
    darkness: 0.12,
    stormDarkening: 0.65,
  },
  weather: {
    storm: 0,
    rain: 0,
    droplets: 0,
    mist: 0,
    blur: 0,
    easing: 0.08,
  },
  input: {
    handTracking: false,
    smoothing: 0.22,
    opennessThreshold: 0.62,
    compressionThreshold: 0.42,
    stormHoldMs: 420,
  },
  embed: {
    autoplay: true,
    handTracking: false,
    reducedMotion: false,
    pixelRatioCap: 1.75,
  },
};
```

- [ ] **Step 5: Add preset serialization**

Create `src/core/presetStore.ts`:

```ts
import type { CloudiaPreset } from "./types";

const SUPPORTED_SCHEMA_VERSION = 1;

export function exportPresetJson(preset: CloudiaPreset): string {
  return `${JSON.stringify(preset, null, 2)}\n`;
}

export function importPresetJson(json: string): CloudiaPreset {
  const parsed = JSON.parse(json) as Partial<CloudiaPreset>;
  if (parsed.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Cloudia preset schema: ${String(parsed.schemaVersion)}`,
    );
  }
  return parsed as CloudiaPreset;
}

export async function copyPresetJson(preset: CloudiaPreset): Promise<string> {
  const json = exportPresetJson(preset);
  await navigator.clipboard.writeText(json);
  return json;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
bun run test src/core/presetStore.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/defaultPreset.ts src/core/presetStore.ts src/core/presetStore.test.ts docs/WORKLOG.md
git commit -m "feat: add cloudia preset store"
```

## Task 3: Gesture And Weather State Tests

**Files:**
- Create: `src/core/easing.ts`
- Create: `src/core/easing.test.ts`
- Create: `src/core/stateMachine.ts`
- Create: `src/core/stateMachine.test.ts`
- Create: `src/input/gestureMapper.ts`
- Create: `src/input/gestureMapper.test.ts`
- Modify: `docs/GOTCHAS.md`

- [ ] **Step 1: Write failing easing tests**

Create `src/core/easing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { damp, clamp01 } from "./easing";

describe("easing", () => {
  it("clamps values to the 0..1 range", () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(0.6)).toBe(0.6);
    expect(clamp01(1.8)).toBe(1);
  });

  it("damps toward a target without overshooting", () => {
    expect(damp(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(damp(0.9, 0.1, 0.5)).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Write failing gesture tests**

Create `src/input/gestureMapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapHandLandmarks } from "./gestureMapper";

const openHand = [
  [0.5, 0.8], [0.45, 0.65], [0.42, 0.5], [0.4, 0.36], [0.38, 0.22],
  [0.5, 0.62], [0.5, 0.44], [0.5, 0.3], [0.5, 0.16],
  [0.56, 0.64], [0.58, 0.46], [0.6, 0.32], [0.62, 0.18],
  [0.61, 0.68], [0.66, 0.52], [0.7, 0.4], [0.74, 0.28],
  [0.42, 0.69], [0.34, 0.58], [0.28, 0.5], [0.22, 0.42],
] as const;

const fist = openHand.map(([x, y], index) => {
  if ([4, 8, 12, 16, 20].includes(index)) return [0.5, 0.62] as const;
  return [x, y] as const;
});

describe("gestureMapper", () => {
  it("maps an open hand to high openness and low compression", () => {
    const result = mapHandLandmarks(openHand, "Right");
    expect(result.openness).toBeGreaterThan(0.7);
    expect(result.compression).toBeLessThan(0.35);
    expect(result.leftHandClosed).toBe(false);
  });

  it("maps a left fist to storm intent", () => {
    const result = mapHandLandmarks(fist, "Left");
    expect(result.compression).toBeGreaterThan(0.65);
    expect(result.leftHandClosed).toBe(true);
    expect(result.stormIntent).toBeGreaterThan(0.65);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
bun run test src/core/easing.test.ts src/input/gestureMapper.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Add easing helpers**

Create `src/core/easing.ts`:

```ts
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function damp(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp01(amount);
}

export function remap01(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
}
```

- [ ] **Step 5: Add gesture mapper**

Create `src/input/gestureMapper.ts`:

```ts
import { clamp01, remap01 } from "../core/easing";

export type Handedness = "Left" | "Right" | "Unknown";
export type Point2 = readonly [number, number];

export interface GestureState {
  handPresence: number;
  primaryX: number;
  primaryY: number;
  openness: number;
  compression: number;
  leftHandClosed: boolean;
  stormIntent: number;
}

const TIP_INDICES = [4, 8, 12, 16, 20] as const;
const PALM_INDICES = [0, 5, 9, 13, 17] as const;

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function average(points: readonly Point2[]): Point2 {
  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

export function mapHandLandmarks(
  landmarks: readonly Point2[],
  handedness: Handedness,
): GestureState {
  if (landmarks.length < 21) {
    return {
      handPresence: 0,
      primaryX: 0.5,
      primaryY: 0.5,
      openness: 0,
      compression: 0,
      leftHandClosed: false,
      stormIntent: 0,
    };
  }

  const palm = average(PALM_INDICES.map((index) => landmarks[index]));
  const wrist = landmarks[0];
  const palmScale = Math.max(0.001, distance(wrist, landmarks[9]));
  const tipDistance =
    TIP_INDICES.reduce((total, index) => total + distance(landmarks[index], palm), 0) /
    TIP_INDICES.length;
  const openness = remap01(tipDistance / palmScale, 0.7, 2.15);
  const compression = clamp01(1 - openness);
  const leftHandClosed = handedness === "Left" && compression > 0.62;

  return {
    handPresence: 1,
    primaryX: clamp01(palm[0]),
    primaryY: clamp01(palm[1]),
    openness,
    compression,
    leftHandClosed,
    stormIntent: leftHandClosed ? compression : 0,
  };
}
```

- [ ] **Step 6: Add state machine tests**

Create `src/core/stateMachine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateWeatherState } from "./stateMachine";

describe("stateMachine", () => {
  it("raises storm values when storm intent is active", () => {
    const next = updateWeatherState(
      { storm: 0, rain: 0, droplets: 0, mist: 0, blur: 0 },
      { stormIntent: 1, compression: 0.9, release: false },
      0.2,
    );
    expect(next.storm).toBeGreaterThan(0);
    expect(next.rain).toBeGreaterThan(0);
    expect(next.droplets).toBeGreaterThan(0);
  });

  it("creates a burst when a compressed cloud is released", () => {
    const next = updateWeatherState(
      { storm: 0, rain: 0, droplets: 0, mist: 0, blur: 0 },
      { stormIntent: 0, compression: 0.1, release: true },
      0.3,
    );
    expect(next.burst).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Add weather state implementation**

Create `src/core/stateMachine.ts`:

```ts
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
```

- [ ] **Step 8: Run tests**

Run:

```bash
bun run test src/core/easing.test.ts src/input/gestureMapper.test.ts src/core/stateMachine.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/core/easing.ts src/core/easing.test.ts src/input/gestureMapper.ts src/input/gestureMapper.test.ts src/core/stateMachine.ts src/core/stateMachine.test.ts docs/GOTCHAS.md
git commit -m "feat: add gesture weather state"
```

## Task 4: Render Engine Baseline

**Files:**
- Create: `src/render/cloudVertex.ts`
- Create: `src/render/cloudFragment.ts`
- Create: `src/render/CloudEngine.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Add vertex shader**

Create `src/render/cloudVertex.ts`:

```ts
export const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
```

- [ ] **Step 2: Add baseline fragment shader**

Create `src/render/cloudFragment.ts`:

```ts
export const cloudFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMode;
  uniform float uStorm;
  uniform float uCompression;
  uniform float uExpansion;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uCloudLight;
  uniform vec3 uCloudShadow;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv * 2.0 - 1.0;
    centered.x *= uResolution.x / max(1.0, uResolution.y);

    vec3 sky = mix(uHorizon, uSkyMid, smoothstep(0.08, 0.72, uv.y));
    sky = mix(sky, uSkyTop, smoothstep(0.45, 1.0, uv.y));

    vec3 p = vec3(centered.x * 1.4, uv.y * 1.5, uTime * 0.045);
    float deck = smoothstep(0.66, 0.18, abs(uv.y - 0.28));
    float detail = fbm(p * vec3(1.2, 2.6, 1.0));
    float cloud = smoothstep(0.36, 0.84, detail + deck * 0.58);

    if (uMode == 1) {
      float radius = 0.45 - uCompression * 0.16 + uExpansion * 0.2;
      float blob = 1.0 - smoothstep(radius, radius + 0.22, length(centered));
      float fluff = fbm(vec3(centered * 2.2, uTime * 0.04));
      cloud = smoothstep(0.35, 0.82, blob + fluff * 0.55);
    }

    vec3 cloudColor = mix(uCloudShadow, uCloudLight, smoothstep(0.32, 1.0, cloud));
    cloudColor = mix(cloudColor, vec3(0.14, 0.16, 0.24), uStorm * 0.52);
    vec3 color = mix(sky, cloudColor, cloud * 0.82);

    gl_FragColor = vec4(color, 1.0);
  }
`;
```

- [ ] **Step 3: Add CloudEngine**

Create `src/render/CloudEngine.ts`:

```ts
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
    private preset: CloudiaPreset,
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
    this.preset = preset;
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
```

- [ ] **Step 4: Mount engine in main**

Replace `src/main.ts` with:

```ts
import "./styles.css";
import { defaultPreset } from "./core/defaultPreset";
import { CloudEngine } from "./render/CloudEngine";

const stage = document.querySelector<HTMLElement>("[data-testid='cloudia-stage']");
const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");

if (!stage) {
  throw new Error("Cloudia stage element is missing");
}

const engine = new CloudEngine(stage, defaultPreset);
engine.start();

if (status) {
  status.textContent = "Flow baseline running. The cloud deck has entered the chat.";
}

window.addEventListener("beforeunload", () => engine.destroy());
```

- [ ] **Step 5: Verify build**

Run:

```bash
bun run typecheck
bun run build
```

Expected: both exit 0.

- [ ] **Step 6: Browser visual smoke**

Run dev server:

```bash
bun run dev
```

Open `http://127.0.0.1:5173` with the Browser plugin.

Checks:

- Page title is `Cloudia Lab`.
- Canvas exists inside `[data-testid='cloudia-stage']`.
- Console has no relevant errors.
- Screenshot is nonblank and shows pastel sky/cloud colors.

- [ ] **Step 7: Commit**

```bash
git add src/render/cloudVertex.ts src/render/cloudFragment.ts src/render/CloudEngine.ts src/main.ts src/styles.css docs/WORKLOG.md
git commit -m "feat: render cloudia shader baseline"
```

## Task 5: Lab UI And Preset Controls

**Files:**
- Create: `src/lab/LabUI.ts`
- Create: `src/lab/LabApp.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Add LabUI**

Create `src/lab/LabUI.ts`:

```ts
import GUI from "lil-gui";
import type { CloudiaPreset } from "../core/types";
import { copyPresetJson } from "../core/presetStore";

export interface LabUIEvents {
  onPresetChanged: (preset: CloudiaPreset) => void;
  onStormChanged: (storm: number) => void;
  onCompressionChanged: (compression: number) => void;
}

export class LabUI {
  private readonly gui = new GUI({ title: "Cloudia" });

  constructor(
    private readonly preset: CloudiaPreset,
    private readonly events: LabUIEvents,
  ) {
    this.gui.add(this.preset, "mode", ["flow", "cumulus"]).name("Mode").onChange(() => {
      this.events.onPresetChanged(this.preset);
    });

    const cloud = this.gui.addFolder("Cloud");
    cloud.add(this.preset.cloud, "density", 0, 1, 0.01).onChange(() => {
      this.events.onPresetChanged(this.preset);
    });
    cloud.add(this.preset.cloud, "coverage", 0, 1, 0.01).onChange(() => {
      this.events.onPresetChanged(this.preset);
    });

    const runtime = {
      storm: this.preset.weather.storm,
      compression: this.preset.cumulus.compression,
      copyParams: async () => {
        await copyPresetJson(this.preset);
      },
    };

    const weather = this.gui.addFolder("Runtime");
    weather.add(runtime, "storm", 0, 1, 0.01).onChange((value: number) => {
      this.events.onStormChanged(value);
    });
    weather.add(runtime, "compression", 0, 1, 0.01).onChange((value: number) => {
      this.events.onCompressionChanged(value);
    });

    this.gui.add(runtime, "copyParams").name("Copy params JSON");
  }

  destroy(): void {
    this.gui.destroy();
  }
}
```

- [ ] **Step 2: Add LabApp composition**

Create `src/lab/LabApp.ts`:

```ts
import { defaultPreset } from "../core/defaultPreset";
import type { CloudiaPreset } from "../core/types";
import { CloudEngine } from "../render/CloudEngine";
import { LabUI } from "./LabUI";

export class LabApp {
  private readonly engine: CloudEngine;
  private readonly ui: LabUI;
  private preset: CloudiaPreset = structuredClone(defaultPreset);

  constructor(private readonly stage: HTMLElement) {
    this.engine = new CloudEngine(stage, this.preset);
    this.ui = new LabUI(this.preset, {
      onPresetChanged: (preset) => {
        this.preset = structuredClone(preset);
        this.engine.setPreset(this.preset);
      },
      onStormChanged: (storm) => {
        this.engine.setRuntime({ storm });
      },
      onCompressionChanged: (compression) => {
        this.engine.setRuntime({ compression, expansion: 1 - compression * 0.5 });
      },
    });
  }

  start(): void {
    this.engine.start();
  }

  destroy(): void {
    this.ui.destroy();
    this.engine.destroy();
  }
}
```

- [ ] **Step 3: Replace main with LabApp**

Replace `src/main.ts` with:

```ts
import "./styles.css";
import { LabApp } from "./lab/LabApp";

const stage = document.querySelector<HTMLElement>("[data-testid='cloudia-stage']");
const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");

if (!stage) {
  throw new Error("Cloudia stage element is missing");
}

const app = new LabApp(stage);
app.start();

if (status) {
  status.textContent = "Lab running. Tune gently; the atmosphere is listening.";
}

window.addEventListener("beforeunload", () => app.destroy());
```

- [ ] **Step 4: Verify controls compile**

Run:

```bash
bun run typecheck
bun run build
```

Expected: both exit 0.

- [ ] **Step 5: Browser interaction QA**

With dev server running, verify:

- Mode dropdown switches between `flow` and `cumulus`.
- Storm slider darkens the render.
- Compression slider changes Cumulus shape in `cumulus` mode.
- Copy params writes valid JSON to clipboard.

- [ ] **Step 6: Commit**

```bash
git add src/lab/LabUI.ts src/lab/LabApp.ts src/main.ts src/styles.css docs/WORKLOG.md
git commit -m "feat: add cloudia lab controls"
```

## Task 6: Flow Visual Upgrade

**Files:**
- Modify: `src/render/cloudFragment.ts`
- Modify: `src/render/CloudEngine.ts`
- Modify: `src/core/defaultPreset.ts`
- Create: `docs/VISUAL_QA.md`
- Modify: `docs/GOTCHAS.md`

- [ ] **Step 1: Add visual QA ledger**

Create `docs/VISUAL_QA.md`:

```md
# Cloudia Visual QA

This document records visual comparisons against the accepted benchmark.

## Benchmark

- Flow benchmark: provided screenshot of Maxime Heckel-style forward cloud deck.
- Key requirements: forward horizontal travel, pastel sky, soft horizon, cloud plane depth, creamy cloud edges.

## QA Entries

### M2 Flow Cloud Deck

Status: pending

Comparison points:

- Forward motion:
- Horizon placement:
- Pastel palette:
- Cloud volume/depth:
- Edge softness:
- Performance:
- Desktop screenshot:
- Hero 60vh screenshot:
```

- [ ] **Step 2: Upgrade shader density functions**

In `src/render/cloudFragment.ts`, replace the baseline `main` cloud density with a raymarch loop:

```glsl
float cloudDensity(vec3 p) {
  float base = fbm(p * 0.85);
  float detail = fbm(p * 2.8 + vec3(13.1, 7.2, 2.3)) * 0.42;
  float deckShape = smoothstep(-0.22, 0.18, p.y) * (1.0 - smoothstep(0.28, 0.62, p.y));
  return smoothstep(0.42, 0.78, base + detail + deckShape * 0.55);
}

vec4 marchClouds(vec3 ro, vec3 rd) {
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float t = 0.0;

  for (int i = 0; i < 72; i++) {
    vec3 p = ro + rd * t;
    float d = cloudDensity(p);
    float light = smoothstep(0.15, 1.0, d + p.y * 0.6);
    vec3 sampleColor = mix(uCloudShadow, uCloudLight, light);
    float sampleAlpha = d * 0.045 * (1.0 - alpha);
    color += sampleColor * sampleAlpha;
    alpha += sampleAlpha;
    t += 0.035;
    if (alpha > 0.96) break;
  }

  return vec4(color, alpha);
}
```

Then set Flow `main` to build a ray origin and direction:

```glsl
vec3 ro = vec3(centered.x * 0.12, 0.24, uTime * 0.09);
vec3 rd = normalize(vec3(centered.x * 0.55, centered.y * 0.22 - 0.05, 1.0));
vec4 marched = marchClouds(ro, rd);
vec3 color = mix(sky, marched.rgb, marched.a);
```

- [ ] **Step 3: Expose camera speed uniform**

Add uniforms to `CloudEngine.ts`:

```ts
uCameraSpeed: { value: preset.camera.speed },
uHorizon: { value: preset.camera.horizon },
```

Update `setPreset` to refresh them:

```ts
this.material.uniforms.uCameraSpeed.value = preset.camera.speed;
this.material.uniforms.uHorizon.value = preset.camera.horizon;
```

- [ ] **Step 4: Run build**

Run:

```bash
bun run typecheck
bun run build
```

Expected: exit 0.

- [ ] **Step 5: Browser visual QA**

Use Browser plugin at `http://127.0.0.1:5173`.

Record in `docs/VISUAL_QA.md`:

- Screenshot path or Browser screenshot reference.
- Whether forward motion reads correctly.
- Whether horizon sits close to the benchmark.
- Whether cloud edge quality is acceptable.
- Any visible drift from the benchmark.

- [ ] **Step 6: Commit**

```bash
git add src/render/cloudFragment.ts src/render/CloudEngine.ts src/core/defaultPreset.ts docs/VISUAL_QA.md docs/GOTCHAS.md
git commit -m "feat: improve flow cloud deck"
```

## Task 7: Cumulus Mode And Pointer Input

**Files:**
- Create: `src/input/inputController.ts`
- Modify: `src/lab/LabApp.ts`
- Modify: `src/render/cloudFragment.ts`
- Modify: `src/core/stateMachine.ts`
- Modify: `docs/VISUAL_QA.md`

- [ ] **Step 1: Add pointer input controller**

Create `src/input/inputController.ts`:

```ts
import type { GestureState } from "./gestureMapper";

export class InputController {
  private pointerDown = false;
  private x = 0.5;
  private y = 0.5;

  constructor(private readonly target: HTMLElement) {
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointerleave", this.onPointerUp);
  }

  destroy(): void {
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointerleave", this.onPointerUp);
  }

  getGesture(): GestureState {
    const compression = this.pointerDown ? 0.85 : 0.05;
    return {
      handPresence: 1,
      primaryX: this.x,
      primaryY: this.y,
      openness: 1 - compression,
      compression,
      leftHandClosed: false,
      stormIntent: 0,
    };
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.target.getBoundingClientRect();
    this.x = (event.clientX - rect.left) / rect.width;
    this.y = (event.clientY - rect.top) / rect.height;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = true;
    this.onPointerMove(event);
  };

  private readonly onPointerUp = (): void => {
    this.pointerDown = false;
  };
}
```

- [ ] **Step 2: Wire pointer input into LabApp**

Modify `LabApp.ts`:

```ts
import { InputController } from "../input/inputController";
```

Add field:

```ts
private readonly input: InputController;
```

In constructor:

```ts
this.input = new InputController(stage);
```

Update render loop with a method:

```ts
start(): void {
  this.engine.start();
  const tick = () => {
    const gesture = this.input.getGesture();
    this.engine.setRuntime({
      compression: gesture.compression,
      expansion: 1 - gesture.compression * 0.45,
    });
    requestAnimationFrame(tick);
  };
  tick();
}
```

Destroy:

```ts
this.input.destroy();
```

- [ ] **Step 3: Upgrade Cumulus shape in shader**

In `cloudFragment.ts`, make Cumulus use the pointer/compression uniforms:

```glsl
float cumulusDensity(vec2 p) {
  float radius = 0.42 - uCompression * 0.18 + uExpansion * 0.16;
  float blob = 1.0 - smoothstep(radius, radius + 0.24, length(p));
  float lobes = fbm(vec3(p * 3.2, uTime * 0.06));
  float upperLift = smoothstep(-0.4, 0.55, p.y);
  return smoothstep(0.34, 0.82, blob + lobes * 0.52 + upperLift * 0.12);
}
```

Use it in `uMode == 1`.

- [ ] **Step 4: Build and browser QA**

Run:

```bash
bun run typecheck
bun run build
```

Expected: exit 0.

Browser checks:

- Switch to Cumulus.
- Pointer down compresses the cloud.
- Pointer up expands the cloud.
- Visual reads as central cloud mass.

- [ ] **Step 5: Commit**

```bash
git add src/input/inputController.ts src/lab/LabApp.ts src/render/cloudFragment.ts src/core/stateMachine.ts docs/VISUAL_QA.md
git commit -m "feat: add cumulus pointer control"
```

## Task 8: Weather Layer

**Files:**
- Create: `src/weather/WeatherLayer.ts`
- Create: `src/weather/WeatherLayer.test.ts`
- Modify: `src/lab/LabApp.ts`
- Modify: `src/styles.css`
- Modify: `docs/VISUAL_QA.md`

- [ ] **Step 1: Write failing WeatherLayer test**

Create `src/weather/WeatherLayer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeDropletCount } from "./WeatherLayer";

describe("WeatherLayer", () => {
  it("increases droplet count with storm intensity", () => {
    expect(computeDropletCount(0, 800, 600)).toBe(0);
    expect(computeDropletCount(1, 800, 600)).toBeGreaterThan(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run test src/weather/WeatherLayer.test.ts
```

Expected: FAIL because `WeatherLayer` does not exist.

- [ ] **Step 3: Add WeatherLayer**

Create `src/weather/WeatherLayer.ts`:

```ts
export interface WeatherLayerState {
  storm: number;
  rain: number;
  droplets: number;
  mist: number;
}

export function computeDropletCount(storm: number, width: number, height: number): number {
  const area = (width * height) / (800 * 600);
  return Math.round(Math.max(0, storm) * area * 120);
}

export class WeatherLayer {
  private readonly canvas = document.createElement("canvas");
  private readonly ctx = this.canvas.getContext("2d");
  private state: WeatherLayerState = { storm: 0, rain: 0, droplets: 0, mist: 0 };
  private animationId = 0;

  constructor(private readonly host: HTMLElement) {
    this.canvas.className = "cloudia-weather-layer";
    this.host.appendChild(this.canvas);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  setState(state: Partial<WeatherLayerState>): void {
    this.state = { ...this.state, ...state };
  }

  start(): void {
    const frame = () => {
      this.animationId = requestAnimationFrame(frame);
      this.draw();
    };
    frame();
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.resize);
    this.canvas.remove();
  }

  private readonly resize = (): void => {
    const rect = this.host.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    this.canvas.style.width = `${Math.max(1, Math.floor(rect.width))}px`;
    this.canvas.style.height = `${Math.max(1, Math.floor(rect.height))}px`;
  };

  private draw(): void {
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const mistAlpha = this.state.mist * 0.28;
    if (mistAlpha > 0.01) {
      this.ctx.fillStyle = `rgba(205, 217, 235, ${mistAlpha})`;
      this.ctx.fillRect(0, 0, width, height);
    }

    const count = computeDropletCount(this.state.droplets, width, height);
    this.ctx.strokeStyle = `rgba(235, 244, 255, ${0.12 + this.state.storm * 0.3})`;
    this.ctx.lineWidth = Math.max(1, devicePixelRatio);
    for (let i = 0; i < count; i++) {
      const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * width;
      const y = (Math.sin(i * 47.3 + performance.now() * 0.001) * 0.5 + 0.5) * height;
      const length = (8 + Math.sin(i * 13.1) * 6) * devicePixelRatio;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + length * 0.25, y + length);
      this.ctx.stroke();
    }
  }
}
```

- [ ] **Step 4: Add weather layer CSS**

Append to `src/styles.css`:

```css
.cloudia-weather-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  mix-blend-mode: screen;
}
```

- [ ] **Step 5: Wire into LabApp**

In `LabApp.ts`, create and update `WeatherLayer` alongside `CloudEngine`.

Use runtime storm values:

```ts
this.weather.setState({
  storm,
  rain: storm,
  droplets: storm,
  mist: storm * 0.7,
});
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
bun run test src/weather/WeatherLayer.test.ts
bun run typecheck
bun run build
```

Expected: all exit 0.

- [ ] **Step 7: Browser QA storm effect**

Verify:

- Storm slider shows rain streaks/droplets.
- Mist does not fully wash out cloud detail.
- Layer resizes with viewport.

- [ ] **Step 8: Commit**

```bash
git add src/weather/WeatherLayer.ts src/weather/WeatherLayer.test.ts src/lab/LabApp.ts src/styles.css docs/VISUAL_QA.md
git commit -m "feat: add weather overlay layer"
```

## Task 9: Optional MediaPipe Hand Tracking

**Files:**
- Create: `src/input/handTracker.ts`
- Modify: `src/input/inputController.ts`
- Modify: `src/lab/LabUI.ts`
- Modify: `src/lab/LabApp.ts`
- Modify: `docs/GOTCHAS.md`

- [ ] **Step 1: Add HandTracker wrapper**

Create `src/input/handTracker.ts`:

```ts
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type HandTrackerCallback = (result: HandLandmarkerResult) => void;

export class HandTracker {
  private landmarker: HandLandmarker | undefined;
  private stream: MediaStream | undefined;
  private video: HTMLVideoElement | undefined;
  private animationId = 0;

  async start(callback: HandTrackerCallback): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
    );
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();

    const tick = () => {
      this.animationId = requestAnimationFrame(tick);
      if (!this.landmarker || !this.video) return;
      callback(this.landmarker.detectForVideo(this.video, performance.now()));
    };
    tick();
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video = undefined;
    this.landmarker?.close();
    this.landmarker = undefined;
  }
}
```

- [ ] **Step 2: Add MediaPipe result mapping**

In `inputController.ts`, accept a hand gesture override:

```ts
setHandGesture(gesture: GestureState | undefined): void {
  this.handGesture = gesture;
}
```

Return `handGesture` from `getGesture()` when present, else pointer fallback.

- [ ] **Step 3: Add UI toggle**

In `LabUI.ts`, add an input folder with:

```ts
const input = this.gui.addFolder("Input");
input.add(this.preset.input, "handTracking").name("Hand tracking").onChange(() => {
  this.events.onPresetChanged(this.preset);
});
```

- [ ] **Step 4: Wire in LabApp**

When `preset.input.handTracking` becomes true, call `HandTracker.start`. On results, convert the first confident hand to `GestureState` using `mapHandLandmarks`.

When false, call `HandTracker.stop` and clear hand gesture override.

- [ ] **Step 5: Browser permission QA**

Checks:

- With hand tracking disabled, no camera prompt appears.
- Enabling hand tracking asks for camera permission.
- Denying camera does not break pointer fallback.
- Console has no unhandled promise rejection.

- [ ] **Step 6: Commit**

```bash
git add src/input/handTracker.ts src/input/inputController.ts src/lab/LabUI.ts src/lab/LabApp.ts docs/GOTCHAS.md
git commit -m "feat: add optional hand tracking"
```

## Task 10: Embed Adapter And Elementor Fixture

**Files:**
- Create: `src/embed/CloudiaHero.ts`
- Create: `src/embed/CloudiaHero.test.ts`
- Create: `examples/elementor-hero.html`
- Modify: `vite.config.ts`
- Modify: `README.md`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Write failing embed API test**

Create `src/embed/CloudiaHero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveMountElement } from "./CloudiaHero";

describe("CloudiaHero", () => {
  it("resolves a selector mount target", () => {
    document.body.innerHTML = "<div id='cloudia-mount'></div>";
    expect(resolveMountElement("#cloudia-mount")).toBeInstanceOf(HTMLElement);
  });

  it("throws for a missing selector", () => {
    expect(() => resolveMountElement("#missing")).toThrow("Cloudia mount target not found");
  });
});
```

- [ ] **Step 2: Add embed adapter**

Create `src/embed/CloudiaHero.ts`:

```ts
import { defaultPreset } from "../core/defaultPreset";
import type { CloudiaPreset } from "../core/types";
import { CloudEngine } from "../render/CloudEngine";
import { WeatherLayer } from "../weather/WeatherLayer";

export interface CloudiaHeroInstance {
  destroy: () => void;
  setPreset: (preset: CloudiaPreset) => void;
  setWeather: (storm: number) => void;
}

export interface CloudiaHeroOptions {
  preset?: CloudiaPreset;
  handTracking?: boolean;
}

export function resolveMountElement(target: string | HTMLElement): HTMLElement {
  if (typeof target !== "string") return target;
  const element = document.querySelector<HTMLElement>(target);
  if (!element) throw new Error(`Cloudia mount target not found: ${target}`);
  return element;
}

export function mount(
  target: string | HTMLElement,
  options: CloudiaHeroOptions = {},
): CloudiaHeroInstance {
  const element = resolveMountElement(target);
  const preset = structuredClone(options.preset ?? defaultPreset);
  preset.input.handTracking = options.handTracking ?? false;

  element.classList.add("cloudia-embed-mount");
  const engine = new CloudEngine(element, preset);
  const weather = new WeatherLayer(element);
  engine.start();
  weather.start();

  return {
    destroy: () => {
      weather.destroy();
      engine.destroy();
    },
    setPreset: (nextPreset) => {
      engine.setPreset(nextPreset);
    },
    setWeather: (storm) => {
      engine.setRuntime({ storm });
      weather.setState({ storm, rain: storm, droplets: storm, mist: storm * 0.7 });
    },
  };
}

export const CloudiaHero = { mount };
```

- [ ] **Step 3: Add library build entry**

Modify `vite.config.ts`:

```ts
build: {
  target: "es2022",
  sourcemap: true,
  lib: {
    entry: "src/embed/CloudiaHero.ts",
    name: "CloudiaHero",
    fileName: "cloudia-hero",
    formats: ["iife", "es"],
  },
},
```

Only keep this lib build if it does not break lab development. If it conflicts, split lab and embed build configs in a follow-up task.

- [ ] **Step 4: Add Elementor fixture**

Create `examples/elementor-hero.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cloudia Elementor Hero Fixture</title>
    <style>
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: #060913;
        color: white;
      }

      .cloudia-hero {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 60vh;
        min-height: 420px;
        overflow: hidden;
      }

      .cloudia-brand {
        position: relative;
        z-index: 1;
        font-size: clamp(58px, 16vw, 240px);
        font-weight: 800;
        letter-spacing: 0;
        opacity: 0.38;
        pointer-events: none;
      }

      #cloudia-mount {
        position: absolute;
        inset: 0;
        z-index: 2;
      }
    </style>
  </head>
  <body>
    <section class="cloudia-hero">
      <div class="cloudia-brand">CLOUDIA</div>
      <div id="cloudia-mount"></div>
    </section>
    <script src="../dist/cloudia-hero.iife.js"></script>
    <script>
      CloudiaHero.mount("#cloudia-mount", { handTracking: false });
    </script>
  </body>
</html>
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
bun run test src/embed/CloudiaHero.test.ts
bun run build
```

Expected: tests pass and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/embed/CloudiaHero.ts src/embed/CloudiaHero.test.ts examples/elementor-hero.html vite.config.ts README.md docs/WORKLOG.md
git commit -m "feat: add cloudia hero embed adapter"
```

## Task 11: Browser QA Script

**Files:**
- Create: `scripts/qa-browser-smoke.mjs`
- Modify: `package.json`
- Modify: `docs/VISUAL_QA.md`
- Modify: `docs/GOTCHAS.md`

- [ ] **Step 1: Add smoke script**

Create `scripts/qa-browser-smoke.mjs`:

```js
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url, { waitUntil: "networkidle" });
const title = await page.title();
const canvasCount = await page.locator("canvas").count();
const screenshotPath = "/tmp/cloudia-browser-smoke.png";
await page.screenshot({ path: screenshotPath, fullPage: false });
await browser.close();

if (!title.includes("Cloudia")) {
  throw new Error(`Unexpected title: ${title}`);
}

if (canvasCount < 1) {
  throw new Error("Expected at least one canvas");
}

if (errors.length > 0) {
  throw new Error(`Console errors:\n${errors.join("\n")}`);
}

console.log(JSON.stringify({ ok: true, title, canvasCount, screenshotPath }, null, 2));
```

- [ ] **Step 2: Add Playwright dependency if missing**

Add to `devDependencies`:

```json
"playwright": "^1.57.0"
```

- [ ] **Step 3: Run smoke test**

With dev server running:

```bash
bun run qa:browser http://127.0.0.1:5173
```

Expected: JSON output with `ok: true`, title, canvas count, and screenshot path.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa-browser-smoke.mjs package.json bun.lock docs/VISUAL_QA.md docs/GOTCHAS.md
git commit -m "test: add browser smoke qa"
```

## Task 12: GitHub Publish

**Files:**
- Modify: `docs/WORKLOG.md`
- Modify: `docs/GOTCHAS.md`

- [ ] **Step 1: Verify clean tree**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 2: Verify GitHub auth**

Run:

```bash
gh auth status
```

Expected: logged in as `enuzzo` with a valid token.

- [ ] **Step 3: Create public GitHub repo**

Run:

```bash
gh repo create cloudia --public --source . --remote origin --push --description "Volumetric WebGL clouds with hand-tracked weather control. Partly cloudy, fully shadered."
```

Expected:

- repo `enuzzo/cloudia` is created.
- `origin` remote is configured.
- branch `main` is pushed.

- [ ] **Step 4: Update worklog**

Add the remote URL and first pushed commit to `docs/WORKLOG.md`.

- [ ] **Step 5: Commit the worklog update**

```bash
git add docs/WORKLOG.md docs/GOTCHAS.md
git commit -m "docs: record github publication"
git push
```

## Plan Self-Review

Spec coverage:

- Flow cloud deck: Task 6.
- Cumulus central cloud: Task 7.
- Mouse/touch fallback: Task 7.
- MediaPipe optional hand tracking: Task 9.
- Rain/mist/droplets: Task 8.
- Preset JSON copy: Tasks 2 and 5.
- Elementor/WordPress future embed: Task 10.
- Browser and visual QA: Tasks 4, 6, 8, 10, 11.
- GitHub public MIT publication: Task 12 plus existing docs commits.

Placeholder scan:

- No `TBD`, `TODO`, `fill later`, or unnamed implementation steps.
- Each code-producing task names files and commands.

Type consistency:

- `CloudiaPreset`, `GestureState`, `WeatherRuntimeState`, `CloudEngine`, `WeatherLayer`, and `CloudiaHero` names are introduced before later use.
- Runtime values use `storm`, `compression`, `expansion`, `rain`, `droplets`, and `mist` consistently.
