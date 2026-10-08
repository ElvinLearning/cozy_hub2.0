// Chapter 1 · the loop. The chrome figure-eight from the brand art, threaded
// through the logo ring; the ring is open at the upper right and sheds the
// logo's pixels. Also closes the page behind the sign-up form.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, backdrop, chromeMaterial, loopCurve, pixelMaterial, ribbonGeometry, ringMaterial } from '../gfx/brand.js';
import { hash, smoothstep, smootherstep, spline, clamp, lerp } from '../util.js';

export const RING_CENTER = new THREE.Vector3(2.4, 0.1, -1.0);
const RING_R = 2.0;

export class LoopChapter {
  constructor(ctx) {
    this.ctx = ctx;
    this.name = 'loop';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    this.target = null;
    this.tmp = new THREE.Vector3();
  }

  async build() {
    const { env, quality } = this.ctx;
    const s = this.scene;
    s.add(backdrop([0.0035, 0.0038, 0.007], [0.0008, 0.0008, 0.0014], [0.03, 0.012, 0.06], [0.9, 0.35, -1]));

    this.rig = new THREE.Group();
    this.rig.position.copy(RING_CENTER);
    s.add(this.rig);

    // the ring, tilted a little toward the viewer's left
    this.ringMat = ringMaterial();
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.026, 20, quality.low ? 200 : 360), this.ringMat);
    this.ring.rotation.set(0.08, -0.22, 0);
    this.rig.add(this.ring);
    // a faint second ring of light behind it reads as the logo's glow halo
    const haloMat = ringMaterial();
    haloMat.uniforms.uGlow.value = 0.16;
    haloMat.uniforms.uOpen.value = 0.0;
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.12, 12, quality.low ? 120 : 240), haloMat);
    this.halo.rotation.copy(this.ring.rotation);
    this.halo.scale.setScalar(1.002);
    haloMat.transparent = true;
    haloMat.blending = THREE.AdditiveBlending;
    haloMat.depthWrite = false;
    this.rig.add(this.halo);
    this.haloMat = haloMat;

    // the chrome loop, threaded through the ring
    this.chrome = chromeMaterial(env);
    const geo = ribbonGeometry(loopCurve(0.82), { segments: quality.low ? 360 : 720, radial: quality.low ? 32 : 56, a: 0.27, b: 0.22, halfTurns: 3 });
    this.loop = new THREE.Mesh(geo, this.chrome);
    // tilted ~50 degrees so the figure-eight reads, crossing the ring's plane inside its hole
    this.loop.rotation.set(0.3, 0.62, 0.2);
    this.loop.position.set(0.0, -0.02, 0.0);
    this.rig.add(this.loop);

    // pixels breaking off the ring's open end
    const N = quality.low ? 36 : 64;
    const cube = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
    const colors = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    const pal = [COLORS.cyan, COLORS.indigo, COLORS.violet, COLORS.cyan];
    this.pix = [];
    for (let i = 0; i < N; i++) {
      const c = pal[Math.floor(hash(i + 3) * pal.length)];
      colors.set([c.r, c.g, c.b], i * 3);
      seeds[i] = hash(i * 7.1);
      // each pixel has a home along the gap and a drift outward
      this.pix.push({
        a: 0.72 + (hash(i * 1.3) - 0.5) * 0.9, // angle around the ring
        out: hash(i * 2.7), // how far it has drifted (0 on the ring)
        size: 0.035 + Math.pow(hash(i * 5.9), 2.2) * 0.12,
        spin: (hash(i * 9.1) - 0.5) * 2,
        z: (hash(i * 4.4) - 0.5) * 0.5,
      });
    }
    cube.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    cube.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.pixMat = pixelMaterial();
    this.pixels = new THREE.InstancedMesh(cube, this.pixMat, N);
    this.pixels.frustumCulled = false;
    this.ring.add(this.pixels);
    this.dummy = new THREE.Object3D();

    await this.ctx.renderer.compileAsync(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // portrait screens: lens-shift so the loop sits under the headline
    this.portrait = w / h < 0.9;
    this.camera.updateProjectionMatrix();
  }

  /** s: smooth scroll in vh. mode 'hero' or 'end'. */
  update(s, t, T, mode = 'hero', pointer = [0, 0]) {
    const v = spline(T.loop.camera, mode === 'hero' ? s : 0);
    const cam = this.camera;
    // narrower than 16:10 -> slide the view right so the ring stays clear of the copy
    const xAdj = mode === 'hero' && !this.portrait ? (1.6 - Math.min(cam.aspect, 1.6)) * 1.1 : 0;
    cam.position.set(v[0] + xAdj + pointer[0] * 0.18, v[1] + pointer[1] * 0.12, v[2]);
    cam.lookAt(v[3] + xAdj, v[4], v[5]);
    const C = RING_CENTER;
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    // place the ring centre at a chosen NDC point, at distance d, view axis kept parallel to z
    const frameAt = (nx, ny, d) => {
      const ox = nx * tanV * cam.aspect * d, oy = ny * tanV * d;
      cam.position.set(C.x - ox + pointer[0] * 0.12, C.y - oy + pointer[1] * 0.08, C.z + d);
      cam.lookAt(C.x - ox, C.y - oy, C.z);
    };
    if (mode === 'hero' && this.portrait) {
      const P = T.loop.portrait;
      const fit = (RING_R + P.fitPad) / (tanV * cam.aspect);
      const d = lerp(fit, P.nearDist, smootherstep(P.fly[0], P.fly[1], s));
      frameAt(0, P.ndcY * (1 - smoothstep(P.centre[0], P.centre[1], s)), d);
    } else if (mode === 'end') {
      const F = T.start.frame;
      const k = smoothstep(F.dolly[0], F.dolly[1], s);
      if (this.portrait) frameAt(0, F.portraitNdcY, (RING_R + 0.75) / (tanV * cam.aspect) * lerp(1.08, 1.0, k));
      else frameAt(F.ndc[0], F.ndc[1], lerp(F.dist[0], F.dist[1], k));
    }

    // a slow float, and reflections that slide along the chrome
    this.rig.rotation.set(Math.sin(t * 0.21) * 0.05, Math.sin(t * 0.17) * 0.09, Math.sin(t * 0.13) * 0.03);
    this.chrome.envMapRotation.set(0.25 * Math.sin(t * 0.11), t * 0.12 + s * 0.6, 0);
    this.loop.rotation.z = 0.18 + Math.sin(t * 0.3) * 0.04;

    const open = smoothstep(T.loop.ringOpen[0], T.loop.ringOpen[1], s);
    const gap = 0.75 + open * 0.55;
    this.ringMat.uniforms.uOpen.value = gap;
    // the ring is a light: keep its on-screen energy steady as the camera closes in
    const dist = cam.position.distanceTo(RING_CENTER);
    const near = Math.min(1, Math.max(0.12, (dist - 2.0) / 6.0));
    this.ringMat.uniforms.uGlow.value = (2.4 + open * 1.0) * near;
    this.haloMat.uniforms.uGlow.value = 0.16 * near * near * near;
    this.pixMat.uniforms.uTime.value = t;

    const d = this.dummy;
    for (let i = 0; i < this.pix.length; i++) {
      const p = this.pix[i];
      // pixels drift outward along the open arc and recycle
      const life = (p.out + t * (0.025 + 0.02 * p.spin * p.spin) + open * 0.35) % 1;
      const ang = p.a + (life - 0.5) * 0.15;
      const r = RING_R + 0.05 + life * (0.38 + 0.3 * open) + p.z * 0.3;
      // pixels near the arc ends sit tight; they spread as they leave
      const inGap = Math.abs(((ang - 0.72 + Math.PI) % (2 * Math.PI)) - Math.PI) < gap * 0.6;
      const sz = p.size * (1 - smoothstep(0.75, 1.0, life)) * smoothstep(0.0, 0.08, life) * (inGap || life > 0.25 ? 1 : 0.6);
      d.position.set(Math.cos(ang) * r + life * 0.12, Math.sin(ang) * r, p.z + life * p.spin * 0.4);
      d.rotation.set(t * p.spin * 0.5, t * p.spin * 0.3 + i, 0);
      d.scale.setScalar(Math.max(sz, 1e-4));
      d.updateMatrix();
      this.pixels.setMatrixAt(i, d.matrix);
    }
    this.pixels.instanceMatrix.needsUpdate = true;
  }

  /** Ring centre in screen uv, for the iris transition. */
  ringScreen() {
    this.camera.updateMatrixWorld();
    const p = this.tmp.copy(RING_CENTER).project(this.camera);
    return [clamp(p.x * 0.5 + 0.5, -0.5, 1.5), clamp(p.y * 0.5 + 0.5, -0.5, 1.5)];
  }

  render(target) {
    const r = this.ctx.renderer;
    r.setRenderTarget(target);
    r.render(this.scene, this.camera);
  }
}
