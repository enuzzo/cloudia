export const cloudFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMode;
  uniform float uStorm;
  uniform float uCompression;
  uniform float uExpansion;
  uniform vec2 uPrimary;
  uniform float uCameraSpeed;
  uniform float uHorizonHeight;
  uniform float uCloudDensity;
  uniform float uCloudCoverage;
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

  float cloudDensity(vec3 p) {
    float deckBand = smoothstep(-0.54, -0.08, p.y) * (1.0 - smoothstep(0.24, 0.72, p.y));
    float base = fbm(p * vec3(0.72, 1.05, 0.64));
    float detail = fbm(p * vec3(2.3, 2.8, 2.0) + vec3(12.7, 3.1, 8.4)) * 0.38;
    float billow = fbm(p * vec3(4.8, 3.0, 3.8) + vec3(2.1, 9.4, 1.7)) * 0.16;
    float density = base + detail + billow + deckBand * 0.62;
    return smoothstep(uCloudCoverage * 0.58, 0.92, density) * deckBand * (uCloudDensity * 1.45);
  }

  vec4 marchClouds(vec3 ro, vec3 rd) {
    vec3 color = vec3(0.0);
    float alpha = 0.0;
    float t = 0.0;

    for (int i = 0; i < 72; i++) {
      vec3 p = ro + rd * t;
      float density = cloudDensity(p);
      float shade = smoothstep(0.04, 0.78, density + p.y * 0.72);
      float forwardLight = smoothstep(0.0, 1.0, 1.0 - t * 0.11);
      vec3 sampleColor = mix(uCloudShadow, uCloudLight, shade * 0.72 + forwardLight * 0.28);
      float sampleAlpha = density * 0.092 * (1.0 - alpha);
      color += sampleColor * sampleAlpha;
      alpha += sampleAlpha;
      t += 0.038;
      if (alpha > 0.96) break;
    }

    return vec4(color, alpha);
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv * 2.0 - 1.0;
    centered.x *= uResolution.x / max(1.0, uResolution.y);

    vec3 sky = mix(uHorizon, uSkyMid, smoothstep(0.08, 0.72, uv.y));
    sky = mix(sky, uSkyTop, smoothstep(0.45, 1.0, uv.y));

    vec3 ro = vec3(centered.x * 0.18, 0.02, uTime * uCameraSpeed);
    vec3 rd = normalize(vec3(centered.x * 0.48, (centered.y + uHorizonHeight) * 0.15, 1.0));
    vec4 marched = marchClouds(ro, rd);
    float horizonMask = 1.0 - smoothstep(0.48, 0.82, uv.y);
    float foregroundLift = smoothstep(0.02, 0.34, uv.y);
    marched.a *= horizonMask * foregroundLift;
    vec3 screenP = vec3(centered.x * 1.25, uv.y * 3.2, uTime * uCameraSpeed * 1.8);
    float screenDeck = (1.0 - smoothstep(0.14, 0.54, abs(uv.y - 0.36))) * horizonMask;
    float screenNoise = fbm(screenP) + fbm(screenP * 2.4 + vec3(8.2, 1.3, 4.7)) * 0.34;
    float screenCloud = smoothstep(0.2, 0.72, screenNoise + screenDeck * 0.78) * screenDeck;
    vec3 screenCloudColor = mix(uCloudShadow * 0.82, uCloudLight * 1.06, smoothstep(0.12, 0.88, screenNoise));
    float flowAlpha = max(marched.a, screenCloud * 0.94);
    vec3 flowColor = mix(marched.rgb, screenCloudColor, screenCloud * 0.72);
    vec3 color = mix(sky, flowColor, flowAlpha);

    if (uMode == 1) {
      vec2 handOffset = (uPrimary - 0.5) * vec2(1.2, -0.72);
      vec2 cumulusUv = centered - handOffset;
      cumulusUv.x *= 0.92 + uCompression * 0.2;
      cumulusUv.y *= 1.08 + uCompression * 0.36;
      float radius = 0.42 - uCompression * 0.18 + uExpansion * 0.16;
      float blob = 1.0 - smoothstep(radius, radius + 0.24, length(cumulusUv));
      float lobes = fbm(vec3(cumulusUv * 3.2, uTime * 0.06));
      float upperLift = smoothstep(-0.42, 0.48, cumulusUv.y);
      float base = smoothstep(0.34, 0.82, blob + lobes * 0.52 + upperLift * 0.12);
      float shadowPocket = smoothstep(0.12, 0.92, fbm(vec3(cumulusUv * 5.8 + 4.0, uTime * 0.03)));
      float cloud = base;
      vec3 cloudColor = mix(uCloudShadow * 0.72, uCloudLight * 1.08, shadowPocket);
      cloudColor = mix(cloudColor, vec3(0.14, 0.16, 0.24), uStorm * 0.52);
      color = mix(sky, cloudColor, cloud * 0.82);
    }

    color = mix(color, color * vec3(0.42, 0.46, 0.58), uStorm * 0.62);

    gl_FragColor = vec4(color, 1.0);
  }
`;
