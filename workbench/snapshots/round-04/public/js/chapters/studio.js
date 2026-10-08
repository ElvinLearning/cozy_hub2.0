// Chapter 2 · the studio. Your photos arrive as prints; the main print
// breaks into the logo's pixels, they stream through the ring, and land as
// a playing film of the same shot. The card and the cubes share one GPU
// hash for each cell's departure time, so a cell is never in both places.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { backdrop, ringMaterial } from '../gfx/brand.js';
import { clamp, hash, smoothstep, smootherstep, spline, lerp } from '../util.js';

export const SCREEN = { pos: new THREE.Vector3(2.5, 0, 0), w: 3.2, h: 1.8 };
// a print whose photo area (inside a border of 0.045 x height) is exactly 16:9
const PRINT = (16 / 9) * 0.91 + 0.09;
const PORTRAIT = 0.75 * 0.91 + 0.09; // width / height of a print holding a 3:4 phone snap
const LANDSCAPE = (4 / 3) * 0.91 + 0.09;
const RING = { pos: new THREE.Vector3(0.25, 0.0, 0.0), r: 1.12, normal: new THREE.Vector3(1, 0, 0.95).normalize() };

const GLSL_COMMON = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  // departure time of a cell (uv of its centre) in global progress units, 0..0.62
  float delayOf(vec2 c, vec2 cellId) {
    float front = 1.0 - c.x;               // the edge nearest the ring leaves first
    return 0.5 * (front * 0.82 + (1.0 - c.y) * 0.18) + 0.12 * hash12(cellId + 3.7);
  }
  const float FLIGHT = 0.38;
  vec3 brand(float t) {
    vec3 v = vec3(0.53, 0.23, 0.97), i = vec3(0.22, 0.26, 0.94), c = vec3(0.13, 0.80, 0.95);
    return t < 0.5 ? mix(v, i, t * 2.0) : mix(i, c, t * 2.0 - 1.0);
  }
`;

function printMaterial({ map, aspect, dissolve = false, grid = [48, 27] }) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    uniforms: {
      tMap: { value: map }, uAspect: { value: aspect }, uP: { value: 0 }, uDissolve: { value: dissolve ? 1 : 0 },
      uFade: { value: 1 }, uGrid: { value: new THREE.Vector2(...grid) }, uBright: { value: 1.0 },
    },
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec2 vUv; out vec4 o;
      uniform sampler2D tMap; uniform float uAspect, uP, uDissolve, uFade, uBright; uniform vec2 uGrid;
      ${GLSL_COMMON}
      float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        // print: a white border around the photo, rounded corners, soft edge
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float d = rbox(p, vec2(uAspect, 1.0) * 0.5, 0.035);
        float a = 1.0 - smoothstep(-0.004, 0.0, d);
        float border = 0.045;
        vec2 inner = vec2(uAspect, 1.0) * 0.5 - border;
        float di = rbox(p, inner, 0.012);
        vec2 puv = (p / (inner * 2.0)) + 0.5;
        vec3 photo = texture(tMap, clamp(puv, 0.0, 1.0)).rgb * 0.9;
        // matte, warm paper that sits under the bloom threshold, with fibre noise
        // and a soft raking light from the upper left, so prints read as paper, not panels
        float fibre = hash12(floor(vUv * vec2(uAspect, 1.0) * 420.0)) * 0.05;
        float rake = 0.82 + 0.22 * (vUv.y * 0.6 + (1.0 - vUv.x) * 0.4);
        vec3 paper = (vec3(0.47, 0.44, 0.39) + fibre) * rake;
        vec3 col = mix(photo * mix(1.0, rake, 0.5), paper, smoothstep(-0.002, 0.002, di));
        float glow = 0.0;
        if (uDissolve > 0.5 && di < 0.0) {
          vec2 cell = floor(puv * uGrid);
          vec2 c = (cell + 0.5) / uGrid;
          float dep = delayOf(c, cell);
          if (uP > dep) discard;                        // this cell is already in the air
          glow = 1.0 - smoothstep(0.0, 0.05, dep - uP); // about to leave: it heats up
        }
        // the white border burns away once most of the photo has gone
        if (uDissolve > 0.5 && di >= 0.0) a *= 1.0 - smoothstep(0.35, 0.7, uP);
        col = col * uBright + brand(vUv.y) * glow * 2.5;
        o = vec4(col, a * uFade);
        if (o.a < 0.003) discard;
      }`,
  });
}

function pixelFlightMaterial({ photo, video, grid }) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tPhoto: { value: photo }, tVideo: { value: video }, uP: { value: 0 }, uHide: { value: 0 },
      uCard: { value: new THREE.Matrix4() }, uScreen: { value: new THREE.Matrix4() },
      uCardSize: { value: new THREE.Vector2(1, 1) }, uScreenSize: { value: new THREE.Vector2(SCREEN.w, SCREEN.h) },
      uRingC: { value: RING.pos.clone() }, uRingN: { value: RING.normal.clone() }, uRingR: { value: RING.r },
      uGrid: { value: new THREE.Vector2(...grid) }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      in vec2 aCell; // cell index (col,row)
      uniform sampler2D tPhoto, tVideo;
      uniform float uP, uHide, uRingR, uTime;
      uniform mat4 uCard, uScreen;
      uniform vec2 uCardSize, uScreenSize, uGrid;
      uniform vec3 uRingC, uRingN;
      out vec3 vCol; out vec3 vN;
      ${GLSL_COMMON}
      vec3 bez(vec3 a, vec3 b, vec3 c, float t) { float s = 1.0 - t; return s * s * a + 2.0 * s * t * b + t * t * c; }
      mat3 rot(vec3 axis, float ang) {
        axis = normalize(axis); float s = sin(ang), c = cos(ang), oc = 1.0 - c;
        return mat3(oc*axis.x*axis.x + c, oc*axis.x*axis.y + axis.z*s, oc*axis.z*axis.x - axis.y*s,
                    oc*axis.x*axis.y - axis.z*s, oc*axis.y*axis.y + c, oc*axis.y*axis.z + axis.x*s,
                    oc*axis.z*axis.x + axis.y*s, oc*axis.y*axis.z - axis.x*s, oc*axis.z*axis.z + c);
      }
      void main() {
        vec2 c = (aCell + 0.5) / uGrid;
        float seed = hash12(aCell + 3.7);
        float dep = delayOf(c, aCell);
        float l = clamp((uP - dep) / FLIGHT, 0.0, 1.0);
        float e = l * l * l * (l * (l * 6.0 - 15.0) + 10.0);

        vec3 p0 = (uCard * vec4((c - 0.5) * uCardSize, 0.0, 1.0)).xyz;
        vec3 p3 = (uScreen * vec4((c - 0.5) * uScreenSize, 0.0, 1.0)).xyz;
        // where this cell crosses the ring: a point inside the disc, fanned by its row/col
        vec3 side = normalize(cross(uRingN, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(side, uRingN);
        float ang = 6.2831853 * hash12(aCell + 11.1);
        float rad = uRingR * 0.62 * sqrt(hash12(aCell + 23.9));
        vec3 pr = uRingC + side * (cos(ang) * rad) + up * (sin(ang) * rad);
        float L = 0.9 + 0.6 * seed;
        vec3 pos = e < 0.5 ? bez(p0, pr - uRingN * L, pr, e * 2.0) : bez(pr, pr + uRingN * L, p3, e * 2.0 - 1.0);

        float cellA = uCardSize.x / uGrid.x, cellB = uScreenSize.x / uGrid.x;
        float arc = sin(3.14159265 * e);
        float size = mix(cellA, cellB, e) * (1.0 + 0.5 * arc) * (1.0 - uHide) * step(0.0001, l);
        // flat squares like the logo's scatter: spin mostly in the picture plane
        vec3 axis = vec3((hash12(aCell + 5.1) - 0.5) * 0.4, (hash12(aCell + 6.2) - 0.5) * 0.4, 1.0);
        mat3 R = rot(axis, arc * (1.2 + 1.6 * seed) * sign(seed - 0.5));
        mat3 orient = mat3(mix(normalize(uCard[0].xyz), normalize(uScreen[0].xyz), e), mix(normalize(uCard[1].xyz), normalize(uScreen[1].xyz), e), mix(normalize(uCard[2].xyz), normalize(uScreen[2].xyz), e));
        vec3 local = orient * (R * (position * size * vec3(0.9, 0.9, 0.14)));
        vN = normalize(mat3(modelViewMatrix) * orient * R * normal);

        vec3 photo = textureLod(tPhoto, c, 0.0).rgb;
        vec3 film = textureLod(tVideo, c, 0.0).rgb;
        // photo colour while it is still the print, brand light in the air, film colour as it locks in
        vec3 hue = brand(clamp(c.x * 0.6 + seed * 0.4, 0.0, 1.0));
        float accent = step(0.88, hash12(aCell + 41.0));          // a few hot pixels, as in the logo
        vec3 air = hue * (0.55 + 1.6 * accent);
        vec3 col = mix(mix(photo, air, smoothstep(0.0, 0.16, e)), film, smoothstep(0.74, 0.97, e));
        float burn = exp(-pow((e - 0.5) / 0.13, 2.0));
        col *= 1.0 + 1.2 * burn;                                    // a flare through the ring, never a white mass
        vCol = col;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos + local, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vCol; in vec3 vN; out vec4 o;
      void main() {
        float shade = 0.72 + 0.28 * clamp(dot(normalize(vN), normalize(vec3(0.2, 0.6, 0.8))), 0.0, 1.0);
        o = vec4(vCol * shade, 1.0);
      }`,
  });
}

function screenMaterial(video) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    uniforms: { tVideo: { value: video }, uShow: { value: 0 }, uAspect: { value: SCREEN.w / SCREEN.h }, uGain: { value: 1.15 }, uEdge: { value: 1 }, uTime: { value: 0 }, uGrain: { value: 0 } },
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec2 vUv; out vec4 o;
      uniform sampler2D tVideo; uniform float uShow, uAspect, uGain, uEdge, uTime, uGrain;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float d = rbox(p, vec2(uAspect, 1.0) * 0.5, 0.03);
        float a = 1.0 - smoothstep(-0.003, 0.0, d);
        vec3 col = texture(tVideo, vUv).rgb * uGain;
        // film grain (24 fps cadence) and a gentle lens vignette, stronger as the film gets big
        float g = h12(floor(gl_FragCoord.xy) + floor(uTime * 24.0) * 17.0) - 0.5;
        col *= 1.0 + g * 0.09 * uGrain;
        col *= 1.0 - 0.28 * uGrain * smoothstep(0.35, 0.95, length((vUv - 0.5) * vec2(1.3, 1.0)) * 1.25);
        // a thin brand-lit rim on the frame
        float rim = (1.0 - smoothstep(0.0, 0.012, abs(d + 0.004))) * uEdge;
        col += mix(vec3(0.53, 0.23, 0.97), vec3(0.13, 0.80, 0.95), vUv.x) * rim * 2.0;
        o = vec4(col, a * uShow);
        if (o.a < 0.003) discard;
      }`,
  });
}

function logoCardTexture() {
  // a sample customer's logo card (fictional business), kraft stock with a stamped mark
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 512);
  grd.addColorStop(0, '#b89b74');
  grd.addColorStop(1, '#a3845d');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    // seeded, so every load (and every capture) gets the same card
    g.fillStyle = `rgba(${hash(i) < 0.5 ? '255,240,220' : '60,40,20'},${hash(i + 0.31) * 0.08})`;
    g.fillRect(hash(i + 0.52) * 512, hash(i + 0.77) * 512, 1 + hash(i + 0.93) * 2, 1);
  }
  const ink = '#2b1d12';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(256, 205, 96, 0, Math.PI * 2);
  g.stroke();
  // monogram: a stylised coupe glass
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(206, 172);
  g.quadraticCurveTo(256, 250, 306, 172);
  g.closePath();
  g.stroke();
  g.beginPath();
  g.moveTo(256, 224);
  g.lineTo(256, 268);
  g.moveTo(228, 270);
  g.lineTo(284, 270);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 46px Quicksand, sans-serif';
  g.fillText('copper & oak', 256, 352);
  g.font = '600 20px Inter, sans-serif';
  g.fillText('C O C K T A I L   B A R  ·  E S T .  2 0 1 9', 256, 400);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class StudioChapter {
  constructor(ctx) {
    this.ctx = ctx;
    this.name = 'studio';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  }

  async build() {
    const { quality, loadTexture, makeVideo } = this.ctx;
    const s = this.scene;
    s.add(backdrop([0.0035, 0.004, 0.0075], [0.0008, 0.0008, 0.0014], [0.012, 0.022, 0.04], [0.3, 0.1, -1]));
    const grid = quality.low ? [32, 18] : [56, 32];
    this.grid = grid;

    // the hero print is the film's first frame; the side prints are casual phone snaps (tools/make-snaps.py)
    const [photo, store, shelf] = await Promise.all([loadTexture('/media/reel/shot-06-first.jpg'), loadTexture('/media/snaps/shopfront.jpg'), loadTexture('/media/snaps/shelf.jpg')]);
    // the print is this clip's first frame, so the photo and the film are the same image
    this.video = makeVideo('/media/reel/shot-06.mp4');
    const vtex = new THREE.VideoTexture(this.video);
    vtex.colorSpace = THREE.SRGBColorSpace;
    vtex.generateMipmaps = false;
    this.vtex = vtex;

    // the prints (16:9 photos; width includes the border)
    const shadowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uFade: { value: 1 }, uAspect: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uFade, uAspect;
        float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){ vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0); float d = rbox(p, vec2(uAspect, 1.0) * 0.5 - 0.09, 0.05);
          float a = 1.0 - smoothstep(-0.03, 0.09, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * 0.62 * uFade); }`,
    });
    const mk = (map, w, h, dissolve) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), printMaterial({ map, aspect: w / h, dissolve, grid }));
      m.renderOrder = 2;
      // a soft contact shadow, offset down-right as if lit from the upper left
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.12, h * 1.12), shadowMat.clone());
      sh.material.uniforms.uAspect.value = w / h;
      sh.position.set(w * 0.035, -h * 0.06, -0.03);
      sh.renderOrder = 1;
      m.add(sh);
      m.userData.shadow = sh;
      s.add(m);
      return m;
    };
    this.cards = [
      // the hero print rises out of depth, centred in the ring's aperture as the iris opens
      { mesh: mk(photo, 2.6, 2.6 / PRINT, true), home: [-1.95, 0.12, 0.35], rot: [0.0, 0.3, -0.035], from: [-1.95, 0.12, -3.2], delay: 0.0 },
      { mesh: mk(logoCardTexture(), 1.05, 1.05, false), home: [-3.05, 1.3, -0.6], rot: [0.06, 0.42, 0.09], from: [-3.9, 2.6, -1.0], delay: 0.1 },
      { mesh: mk(store, 1.62 * PORTRAIT, 1.62, false), home: [-3.35, -0.95, -0.45], rot: [0.0, 0.45, 0.08], from: [-4.9, -2.2, 0.2], delay: 0.16 },
      { mesh: mk(shelf, 1.45, 1.45 / LANDSCAPE, false), home: [-0.95, -1.42, -0.9], rot: [-0.05, 0.22, -0.07], from: [0.6, -3.2, -1.2], delay: 0.22 },
    ];
    this.main = this.cards[0];
    // the photo region inside the main print's border, in world units
    const bw = 2.6, bh = 2.6 / PRINT, border = 0.045 * bh;
    this.cardPhotoSize = new THREE.Vector2(bw - 2 * border, bh - 2 * border);

    // the ring portal
    this.ringMat = ringMaterial();
    this.ringMat.uniforms.uGapAt.value = 0.72;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(RING.r, 0.03, 16, quality.low ? 160 : 300), this.ringMat);
    this.ring.position.copy(RING.pos);
    this.ring.lookAt(RING.pos.clone().add(RING.normal));
    s.add(this.ring);

    // the film screen
    this.screenMat = screenMaterial(vtex);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), this.screenMat);
    this.screen.position.copy(SCREEN.pos).add(new THREE.Vector3(0, 0, 0.045));
    this.screen.renderOrder = 3;
    s.add(this.screen);
    this.screenFrame = new THREE.Object3D();
    this.screenFrame.position.copy(SCREEN.pos);
    s.add(this.screenFrame);

    // the pixels
    const [cols, rows] = grid;
    const n = cols * rows;
    const cube = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
    const cells = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) cells.set([i % cols, Math.floor(i / cols)], i * 2);
    const ig = new THREE.InstancedBufferGeometry().copy(cube);
    ig.instanceCount = n;
    ig.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    this.pixMat = pixelFlightMaterial({ photo, video: vtex, grid });
    this.pixels = new THREE.Mesh(ig, this.pixMat);
    this.pixels.frustumCulled = false;
    this.pixels.renderOrder = 1;
    s.add(this.pixels);

    this.textures = [photo, store, shelf, vtex];
    await this.ctx.renderer.compileAsync(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.portrait = w / h < 0.9;
    this.camera.updateProjectionMatrix();
  }

  update(s, t, T, pointer = [0, 0]) {
    const cam = this.camera;
    const v = spline(T.dissolve.camera, s);
    cam.position.set(v[0] + pointer[0] * 0.12, v[1] + pointer[1] * 0.08, v[2]);
    cam.lookAt(v[3], v[4], v[5]);
    if (this.portrait) {
      // phones: the stream runs sideways, so follow it along x instead of
      // pulling back until it is tiny; land on the screen fitted to the width
      // (no full-bleed crop of a 16:9 film on a 9:19 screen)
      const P = T.film.portrait;
      const tanV = Math.tan((cam.fov * Math.PI) / 360);
      const pt = clamp((s - T.dissolve.progress[0]) / (T.dissolve.progress[1] - T.dissolve.progress[0]), 0, 1);
      const x = lerp(this.cards[0].home[0], SCREEN.pos.x, smootherstep(0.08, 0.92, pt));
      const dPrints = P.printHalfWidth / (tanV * cam.aspect);
      const dScreen = ((SCREEN.w / 2) * P.screenPad) / (tanV * cam.aspect);
      const dCover = ((SCREEN.h / 2) * 0.97) / tanV; // film height fills the phone; crop the sides
      const d = lerp(lerp(dPrints, dScreen, smoothstep(0.55, 1.0, pt)), dCover, smootherstep(T.film.pushIn[0], T.film.pushIn[1], s));
      const ny = lerp(lerp(P.ndcY.assets, P.ndcY.dissolve, smoothstep(T.assets.copyOut[0], T.dissolve.pin[0], s)), P.ndcY.film, smoothstep(T.film.videoIn[0], T.film.pushIn[0], s));
      const oy = ny * tanV * d * (1 - smoothstep(T.film.pushIn[0], T.film.pushIn[1], s));
      cam.position.set(x + pointer[0] * 0.08, 0.05 * (1 - smoothstep(T.film.pushIn[0], T.film.pushIn[1], s)) - oy, d);
      cam.lookAt(x, cam.position.y, 0);
    }

    // prints fly in and settle with a gentle bob
    const inP = (d) => smootherstep(T.assets.cardsIn[0] + d, T.assets.cardsIn[1] + d * 0.6, s);
    const P = smoothstep(T.dissolve.progress[0], T.dissolve.progress[1], s);
    const pTrue = clamp((s - T.dissolve.progress[0]) / (T.dissolve.progress[1] - T.dissolve.progress[0]), 0, 1);
    this.cards.forEach((c, i) => {
      const k = inP(c.delay);
      const m = c.mesh;
      const bob = Math.sin(t * 0.6 + i * 1.7) * 0.035;
      // the side prints drift away as the main one dissolves
      const away = i === 0 ? 0 : smoothstep(T.assets.copyOut[0] - 0.1, T.dissolve.progress[0] + 0.35, s);
      m.position.set(
        lerp(c.from[0], c.home[0], k) - away * (1.2 + i * 0.4),
        lerp(c.from[1], c.home[1], k) + bob - away * 0.4,
        lerp(c.from[2], c.home[2], k) - away * 1.5
      );
      const spin = (1 - k) * 1.2;
      m.rotation.set(c.rot[0] + spin * 0.4, c.rot[1] + spin, c.rot[2] - spin * 0.5 + Math.sin(t * 0.4 + i) * 0.012);
      m.material.uniforms.uFade.value = smoothstep(0.0, 0.25, k) * (1 - away);
      m.material.uniforms.uP.value = pTrue;
      // the shadow goes with the paper: it fades as the print leaves or dissolves
      m.userData.shadow.material.uniforms.uFade.value = m.material.uniforms.uFade.value * (i === 0 ? 1 - smoothstep(0.2, 0.6, pTrue) : 1);
    });

    // the ring wakes up as the dissolve starts
    const ringIn = smoothstep(T.dissolve.progress[0] - 0.4, T.dissolve.progress[0] + 0.15, s);
    const ringOut = 1 - smoothstep(T.film.videoIn[0], T.film.pushIn[0] + 0.2, s);
    this.ringMat.uniforms.uFade.value = ringIn * ringOut;
    this.ringMat.uniforms.uGlow.value = 3.2 + 2.5 * Math.sin(Math.PI * pTrue);
    this.ringMat.uniforms.uOpen.value = 0.7 + 0.5 * Math.sin(Math.PI * pTrue);
    this.ring.visible = ringIn * ringOut > 0.001;
    this.ring.rotateOnAxis(new THREE.Vector3(0, 0, 1), 0); // orientation is fixed by lookAt at build

    // pixel flight
    this.main.mesh.updateMatrixWorld();
    // map the cube grid onto the photo area of the print (inside the border)
    const card = this.main.mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(1, 1, 1));
    const u = this.pixMat.uniforms;
    u.uCard.value.copy(card);
    u.uCardSize.value.copy(this.cardPhotoSize);
    this.screenFrame.updateMatrixWorld();
    u.uScreen.value.copy(this.screenFrame.matrixWorld);
    u.uP.value = pTrue;
    u.uTime.value = t;
    const show = smoothstep(T.film.videoIn[0], T.film.videoIn[1], s);
    u.uHide.value = smoothstep(0.85, 1.0, show);
    this.pixels.visible = pTrue > 0 && show < 1;
    this.screenMat.uniforms.uShow.value = show;
    this.screenMat.uniforms.uEdge.value = 1 - smoothstep(T.film.pushIn[0], T.film.pushIn[1], s);
    this.screenMat.uniforms.uGrain.value = smoothstep(T.film.pushIn[0], T.film.pushIn[1], s);
    this.screenMat.uniforms.uTime.value = t;
    this.screen.visible = show > 0;
    this.show = show;
    this.filmLive = pTrue > 0.25;
    void P;
  }

  render(target) {
    const r = this.ctx.renderer;
    r.setRenderTarget(target);
    r.render(this.scene, this.camera);
  }
}
