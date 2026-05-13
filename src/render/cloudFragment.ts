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
