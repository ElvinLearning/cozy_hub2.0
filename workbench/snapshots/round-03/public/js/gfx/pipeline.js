// HDR pipeline. Each chapter renders into its own half-float target; one
// composite pass mixes two chapters (crossfade, ring iris, pixel mosaic)
// in linear HDR; a bloom pyramid (Karis-averaged 13-tap down, tent up)
// adds glow; the final pass applies exposure, a filmic shoulder, vignette,
// sRGB encode and a fixed dither so dark gradients never band.
//
// GLSL rules here: smoothstep edges are always ordered (lo < hi, with a
// constant gap), and every divisor is max()'d away from zero.
import * as THREE from 'three';

const VERT = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}

function pass(fragment, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: fragment, uniforms, depthTest: false, depthWrite: false, ...extra });
}

export function makeTarget(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    samples,
  });
}

const COMMON = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 brand(float t) { // violet -> indigo -> cyan, linear-ish HDR
    vec3 v = vec3(0.53, 0.23, 0.97), i = vec3(0.22, 0.26, 0.94), c = vec3(0.13, 0.80, 0.95);
    return t < 0.5 ? mix(v, i, t * 2.0) : mix(i, c, t * 2.0 - 1.0);
  }
`;

const COMPOSITE = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D tA, tB;
  uniform float uMix, uExpA, uExpB, uAspect, uTime;
  uniform int uMode; // 0 crossfade, 1 iris, 2 mosaic
  uniform vec2 uCenter; // iris centre in uv
  uniform vec3 uBg;
  ${COMMON}
  vec3 sampleA(vec2 uv) { return texture(tA, uv).rgb * uExpA; }
  vec3 sampleB(vec2 uv) { return texture(tB, uv).rgb * uExpB; }
  void main() {
    vec3 col;
    if (uMode == 1) {
      // through the ring: B opens in a circle from uCenter, A pushes outward
      vec2 d = (vUv - uCenter) * vec2(uAspect, 1.0);
      float dist = length(d);
      float maxR = length(vec2(max(uCenter.x, 1.0 - uCenter.x) * uAspect, max(uCenter.y, 1.0 - uCenter.y))) + 0.08;
      float m = uMix * uMix * (3.0 - 2.0 * uMix);
      float r = m * maxR;
      float soft = 0.012 + 0.05 * m;
      float inside = (1.0 - smoothstep(r - soft, r + soft, dist)) * smoothstep(0.0, 0.03, m);
      vec2 dir = d / max(dist, 1e-4);
      // A gets pulled into the hole a little, B settles from a zoomed-in state
      vec2 uvA = uCenter + (vUv - uCenter) * (1.0 - 0.18 * m);
      vec2 uvB = uCenter + (vUv - uCenter) * (1.0 + 0.35 * (1.0 - m));
      // refraction at the rim: offset B channels along the radius
      float rim = exp(-pow((dist - r) / (0.016 + 0.022 * m), 2.0));
      vec2 off = dir / vec2(uAspect, 1.0) * 0.012 * rim;
      vec3 b = vec3(sampleB(uvB + off).r, sampleB(uvB).g, sampleB(uvB - off).b);
      col = mix(sampleA(uvA) * (1.0 - 0.6 * m), b, inside); // the scene you leave sinks back
      float ang = atan(d.y, d.x) / 6.2831853 + 0.5;
      col += brand(fract(ang + 0.15)) * rim * 1.3 * smoothstep(0.0, 0.08, m) * (1.0 - smoothstep(0.86, 1.0, m));
    } else if (uMode == 2) {
      // pixel mosaic: blocks grow, flip from A to B in a noisy sweep, shrink back
      float k = sin(3.14159265 * clamp(uMix, 0.0, 1.0));
      float cells = mix(240.0, 22.0, k);
      vec2 grid = vec2(cells * uAspect, cells);
      vec2 cell = floor(vUv * grid);
      vec2 uvq = (cell + 0.5) / grid;
      vec2 uvs = mix(vUv, uvq, smoothstep(0.02, 0.35, k));
      float n = hash12(cell + 17.0);
      // cells resolve outward from uCenter (the orb), with noise so the front feathers
      float sweep = length((uvq - uCenter) * vec2(uAspect, 1.0)) * 0.55 + n * 0.35;
      float t = smoothstep(sweep - 0.02, sweep + 0.02, uMix * 1.25 - 0.05);
      col = mix(sampleA(uvs), sampleB(uvs), t);
      // the flipping cells flash in brand colour
      float flash = smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(0.5, 1.0, t));
      col += brand(n) * flash * 1.6 * k;
      // gaps between cells
      vec2 f = fract(vUv * grid);
      float edge = smoothstep(0.0, 0.08, min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)));
      col *= mix(1.0, edge, smoothstep(0.1, 0.5, k));
    } else {
      col = mix(sampleA(vUv), sampleB(vUv), uMix);
    }
    o = vec4(max(col, uBg), 1.0);
  }
`;

const DOWN = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform int uFirst; uniform float uThreshold, uKnee;
  vec3 q(vec2 uv) { return texture(tSrc, uv).rgb; }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
    float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
    return (a * wa + b * wb + c * wc + d * wd) / max(wa + wb + wc + wd, 1e-4);
  }
  void main() {
    vec2 t = uTexel;
    vec3 A = q(vUv + t * vec2(-2, 2)), B = q(vUv + t * vec2(0, 2)), C = q(vUv + t * vec2(2, 2));
    vec3 D = q(vUv + t * vec2(-2, 0)), E = q(vUv), F = q(vUv + t * vec2(2, 0));
    vec3 G = q(vUv + t * vec2(-2, -2)), H = q(vUv + t * vec2(0, -2)), I = q(vUv + t * vec2(2, -2));
    vec3 J = q(vUv + t * vec2(-1, 1)), K = q(vUv + t * vec2(1, 1)), L = q(vUv + t * vec2(-1, -1)), M = q(vUv + t * vec2(1, -1));
    vec3 c;
    if (uFirst == 1) {
      c = karis(J, K, L, M) * 0.5 + karis(A, B, D, E) * 0.125 + karis(B, C, E, F) * 0.125 + karis(D, E, G, H) * 0.125 + karis(E, F, H, I) * 0.125;
      float br = max(c.r, max(c.g, c.b));
      float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      soft = soft * soft / (4.0 * uKnee + 1e-4);
      c *= max(soft, br - uThreshold) / max(br, 1e-4);
    } else {
      c = (J + K + L + M) * 0.125 + (A + C + G + I) * 0.03125 + (B + D + F + H) * 0.0625 + E * 0.125;
    }
    o = vec4(max(c, 0.0), 1.0);
  }
`;

const UP = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius;
  void main() {
    vec2 t = uTexel * uRadius;
    vec3 c = texture(tSrc, vUv + t * vec2(-1, 1)).rgb + texture(tSrc, vUv + t * vec2(1, 1)).rgb
           + texture(tSrc, vUv + t * vec2(-1, -1)).rgb + texture(tSrc, vUv + t * vec2(1, -1)).rgb;
    c += 2.0 * (texture(tSrc, vUv + t * vec2(0, 1)).rgb + texture(tSrc, vUv + t * vec2(0, -1)).rgb
              + texture(tSrc, vUv + t * vec2(-1, 0)).rgb + texture(tSrc, vUv + t * vec2(1, 0)).rgb);
    c += 4.0 * texture(tSrc, vUv).rgb;
    o = vec4(c / 16.0, 1.0);
  }
`;

const FINAL = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D tHdr, tBloom;
  uniform float uBloom, uExposure, uVignette, uAspect;
  ${COMMON}
  // filmic: ACES fit (Hill) for the shoulder, then a touch of contrast
  vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / max(b, vec3(1e-5)); }
  vec3 aces(vec3 c) {
    const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 oM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    return clamp(oM * rrt(i * c), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 hdr = texture(tHdr, vUv).rgb;
    vec3 bloom = texture(tBloom, vUv).rgb;
    vec3 c = (hdr + bloom * uBloom) * uExposure;
    vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
    c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(d));
    c = toSRGB(aces(c / 0.6));
    // static triangular dither, +-1 LSB: kills banding without shimmer between frames
    float n = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 71.3) - 1.0;
    c += n / 255.0;
    o = vec4(c, 1.0);
  }
`;

export class Pipeline {
  constructor(renderer, { bloomLevels = 6 } = {}) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(tri());
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.levels = bloomLevels;
    this.samples = renderer.capabilities.isWebGL2 ? Math.min(4, renderer.capabilities.maxSamples) : 0;

    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    this.composite = pass(COMPOSITE, {
      tA: { value: this.black }, tB: { value: this.black }, uMix: { value: 0 }, uExpA: { value: 1 }, uExpB: { value: 1 },
      uAspect: { value: 1 }, uTime: { value: 0 }, uMode: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uBg: { value: new THREE.Color(0, 0, 0) },
    });
    this.down = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } });
    this.up = pass(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.final = pass(FINAL, { tHdr: { value: null }, tBloom: { value: null }, uBloom: { value: 0.9 }, uExposure: { value: 1.0 }, uVignette: { value: 0.35 }, uAspect: { value: 1 } });
    this.hdr = null;
    this.mips = [];
  }

  /** Size every target. `scale` is the internal resolution multiplier (adaptive quality). */
  resize(cssW, cssH, pixelRatio) {
    const w = Math.max(2, Math.round(cssW * pixelRatio));
    const h = Math.max(2, Math.round(cssH * pixelRatio));
    this.w = w;
    this.h = h;
    this.hdr?.dispose();
    this.hdr = makeTarget(w, h, 0);
    this.hdr.depthBuffer = false;
    this.mips.forEach((m) => m.dispose());
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < this.levels; i++) {
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
      const t = makeTarget(mw, mh, 0);
      t.depthBuffer = false;
      this.mips.push(t);
    }
    const aspect = w / h;
    this.composite.uniforms.uAspect.value = aspect;
    this.final.uniforms.uAspect.value = aspect;
  }

  /** A target sized for a chapter (MSAA where supported). */
  chapterTarget() {
    return makeTarget(this.w, this.h, this.samples);
  }

  draw(material, target) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render({ a, b, mix = 0, mode = 0, expA = 1, expB = 1, center, exposure = 1, bloom = 0.9, bgColor }) {
    const u = this.composite.uniforms;
    u.tA.value = a ? a.texture : this.black;
    u.tB.value = b ? b.texture : this.black;
    u.uMix.value = mix;
    u.uMode.value = mode;
    u.uExpA.value = a ? expA : 0;
    u.uExpB.value = b ? expB : 0;
    if (center) u.uCenter.value.set(center[0], center[1]);
    if (bgColor) u.uBg.value.copy(bgColor);
    this.draw(this.composite, this.hdr);

    // bloom pyramid
    const d = this.down.uniforms;
    let src = this.hdr;
    for (let i = 0; i < this.mips.length; i++) {
      d.tSrc.value = src.texture;
      d.uTexel.value.set(1 / src.width, 1 / src.height);
      d.uFirst.value = i === 0 ? 1 : 0;
      this.draw(this.down, this.mips[i]);
      src = this.mips[i];
    }
    const up = this.up.uniforms;
    for (let i = this.mips.length - 1; i > 0; i--) {
      up.tSrc.value = this.mips[i].texture;
      up.uTexel.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
      this.r.autoClear = false;
      this.draw(this.up, this.mips[i - 1]);
      this.r.autoClear = true;
    }
    const f = this.final.uniforms;
    f.tHdr.value = this.hdr.texture;
    f.tBloom.value = this.mips[0].texture;
    f.uExposure.value = exposure;
    f.uBloom.value = bloom;
    this.draw(this.final, null);
  }
}
