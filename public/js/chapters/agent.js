// Chapter 3 · the Cozy Agent. A chrome orb inside the ring with a swarm
// of brand pixels orbiting it; the swarm quickens and brightens on each
// chat beat ("thinking"), and the orb's reflections follow.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, backdrop, chromeMaterial, pixelMaterial, ringMaterial } from '../gfx/brand.js';
import { hash, smoothstep, spline } from '../util.js';

export class AgentChapter {
  constructor(ctx) {
    this.ctx = ctx;
    this.name = 'agent';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  }

  async build() {
    const { env, quality } = this.ctx;
    const s = this.scene;
    s.add(backdrop([0.004, 0.0035, 0.0075], [0.0008, 0.0008, 0.0014], [0.035, 0.012, 0.05], [-0.6, 0.3, -1]));
    this.rig = new THREE.Group();
    s.add(this.rig);

    this.chrome = chromeMaterial(env, { roughness: 0.08, iridescence: 1.0, iridescenceThicknessRange: [300, 900] });
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(1.0, quality.low ? 64 : 128, quality.low ? 32 : 64), this.chrome);
    this.rig.add(this.orb);

    this.ringMat = ringMaterial();
    this.ringMat.uniforms.uOpen.value = 0.9;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.026, 16, quality.low ? 160 : 300), this.ringMat);
    this.ring.rotation.set(1.18, 0.25, 0);
    this.rig.add(this.ring);

    const N = quality.low ? 160 : 340;
    const cube = new RoundedBoxGeometry(1, 1, 1, 1, 0.14);
    const colors = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    const pal = [COLORS.cyan, COLORS.indigo, COLORS.violet, COLORS.cyan, new THREE.Color(0.85, 0.9, 1)];
    this.swarm = [];
    for (let i = 0; i < N; i++) {
      const c = pal[Math.floor(hash(i * 1.37) * pal.length)];
      colors.set([c.r, c.g, c.b], i * 3);
      seeds[i] = hash(i * 3.3);
      this.swarm.push({
        r: 1.35 + Math.pow(hash(i * 2.1), 1.8) * 1.25,
        a: hash(i * 4.2) * Math.PI * 2,
        tilt: (hash(i * 5.3) - 0.5) * 0.9,
        speed: 0.12 + hash(i * 6.4) * 0.25,
        size: 0.014 + Math.pow(hash(i * 7.5), 3) * 0.05,
        y: (hash(i * 8.6) - 0.5) * 0.5,
      });
    }
    cube.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    cube.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.pixMat = pixelMaterial();
    this.pixMat.uniforms.uGlow.value = 1.4;
    this.pixels = new THREE.InstancedMesh(cube, this.pixMat, N);
    this.pixels.frustumCulled = false;
    this.rig.add(this.pixels);
    this.dummy = new THREE.Object3D();
    this.phase = 0;
    this.lastT = 0;
    await this.ctx.renderer.compileAsync(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.portrait = w / h < 0.9;
    this.camera.updateProjectionMatrix();
  }

  update(s, t, T, pointer = [0, 0]) {
    const v = spline(T.agent.camera, s);
    const cam = this.camera;
    cam.position.set(v[0] + pointer[0] * 0.15, v[1] + pointer[1] * 0.1, v[2]);
    if (this.portrait) {
      cam.position.set(0.0, 0.2 + pointer[1] * 0.1, v[2] + 2.2);
      cam.lookAt(0, -0.85, 0);
    } else cam.lookAt(v[3], v[4], v[5]);

    // "thinking": a pulse on each chat beat
    const [c0, c1] = T.agent.chat;
    const beats = [0.1, 0.35, 0.62, 0.85].map((f) => c0 + (c1 - c0) * f);
    let pulse = 0;
    for (const b of beats) pulse = Math.max(pulse, Math.exp(-Math.pow((s - b) / 0.08, 2)));
    // phase advances with time and faster during a pulse (integrated, so it never jumps)
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.phase += dt * (1 + 2.5 * pulse);
    const ph = this.phase + s * 1.2;

    this.rig.rotation.set(0.12, ph * 0.06, 0);
    this.ring.rotation.z = ph * 0.15;
    this.ringMat.uniforms.uGlow.value = 2.2 + 2.0 * pulse;
    this.chrome.envMapRotation.set(0.2, ph * 0.22, 0);
    this.pixMat.uniforms.uTime.value = t;
    this.pixMat.uniforms.uGlow.value = 1.3 + 1.6 * pulse;

    const d = this.dummy;
    for (let i = 0; i < this.swarm.length; i++) {
      const p = this.swarm[i];
      const a = p.a + ph * p.speed * (1.6 / p.r);
      const x = Math.cos(a) * p.r, z = Math.sin(a) * p.r;
      d.position.set(x, p.y + z * p.tilt + Math.sin(ph * 0.7 + i) * 0.04, z);
      d.rotation.set(ph * 0.8 + i, ph * 0.5, 0);
      d.scale.setScalar(p.size * (1 + 0.5 * pulse * hash(i * 9.1)));
      d.updateMatrix();
      this.pixels.setMatrixAt(i, d.matrix);
    }
    this.pixels.instanceMatrix.needsUpdate = true;
    void smoothstep;
  }

  render(target) {
    const r = this.ctx.renderer;
    r.setRenderTarget(target);
    r.render(this.scene, this.camera);
  }
}
