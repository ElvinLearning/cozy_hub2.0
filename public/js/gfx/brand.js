// Shared look: the baked studio environment, the chrome material, the
// ribbon sweep and the logo ring as a 3D object.
import * as THREE from 'three';

export const COLORS = {
  violet: new THREE.Color('#c084fc'),
  indigo: new THREE.Color('#818cf8'),
  cyan: new THREE.Color('#67e8f9'),
  ink: new THREE.Color('#08090b'),
};

/**
 * A black studio lit by brand-coloured softboxes, baked once into a PMREM
 * cube. Chrome surfaces pick their violet/cyan streaks out of this, the way
 * the hero art on cozydigital.org reads.
 */
export function bakeEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.004, 0.004, 0.007);
  const box = (w, h, color, intensity, pos, look = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  // broad softboxes, so reflections sweep across whole surfaces instead of
  // pinging as clipped dots: violet key left, cyan rim right, indigo below,
  // a dim indigo field behind the camera so faces toward the viewer are never dead black
  box(1.8, 10, COLORS.violet, 3.4, [-6, 0.5, 3.0]);
  box(1.6, 10, COLORS.cyan, 3.6, [6, 0, -2.5]);
  box(16, 2.0, COLORS.indigo, 1.2, [0, -6, 1]);
  box(10, 0.35, new THREE.Color(1, 1, 1), 3.2, [0, 6.5, 1.5]);
  box(12, 7, COLORS.indigo, 0.1, [0, 0.5, 9]);
  box(2.0, 0.8, new THREE.Color(0.75, 0.85, 1), 0.8, [1.5, 1.5, 8]);
  box(9, 5, COLORS.violet, 0.4, [-2, 1, -8]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => o.geometry?.dispose());
  return rt.texture;
}

export function chromeMaterial(env, overrides = {}) {
  return new THREE.MeshPhysicalMaterial({
    // black chrome = a bright mirror in a dark room (F0 high), not a dark metal
    color: new THREE.Color(0.46, 0.46, 0.52),
    metalness: 1,
    roughness: 0.12,
    envMap: env,
    envMapIntensity: 1.0,
    iridescence: 0.85,
    iridescenceIOR: 1.55,
    iridescenceThicknessRange: [260, 720],
    clearcoat: 0.5,
    clearcoatRoughness: 0.08,
    ...overrides,
  });
}

/**
 * Sweep an ellipse along a closed curve, twisting as it goes, with
 * curvature-aware frames. `halfTurns` must be an integer so the cross
 * section meets itself at the seam (an ellipse is symmetric under pi).
 */
export function ribbonGeometry(curve, { segments = 640, radial = 48, a = 0.34, b = 0.13, halfTurns = 2, twistPhase = 0 } = {}) {
  const frames = curve.computeFrenetFrames(segments, true);
  const pos = new Float32Array(segments * radial * 3);
  const uv = new Float32Array(segments * radial * 2);
  const p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const N = frames.normals[i], B = frames.binormals[i];
    const tw = twistPhase + halfTurns * Math.PI * t;
    const ct = Math.cos(tw), st = Math.sin(tw);
    for (let j = 0; j < radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const ex = Math.cos(phi) * a, ey = Math.sin(phi) * b;
      const x = ex * ct - ey * st, y = ex * st + ey * ct;
      pos[k * 3] = p.x + N.x * x + B.x * y;
      pos[k * 3 + 1] = p.y + N.y * x + B.y * y;
      pos[k * 3 + 2] = p.z + N.z * x + B.z * y;
      uv[k * 2] = t;
      uv[k * 2 + 1] = j / radial;
      k++;
    }
  }
  const idx = [];
  const shift = ((halfTurns % 2) + 2) % 2 ? radial / 2 : 0; // an odd number of half turns lands phi + pi on the seam
  for (let i = 0; i < segments; i++) {
    const i2 = (i + 1) % segments;
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a0 = i * radial + j, a1 = i * radial + j2;
      const b0 = i2 * radial + (i2 === 0 ? (j + shift) % radial : j);
      const b1 = i2 * radial + (i2 === 0 ? (j2 + shift) % radial : j2);
      idx.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The figure-eight loop: Gerono's lemniscate, split in depth so it never touches itself. */
export function loopCurve(scale = 1) {
  const pts = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(2.15 * Math.cos(t) * scale, 1.05 * Math.sin(2 * t) * scale, (0.62 * Math.sin(t) + 0.18 * Math.cos(2 * t)) * scale));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

/**
 * The logo ring in 3D: an emissive torus whose colour runs violet ->
 * indigo -> cyan around it, opened at the upper right like the mark.
 * uOpen is the gap size in radians; uGlow drives HDR intensity (bloom).
 */
export function ringMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    // additive light: a fading ring goes transparent, never an opaque dark sliver
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uGlow: { value: 4.0 }, uOpen: { value: 0.8 }, uGapAt: { value: 0.72 }, uFade: { value: 1.0 } },
    vertexShader: /* glsl */ `
      out vec3 vLocal; out vec3 vN; out vec3 vView;
      void main() {
        vLocal = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vLocal; in vec3 vN; in vec3 vView; out vec4 o;
      uniform float uGlow, uOpen, uGapAt, uFade;
      vec3 brand(float t) {
        vec3 v = vec3(0.53, 0.23, 0.97), i = vec3(0.22, 0.26, 0.94), c = vec3(0.13, 0.80, 0.95);
        return t < 0.5 ? mix(v, i, t * 2.0) : mix(i, c, t * 2.0 - 1.0);
      }
      void main() {
        float ang = atan(vLocal.y, vLocal.x); // -pi..pi, 0 = +x
        // distance (radians) from the gap centre, wrapped
        float d = abs(mod(ang - uGapAt + 3.14159265, 6.2831853) - 3.14159265);
        if (d < uOpen * 0.5 || uFade < 0.002) discard;
        // gradient runs from upper-left (violet) to lower-right (cyan), as on the logo
        float g = clamp(0.5 - 0.35 * (vLocal.y - vLocal.x) / max(length(vLocal.xy), 1e-3), 0.0, 1.0);
        vec3 col = brand(g);
        float facing = abs(dot(normalize(vN), normalize(vView)));
        float core = 0.55 + 0.45 * pow(facing, 2.0);
        // ends of the open arc burn a little hotter, where the pixels break off
        float endHeat = 1.0 + 1.5 * (1.0 - smoothstep(uOpen * 0.5, uOpen * 0.5 + 0.35, d));
        o = vec4(col * uGlow * core * endHeat * uFade, 1.0);
      }`,
  });
}

/**
 * Instanced "pixels" from the logo scatter: small rounded cubes with an
 * emissive brand colour and a hint of facet shading.
 */
export function pixelMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uGlow: { value: 2.5 }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      in vec3 aColor; in float aSeed;
      out vec3 vCol; out vec3 vN; out float vSeed;
      void main() {
        vCol = aColor; vSeed = aSeed;
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vCol; in vec3 vN; in float vSeed; out vec4 o;
      uniform float uGlow, uTime, uFade;
      void main() {
        float shade = 0.65 + 0.35 * clamp(dot(normalize(vN), normalize(vec3(0.3, 0.8, 0.6))), 0.0, 1.0);
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.3 + vSeed * 40.0);
        o = vec4(vCol * uGlow * shade * twinkle * uFade, 1.0);
      }`,
  });
}

/** Big soft gradient backdrop sphere so the void is never flat black. */
export function backdrop(top = [0.012, 0.014, 0.024], bottom = [0.002, 0.002, 0.004], glow = [0.06, 0.03, 0.12], glowDir = [0.6, 0.2, -1]) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(...top) }, uBottom: { value: new THREE.Color(...bottom) }, uGlow: { value: new THREE.Color(...glow) }, uDir: { value: new THREE.Vector3(...glowDir).normalize() }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop, uBottom, uGlow, uDir; uniform float uFade; varying vec3 vDir;
      void main(){ float h = vDir.y * 0.5 + 0.5; vec3 c = mix(uBottom, uTop, smoothstep(0.2, 0.9, h));
      c += uGlow * pow(max(dot(vDir, uDir), 0.0), 6.0); gl_FragColor = vec4(c * uFade, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}
