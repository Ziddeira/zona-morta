import * as THREE from 'three';
export { THREE };

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x0b0d0c);

export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
export const VIEW = { size: 7.5 };
const CAM_OFF = new THREE.Vector3(14, 19, 14);
const camTarget = new THREE.Vector3();
export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const a = w / h;
  camera.left = -VIEW.size * a; camera.right = VIEW.size * a;
  camera.top = VIEW.size; camera.bottom = -VIEW.size;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
export function camFollow(x, z, dt, snap) {
  const k = snap ? 1 : 1 - Math.exp(-dt * 6);
  camTarget.x += (x - camTarget.x) * k;
  camTarget.z += (z - camTarget.z) * k;
  camera.position.set(camTarget.x + CAM_OFF.x, CAM_OFF.y, camTarget.z + CAM_OFF.z);
  camera.lookAt(camTarget.x, 0, camTarget.z);
}
export function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, on: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
}

// ---------- Entrada: joystick que aparece onde toca + teclado ----------
export const input = { mx: 0, mz: 0, keys: {}, active: false };
const joyzone = document.getElementById('joyzone'), joy = document.getElementById('joy'), knob = document.getElementById('knob');
let jid = null, jx = 0, jy = 0, sx = 0, sy = 0;
const R = 50;
joyzone.addEventListener('pointerdown', e => {
  if (jid !== null) return;
  jid = e.pointerId; jx = e.clientX; jy = e.clientY; sx = sy = 0;
  joy.style.display = 'block'; joy.style.left = jx + 'px'; joy.style.top = jy + 'px';
  knob.style.transform = '';
  try { joyzone.setPointerCapture(e.pointerId); } catch (_) {}
});
joyzone.addEventListener('pointermove', e => {
  if (e.pointerId !== jid) return;
  let dx = e.clientX - jx, dy = e.clientY - jy;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  sx = dx / R; sy = -dy / R;
});
const endJoy = e => { if (e.pointerId !== jid) return; jid = null; sx = sy = 0; joy.style.display = 'none'; };
joyzone.addEventListener('pointerup', endJoy);
joyzone.addEventListener('pointercancel', endJoy);
window.addEventListener('keydown', e => { input.keys[e.code] = true; });
window.addEventListener('keyup', e => { input.keys[e.code] = false; });
export function resetInput() { jid = null; sx = sy = 0; joy.style.display = 'none'; input.keys = {}; }
export function readInput() {
  let ax = sx, ay = sy;
  const k = input.keys;
  if (k.KeyW || k.ArrowUp) ay += 1;
  if (k.KeyS || k.ArrowDown) ay -= 1;
  if (k.KeyD || k.ArrowRight) ax += 1;
  if (k.KeyA || k.ArrowLeft) ax -= 1;
  let m = Math.hypot(ax, ay);
  if (m > 1) { ax /= m; ay /= m; m = 1; }
  // tela -> mundo (câmera isométrica a 45°)
  const s = Math.SQRT1_2;
  input.mx = (ax - ay) * s;
  input.mz = (-ax - ay) * s;
  input.active = m > 0.12;
  input.mag = m;
  return input;
}

// ---------- Materiais e modelos chibi ----------
const matCache = new Map();
export function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...(opts || {}) }));
  return matCache.get(key);
}
const G = {
  leg: new THREE.BoxGeometry(0.15, 0.3, 0.17).translate(0, -0.15, 0),
  body: new THREE.BoxGeometry(0.42, 0.4, 0.28),
  arm: new THREE.BoxGeometry(0.12, 0.32, 0.12).translate(0, -0.14, 0),
  head: new THREE.SphereGeometry(0.3, 14, 10),
  hair: new THREE.SphereGeometry(0.315, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  eye: new THREE.BoxGeometry(0.07, 0.09, 0.03),
  gun: new THREE.BoxGeometry(0.08, 0.1, 0.34),
  cap: new THREE.CylinderGeometry(0.31, 0.31, 0.1, 14),
  brim: new THREE.BoxGeometry(0.3, 0.04, 0.2),
  shadow: new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2),
};
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
export function makeChibi(o = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const skin = mat(o.skin || '#e0b48c'), shirt = mat(o.shirt || '#3a6ea5'), pants = mat(o.pants || '#2d2d38');
  const legs = [-0.1, 0.1].map(x => { const l = new THREE.Mesh(G.leg, pants); l.position.set(x, 0.3, 0); inner.add(l); return l; });
  const body = new THREE.Mesh(G.body, shirt); body.position.y = 0.5; inner.add(body);
  const arms = [-0.28, 0.28].map(x => { const a = new THREE.Mesh(G.arm, x < 0 ? shirt : shirt); a.position.set(x, 0.66, 0); inner.add(a); return a; });
  const head = new THREE.Mesh(G.head, skin); head.position.y = 0.98; inner.add(head);
  if (o.hair) { const h = new THREE.Mesh(G.hair, mat(o.hair)); h.position.y = 1.0; h.rotation.x = -0.25; inner.add(h); }
  if (o.cap) {
    const c = new THREE.Mesh(G.cap, mat(o.cap)); c.position.y = 1.2; inner.add(c);
    const b = new THREE.Mesh(G.brim, mat(o.cap)); b.position.set(0, 1.17, 0.24); inner.add(b);
  }
  const eyeMat = o.zombie ? mat('#ff3b2f', { emissive: '#aa1100' }) : mat('#141414');
  [-0.1, 0.1].forEach(x => { const e = new THREE.Mesh(G.eye, eyeMat); e.position.set(x, 1.0, 0.285); inner.add(e); });
  let gun = null;
  if (o.gun) { gun = new THREE.Mesh(G.gun, mat('#222')); gun.position.set(0, -0.3, 0.12); arms[1].add(gun); }
  const sh = new THREE.Mesh(G.shadow, shadowMat); sh.position.y = 0.02; g.add(sh);
  if (o.zombie) { arms.forEach(a => a.rotation.x = -1.35); }
  const s = o.scale || 1; inner.scale.setScalar(s); sh.scale.setScalar(s);
  return { group: g, inner, legs, arms, body, head, gun, zombie: !!o.zombie, t: Math.random() * 10, aim: false };
}
export function animChibi(m, dt, speed) {
  m.t += dt * (4 + speed * 3);
  const sw = Math.min(1, speed) * 0.7;
  const s = Math.sin(m.t);
  m.legs[0].rotation.x = s * sw; m.legs[1].rotation.x = -s * sw;
  if (m.zombie) {
    m.arms[0].rotation.x = -1.35 + Math.sin(m.t * 0.7) * 0.12;
    m.arms[1].rotation.x = -1.35 - Math.sin(m.t * 0.7) * 0.12;
    m.inner.rotation.z = Math.sin(m.t * 0.5) * 0.08;
  } else if (m.aim) {
    m.arms[1].rotation.x = -1.5; m.arms[0].rotation.x = -1.2; m.arms[0].rotation.z = -0.5;
  } else {
    m.arms[0].rotation.x = -s * sw; m.arms[1].rotation.x = s * sw; m.arms[0].rotation.z = 0;
  }
  m.inner.position.y = Math.abs(Math.cos(m.t)) * 0.05 * Math.min(1, speed);
}

export function makeLabel(text, opts = {}) {
  const c = document.createElement('canvas');
  const fs = 44; const ctx = c.getContext('2d');
  ctx.font = `bold ${fs}px system-ui,sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 30;
  c.width = w; c.height = fs + 26;
  ctx.font = `bold ${fs}px system-ui,sans-serif`;
  ctx.fillStyle = opts.bg || 'rgba(0,0,0,0.6)';
  const r = 16; ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.fillStyle = opts.color || '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 15, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const h = opts.h || 0.45; sp.scale.set(h * w / c.height, h, 1); sp.renderOrder = 10;
  return sp;
}

// ---------- Grade (mapa em células) ----------
// 0 piso interno, 1 parede, 2 área externa, 3 entrada (porta/janela), 4 objeto bloqueante baixo
export class Grid {
  constructor(w, h, fill = 0) { this.w = w; this.h = h; this.c = new Uint8Array(w * h).fill(fill); }
  i(x, y) { return y * this.w + x; }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 1 : this.c[y * this.w + x]; }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = v; }
  // linha de visão: paredes bloqueiam (objetos baixos e entradas não)
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.get(Math.floor(ax + dx * t), Math.floor(az + dz * t)) === 1) return false;
    }
    return true;
  }
}
// move um círculo com colisão contra células bloqueadas
export function moveCircle(p, dx, dz, r, blocked) {
  const tryAxis = (nx, nz) => {
    const x0 = Math.floor(nx - r), x1 = Math.floor(nx + r), z0 = Math.floor(nz - r), z1 = Math.floor(nz + r);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!blocked(x, z)) continue;
      const cx = Math.max(x, Math.min(nx, x + 1)), cz = Math.max(z, Math.min(nz, z + 1));
      if ((nx - cx) ** 2 + (nz - cz) ** 2 < r * r) return false;
    }
    return true;
  };
  if (tryAxis(p.x + dx, p.z)) p.x += dx;
  if (tryAxis(p.x, p.z + dz)) p.z += dz;
}
// Dijkstra a partir do alvo (campo de fluxo para os zumbis)
export function flowField(grid, tx, ty, cost) {
  const W = grid.w, H = grid.h, N = W * H;
  const dist = new Float64Array(N).fill(Infinity);
  const heap = []; // [d, idx]
  const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const s = ty * W + tx; dist[s] = 0; push(0, s);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [ox, oy, w] of D) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = cost(nx, ny); if (c === Infinity) continue;
      if (ox && oy && (cost(x + ox, y) === Infinity || cost(x, y + oy) === Infinity)) continue;
      const nd = d + w * c, ni = ny * W + nx;
      if (nd < dist[ni]) { dist[ni] = nd; push(nd, ni); }
    }
  }
  return dist;
}

// ---------- Utilidades ----------
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function pickWeighted(obj) {
  let tot = 0; for (const k in obj) tot += obj[k];
  let r = Math.random() * tot;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
export function toast(msg) {
  const t = document.getElementById('toast');
  const d = document.createElement('div'); d.textContent = msg; t.appendChild(d);
  setTimeout(() => d.remove(), 2700);
  while (t.children.length > 3) t.firstChild.remove();
}
export function disposeScene(scene) {
  scene.traverse(o => {
    if (o.userData.manter) return;
    if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose();
    if (o.material && o.material.map) o.material.map.dispose();
  });
}

// ---------- Som sintetizado (sem arquivos) ----------
let actx = null;
export const getAudioCtx = () => actx;
export function initAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (_) {} }
let lastSfx = {};
export function sfx(kind) {
  if (!actx) return;
  const now = actx.currentTime;
  if (lastSfx[kind] && now - lastSfx[kind] < 0.05) return;
  lastSfx[kind] = now;
  try {
    const g = actx.createGain(); g.connect(actx.destination);
    if (kind === 'tiro' || kind === 'escopeta') {
      const len = kind === 'escopeta' ? 0.25 : 0.1;
      const b = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const s = actx.createBufferSource(); s.buffer = b;
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'escopeta' ? 1400 : 2600;
      s.connect(f); f.connect(g); g.gain.value = kind === 'escopeta' ? 0.35 : 0.18; s.start();
    } else {
      const o = actx.createOscillator(); o.connect(g);
      const P = { faca: ['triangle', 900, 300, 0.08, 0.12], hit: ['square', 160, 60, 0.07, 0.06], dano: ['sawtooth', 120, 50, 0.25, 0.2], grunhido: ['sawtooth', 90, 60, 0.5, 0.05], ok: ['sine', 520, 880, 0.15, 0.12], barr: ['square', 200, 140, 0.1, 0.08], morte: ['sawtooth', 300, 40, 0.8, 0.2] }[kind] || ['sine', 440, 440, 0.1, 0.1];
      o.type = P[0]; o.frequency.setValueAtTime(P[1], now); o.frequency.exponentialRampToValueAtTime(P[2], now + P[3]);
      g.gain.setValueAtTime(P[4], now); g.gain.exponentialRampToValueAtTime(0.001, now + P[3]);
      o.start(now); o.stop(now + P[3] + 0.02);
    }
  } catch (_) {}
}
