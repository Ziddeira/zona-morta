import { THREE, makeChibi, animChibi, Grid, moveCircle, flowField, rand, randi, pick, pickWeighted, toast, sfx, mat, makeLabel, camFollow, toScreen, readInput, VIEW, resize } from './engine.js';
import { AREAS, DIFICULDADES, ZUMBIS, ITENS, statsArma, BALAS_POR_PENTE, SEG_POR_COMBUSTIVEL, TEMPO_RECARGA } from './data.js';
import { S, capMochila, bonusExpedicao } from './state.js';
import * as ui from './ui.js';
import { modeloPronto, criarAnimado, animar, play, segurarArma, ARMA_3D, ANIM_ARMA, criarObjeto, criarSobrevivente, somZumbi } from './models.js';

const ACAO_NOMES = { saquear: 'Saquear', barricar: 'Barricar', reforcar: 'Reforçar', gerador: 'Reparar gerador', camera: 'Ativar câmera', resgatar: 'Resgatar' };

export class Expedition {
  constructor(cfg, onEnd) {
    this.cfg = cfg; this.onEnd = onEnd;
    this.area = AREAS[cfg.area]; this.loc = this.area.locais[cfg.loc]; this.diff = DIFICULDADES[cfg.diff];
    this.bonus = bonusExpedicao(cfg.esquadrao);
    this.scene = new THREE.Scene();
    this.zombies = []; this.projs = []; this.fx = []; this.comps = [];
    this.t = 0; this.ended = false;
    VIEW.size = 6.5; resize();
    this.gerar();
    this.montarCena();
    this.montarEntidades();
    this.montarHUD();
    this.fase = 'calma'; this.timer = 45; this.horda = 0; this.toSpawn = 0; this.spawnT = 0; this.xprog = 0;
    this.flowT = 0; this.flow = null; this.recalcFlow();
    camFollow(this.player.pos.x, this.player.pos.z, 0, true);
    toast(`${this.loc.nome} — prepare as barricadas!`);
  }

  // ================= GERAÇÃO DO MAPA =================
  gerar() {
    const [bw, bh] = this.area.tam, M = 6, W = bw + 2 * M, H = bh + 2 * M;
    const g = new Grid(W, H, 2); this.grid = g; this.M = M;
    const X0 = M, Y0 = M, X1 = M + bw - 1, Y1 = M + bh - 1;
    this.bounds = { X0, Y0, X1, Y1 };
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) g.set(x, y, (x === X0 || x === X1 || y === Y0 || y === Y1) ? 1 : 0);
    const gaps = [], leaves = [];
    const adjGap = (x, y) => gaps.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1);
    const split = (x0, y0, x1, y1, d) => {
      const w = x1 - x0 + 1, h = y1 - y0 + 1, canV = w >= 11, canH = h >= 9;
      if (d >= 4 || (!canV && !canH) || (d >= 2 && Math.random() < 0.25)) { leaves.push({ x0, y0, x1, y1 }); return; }
      const vert = canV && (!canH || w / h > 1.25 || (w / h > 0.8 && Math.random() < 0.5));
      if (vert) {
        const s = randi(x0 + 4, x1 - 4), gy = randi(y0 + 1, y1 - 2);
        for (let y = y0; y <= y1; y++) { if (y === gy || y === gy + 1 || adjGap(s, y)) continue; g.set(s, y, 1); }
        gaps.push([s, gy], [s, gy + 1]);
        split(x0, y0, s - 1, y1, d + 1); split(s + 1, y0, x1, y1, d + 1);
      } else {
        const s = randi(y0 + 3, y1 - 3), gx = randi(x0 + 1, x1 - 2);
        for (let x = x0; x <= x1; x++) { if (x === gx || x === gx + 1 || adjGap(x, s)) continue; g.set(x, s, 1); }
        gaps.push([gx, s], [gx + 1, s]);
        split(x0, y0, x1, s - 1, d + 1); split(x0, s + 1, x1, y1, d + 1);
      }
    };
    split(X0 + 1, Y0 + 1, X1 - 1, Y1 - 1, 0);
    this.leaves = leaves;
    // entradas (portas e janelas) na parede externa
    const cand = [];
    for (let x = X0 + 2; x <= X1 - 3; x++) { cand.push({ x, y: Y0, ix: 0, iy: 1, ax: 1, ay: 0 }); cand.push({ x, y: Y1, ix: 0, iy: -1, ax: 1, ay: 0 }); }
    for (let y = Y0 + 2; y <= Y1 - 3; y++) { cand.push({ x: X0, y, ix: 1, iy: 0, ax: 0, ay: 1 }); cand.push({ x: X1, y, ix: -1, iy: 0, ax: 0, ay: 1 }); }
    cand.sort(() => Math.random() - 0.5);
    this.entradas = []; this.entryAt = new Map();
    const reservado = new Set();
    for (const c of cand) {
      if (this.entradas.length >= this.area.entradas) break;
      const tipo = Math.random() < 0.45 ? 'porta' : 'janela';
      const cells = tipo === 'porta' ? [[c.x, c.y], [c.x + c.ax, c.y + c.ay]] : [[c.x, c.y]];
      const ok = cells.every(([x, y]) => g.get(x, y) === 1 && g.get(x + c.ix, y + c.iy) === 0 &&
        this.entradas.every(e => e.cells.every(([ex, ey]) => Math.abs(ex - x) + Math.abs(ey - y) > 3)));
      if (!ok) continue;
      const e = { cells, tipo, hp: 0, ix: c.ix, iy: c.iy, ax: c.ax, ay: c.ay, planks: [] };
      cells.forEach(([x, y]) => { g.set(x, y, 3); this.entryAt.set(g.i(x, y), e); reservado.add(g.i(x + c.ix, y + c.iy)); });
      e.cx = cells.reduce((a, b) => a + b[0], 0) / cells.length + 0.5;
      e.cz = cells.reduce((a, b) => a + b[1], 0) / cells.length + 0.5;
      this.entradas.push(e);
    }
    gaps.forEach(([x, y]) => { for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) reservado.add(g.i(x + ox, y + oy)); });
    // salas especiais
    const centro = l => [Math.floor((l.x0 + l.x1) / 2), Math.floor((l.y0 + l.y1) / 2)];
    const sp = pick(leaves); this.salaSpawn = sp;
    const [sx, sy] = centro(sp); this.spawn = { x: sx + 0.5, z: sy + 0.5 };
    const bfs = (fx, fy) => {
      const d = new Int32Array(W * H).fill(-1); const q = [g.i(fx, fy)]; d[q[0]] = 0;
      for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ox, ny = y + oy; if (g.get(nx, ny) !== 0) continue; const ni = g.i(nx, ny); if (d[ni] < 0) { d[ni] = d[i] + 1; q.push(ni); } } }
      return d;
    };
    const d0 = bfs(sx, sy);
    let best = null, bd = -1;
    for (const l of leaves) { const [cx, cy] = centro(l); const v = d0[g.i(cx, cy)]; if (v > bd && l !== sp) { bd = v; best = l; } }
    this.salaExtr = best || sp;
    const [ex, ey] = centro(this.salaExtr); this.extr = { x: ex + 0.5, z: ey + 0.5 };
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { reservado.add(g.i(sx + ox, sy + oy)); reservado.add(g.i(ex + ox, ey + oy)); }
    const floorCount = () => { let n = 0; for (let i = 0; i < g.c.length; i++) if (g.c[i] === 0) n++; return n; };
    let total = floorCount();
    const conectado = () => { const d = bfs(sx, sy); let n = 0; for (let i = 0; i < d.length; i++) if (d[i] >= 0) n++; return n === total; };
    // garante que o mapa inteiro está conectado (se não, abre passagem)
    if (!conectado()) { for (const [x, y] of gaps) { for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.get(x + ox, y + oy) === 1 && x + ox > X0 && x + ox < X1 && y + oy > Y0 && y + oy < Y1) g.set(x + ox, y + oy, 0); } total = floorCount(); }
    const borda = l => { const out = []; for (let y = l.y0; y <= l.y1; y++) for (let x = l.x0; x <= l.x1; x++) if (x === l.x0 || x === l.x1 || y === l.y0 || y === l.y1) out.push([x, y]); return out; };
    const bloquear = (x, y) => {
      if (g.get(x, y) !== 0 || reservado.has(g.i(x, y))) return false;
      g.set(x, y, 4); total--;
      if (!conectado()) { g.set(x, y, 0); total++; return false; }
      reservado.add(g.i(x, y)); return true;
    };
    const colocar = (salas, tries = 40) => { for (let k = 0; k < tries; k++) { const l = pick(salas); const [x, y] = pick(borda(l)); if (bloquear(x, y)) return [x, y]; } return null; };
    const outras = leaves.filter(l => l !== sp && l !== this.salaExtr);
    const salasG = outras.length ? outras : leaves;
    const gp = colocar(salasG); this.gerador = gp ? { x: gp[0], y: gp[1], ok: false } : null;
    this.cameras = [];
    for (let k = 0; k < 3; k++) { const c = colocar(leaves); if (c) this.cameras.push({ x: c[0], y: c[1], ok: false }); }
    this.caixas = [];
    for (let k = 0; k < this.area.caixas; k++) { const c = colocar(leaves); if (c) this.caixas.push({ x: c[0], y: c[1], itens: this.rolarLoot() }); }
    this.decos = [];
    for (const l of leaves) { const n = randi(1, 3); for (let k = 0; k < n; k++) { const c = colocar([l], 6); if (c) this.decos.push(c); } }
    // sobrevivente preso
    this.preso = null;
    if (Math.random() < this.area.resgate && outras.length) {
      for (let k = 0; k < 30; k++) { const l = pick(outras); const x = randi(l.x0 + 1, l.x1 - 1), y = randi(l.y0 + 1, l.y1 - 1); if (g.get(x, y) === 0 && !reservado.has(g.i(x, y))) { this.preso = { x: x + 0.5, z: y + 0.5 }; break; } }
    }
    // pontos de nascimento dos zumbis (lado de fora, longe do prédio)
    this.spawnZ = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.get(x, y) === 2 && (x < X0 - 3 || x > X1 + 3 || y < Y0 - 3 || y > Y1 + 3)) this.spawnZ.push([x, y]);
  }
  rolarLoot() {
    const n = Math.max(1, Math.round(randi(1, 3) * this.diff.loot)); const it = {};
    for (let k = 0; k < n; k++) { const id = pickWeighted(this.loc.loot); it[id] = (it[id] || 0) + 1; }
    return it;
  }

  // ================= CENA 3D =================
  montarCena() {
    const g = this.grid, sc = this.scene, cores = this.loc.cores;
    sc.background = new THREE.Color('#0b0d0c');
    this.hemi = new THREE.HemisphereLight('#c9d6ff', '#2a2a22', 1.15); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe7c4', 0.6); this.sun.position.set(8, 20, 14); sc.add(this.sun);
    this.lanterna = new THREE.PointLight('#ffe2a8', 14, 10, 1.4); this.lanterna.position.y = 2.2; sc.add(this.lanterna);
    // piso via textura gerada
    const P = 8, cv = document.createElement('canvas'); cv.width = g.w * P; cv.height = g.h * P;
    const ctx = cv.getContext('2d');
    const piso = new THREE.Color(cores.piso), fora = new THREE.Color(cores.fora);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const v = g.get(x, y); let c;
      if (v === 2) { c = fora.clone().offsetHSL(0, 0, rand(-0.025, 0.025)); }
      else { c = piso.clone().offsetHSL(0, 0, ((x + y) % 2) ? 0.03 : -0.01); if (v === 3) c.offsetHSL(0, 0, -0.08); }
      ctx.fillStyle = '#' + c.getHexString(); ctx.fillRect(x * P, y * P, P, P);
    }
    // marca de evacuação no chão
    ctx.strokeStyle = '#e9f45a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.extr.x * P, this.extr.z * P, 1.6 * P, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e9f45a'; ctx.font = `bold ${P * 1.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', this.extr.x * P, this.extr.z * P);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(g.w, g.h).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    chao.position.set(g.w / 2, 0, g.h / 2); sc.add(chao);
    // paredes (instanciadas)
    const walls = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === 1) walls.push([x, y]);
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.9, 1), new THREE.MeshLambertMaterial({ color: cores.parede }), walls.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    walls.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, 0.45, y + 0.5); wm.setMatrixAt(i, m4); col.set(cores.parede).offsetHSL(0, 0, rand(-0.04, 0.03)); wm.setColorAt(i, col); });
    sc.add(wm);
    // topo escuro das paredes ajuda a ler o mapa
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.002, 0.06, 1.002), mat('#' + new THREE.Color(cores.parede).multiplyScalar(0.55).getHexString()), walls.length);
    walls.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, 0.91, y + 0.5); tm.setMatrixAt(i, m4); }); sc.add(tm);
    // entradas
    const madeira = mat('#b0743a'), vidro = mat('#7fb6c9', { transparent: true, opacity: 0.5 });
    for (const e of this.entradas) {
      for (const [x, y] of e.cells) {
        if (e.tipo === 'janela') {
          const s = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 1), mat(cores.parede)); s.position.set(x + 0.5, 0.125, y + 0.5); sc.add(s);
          const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), mat(cores.parede)); top.position.set(x + 0.5, 0.84, y + 0.5); sc.add(top);
        } else {
          const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), mat(cores.parede)); top.position.set(x + 0.5, 0.84, y + 0.5); sc.add(top);
        }
      }
      // tábuas (até 3)
      for (let k = 0; k < 3; k++) {
        const len = e.cells.length;
        const pl = new THREE.Mesh(new THREE.BoxGeometry(e.ax ? len + 0.2 : 0.22, 0.17, e.ay ? len + 0.2 : 0.22), madeira);
        pl.position.set(e.cx + e.ix * 0.42, 0.25 + k * 0.22, e.cz + e.iy * 0.42);
        pl.rotation.y = (Math.random() - 0.5) * 0.15; pl.rotation[e.ax ? 'z' : 'x'] = (k - 1) * 0.18;
        pl.visible = false; sc.add(pl); e.planks.push(pl);
      }
    }
    // caixas de saque
    const corCaixa = { posto: '#b84a3a', delegacia: '#4b5d7a', hospital: '#d9d9d9', mercado: '#c8a050', escola: '#6a8a4a', fabrica: '#7a7a6a' }[this.loc.deco] || '#8a6a4a';
    this.marcGeo = new THREE.OctahedronGeometry(0.16);
    for (const c of this.caixas) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), mat(corCaixa)); m.position.set(c.x + 0.5, 0.325, c.y + 0.5); sc.add(m);
      const tampa = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.84), mat('#3a3a3a')); tampa.position.set(c.x + 0.5, 0.68, c.y + 0.5); sc.add(tampa);
      const mk = new THREE.Mesh(this.marcGeo, mat('#ffd84a', { emissive: '#aa8800' })); mk.position.set(c.x + 0.5, 1.05, c.y + 0.5); sc.add(mk);
      c.mesh = m; c.mk = mk;
    }
    // decoração temática
    for (const [x, y] of this.decos) sc.add(this.decoMesh(x, y));
    // gerador
    if (this.gerador) {
      const gr = new THREE.Group(); gr.position.set(this.gerador.x + 0.5, 0, this.gerador.y + 0.5);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.7), mat('#d9b52b')); b.position.y = 0.35; gr.add(b);
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), mat('#333')); t2.position.set(0.15, 0.85, 0); gr.add(t2);
      const luz = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#ff3030', { emissive: '#ff0000' })); luz.position.set(-0.25, 0.78, 0); gr.add(luz);
      this.gerador.luz = luz; sc.add(gr);
      const lb = makeLabel('⚡ Gerador', { h: 0.5 }); lb.position.set(this.gerador.x + 0.5, 1.6, this.gerador.y + 0.5); sc.add(lb); this.gerador.label = lb;
    }
    for (const c of this.cameras) {
      const gr = new THREE.Group(); gr.position.set(c.x + 0.5, 0, c.y + 0.5);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.4), mat('#333a40')); p.position.y = 0.45; gr.add(p);
      const tela = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.05), mat('#111', { emissive: '#0a1a0a' })); tela.position.set(0, 0.7, 0.21); gr.add(tela);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#ff3030', { emissive: '#ff0000' })); l.position.set(0, 0.98, 0); gr.add(l);
      c.luz = l; c.tela = tela; sc.add(gr);
    }
    // zona de extração
    this.zona = new THREE.Group(); this.zona.position.set(this.extr.x, 0, this.extr.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5ef0ff', transparent: true, opacity: 0.8 }));
    ring.position.y = 0.03; this.zona.add(ring);
    const col2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#5ef0ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    col2.position.y = 3; this.zona.add(col2);
    this.zona.visible = false; sc.add(this.zona);
    // árvores e carros do lado de fora (decorativos)
    const { X0, Y0, X1, Y1 } = this.bounds;
    for (let k = 0; k < 26; k++) {
      const x = rand(0.5, g.w - 0.5), z = rand(0.5, g.h - 0.5);
      if (x > X0 - 2.5 && x < X1 + 3.5 && z > Y0 - 2.5 && z < Y1 + 3.5) continue;
      const tr = new THREE.Group(); tr.position.set(x, 0, z);
      if (Math.random() < 0.7) {
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), mat('#4a3523')); tronco.position.y = 0.35; tr.add(tronco);
        const copa = new THREE.Mesh(new THREE.ConeGeometry(rand(0.5, 0.8), rand(1.2, 1.8), 7), mat(pick(['#2f4a2a', '#3a5530', '#2a3d27']))); copa.position.y = 1.4; tr.add(copa);
      } else {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.9), mat(pick(['#6a2a2a', '#2a3d6a', '#555', '#6a6a2a']))); car.position.y = 0.4; tr.add(car);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.8), mat('#222')); cab.position.y = 0.85; tr.add(cab);
        tr.rotation.y = rand(0, Math.PI);
      }
      sc.add(tr);
    }
    // efeitos reutilizáveis
    this.projGeo = new THREE.BoxGeometry(0.06, 0.06, 0.35);
    this.projMat = new THREE.MeshBasicMaterial({ color: '#fff3a0' });
    this.sangueGeo = new THREE.CircleGeometry(0.3, 8).rotateX(-Math.PI / 2);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffdd77' })); this.flash.visible = false; sc.add(this.flash);
  }
  decoMesh(x, y) {
    const gr = new THREE.Group(); gr.position.set(x + 0.5, 0, y + 0.5);
    const box = (w, h, d, c, px = 0, py = h / 2, pz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(px, py, pz); gr.add(m); return m; };
    switch (this.loc.deco) {
      case 'posto': if (Math.random() < 0.5) { box(0.5, 1.1, 0.4, '#c23b2b'); box(0.4, 0.25, 0.42, '#eee', 0, 0.85); } else { box(0.9, 0.5, 0.6, '#3b6fb0'); } break;
      case 'delegacia': if (Math.random() < 0.5) { box(0.9, 0.45, 0.6, '#6b4a2b'); box(0.3, 0.25, 0.25, '#222', 0.2, 0.58); } else { box(0.9, 1.0, 0.25, '#555d66'); } break;
      case 'hospital': box(0.9, 0.35, 0.6, '#e9eef0'); box(0.3, 0.12, 0.5, '#9ad', -0.3, 0.41); break;
      case 'mercado': box(0.9, 1.1, 0.5, '#6d6d72'); for (let k = 0; k < 3; k++) box(0.8, 0.18, 0.4, pick(['#d94', '#4a9', '#c44', '#48c', '#dc4']), 0, 0.3 + k * 0.33); break;
      case 'escola': box(0.8, 0.45, 0.55, '#a67c45'); box(0.35, 0.25, 0.3, '#3b5a8a', 0, 0.2, 0.4); break;
      default: box(0.9, rand(0.6, 1.1), 0.7, '#6f6f64'); box(0.3, 0.3, 0.3, '#c9a227', 0.2, 0.9); break;
    }
    return gr;
  }

  // ================= ENTIDADES =================
  montarEntidades() {
    const cfg = this.cfg;
    const p = this.player = { pos: new THREE.Vector3(this.spawn.x, 0, this.spawn.z), maxHp: 100 + this.bonus.vida, hp: 0, cd: 0, faca: 0, inv: 0, mortes: 0, face: 0 };
    p.hp = p.maxHp;
    p.model = modeloPronto('protagonista') ? criarAnimado('protagonista') : makeChibi({ shirt: '#2f5d8a', pants: '#2b2b33', skin: '#d9a77c', cap: '#3d5f22', gun: true });
    this.scene.add(p.model.group);
    this.armas = ['principal', 'secundaria', 'pistola'].filter(s => cfg.armas[s]).map(s => statsArma(cfg.armas[s], S.armas[cfg.armas[s]] || 1));
    if (!this.armas.length) this.armas.push(statsArma('pistola', 1));
    this.armaIdx = 0;
    this.balas = (cfg.itens.municao || 0) * BALAS_POR_PENTE;
    this.armas.forEach(a => { if (a.infinita) a.mag = a.pente; else if (a.pente) { a.mag = Math.min(a.pente, this.balas); this.balas -= a.mag; } else a.mag = 0; });
    this.faca = statsArma('faca', S.armas.faca || 1);
    p.recarga = 0; p.chamaT = 0;
    if (p.model.animado) segurarArma(p.model, this.armas[0].id);
    this.mochila = {}; for (const k in cfg.itens) if (k !== 'municao' && cfg.itens[k] > 0) this.mochila[k] = cfg.itens[k];
    this.levados = { ...cfg.itens };
    // companheiros
    for (const id of cfg.esquadrao) {
      const sv = S.sobreviventes.find(s => s.id === id); if (!sv) continue;
      const m = criarSobrevivente(sv, { armado: true });
      const c = { sv, pos: new THREE.Vector3(this.spawn.x + rand(-1, 1), 0, this.spawn.z + rand(-1, 1)), hp: 70, maxHp: 70, cd: 0, vivo: true, model: m, armado: true };
      moveCircle(c.pos, 0, 0, 0.3, (x, y) => this.pBlocked(x, y));
      this.scene.add(m.group); this.comps.push(c);
    }
    if (this.preso) {
      const sv = this.novoResgatado();
      const m = criarSobrevivente(sv, { preso: true });
      m.group.position.set(this.preso.x, 0, this.preso.z);
      m.group.rotation.y = rand(0, 6.28);
      this.scene.add(m.group);
      const lb = makeLabel('🆘 Sobrevivente', { h: 0.5, bg: 'rgba(120,20,20,0.75)' }); lb.position.set(this.preso.x, 1.75, this.preso.z); this.scene.add(lb);
      this.preso.sv = sv; this.preso.model = m; this.preso.label = lb; this.preso.estado = 'preso';
    }
  }
  novoResgatado() {
    const profs = ['enfermeiro', 'farmaceutico', 'militar', 'militar', 'fabricante', 'agricultor', 'pecuarista'];
    const skins = ['#f1c9a5', '#e0b48c', '#c68e5f', '#9c6640', '#6e4528', '#4a2f1d'];
    const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Lucas', 'Marta', 'Nilo', 'Rita', 'Sérgio', 'Tânia', 'Vítor', 'Yara', 'Zeca'];
    return { id: null, nome: pick(nomes), prof: pick(profs), posto: null, skin: pick(skins), shirt: pick(['#a0522d', '#5f7f3f', '#7a4f8a', '#b08a3a', '#3f6f8f', '#8f3f3f']), hair: pick(['#2a1a10', '#4a2f1d', '#111', '#8a6a3a', '#bbb']) };
  }
  pBlocked(x, y) { return this.grid.get(x, y) !== 0; }
  zBlocked(x, y) { const v = this.grid.get(x, y); if (v === 1 || v === 4) return true; if (v === 3) return this.entryAt.get(this.grid.i(x, y)).hp > 0; return false; }
  usoMochila() { let n = 0; for (const k in this.mochila) n += this.mochila[k]; return n + Math.ceil(this.balas / BALAS_POR_PENTE); }

  // ================= HUD =================
  montarHUD() {
    document.getElementById('hudTL').innerHTML = `
      <div class="bar"><i id="hpI"></i></div>
      <div class="row" style="gap:5px"><div class="chip" id="vidasC"></div><div class="chip" id="balasC"></div></div>
      <div class="chip pe" id="mochC" style="width:max-content">🎒 0/0</div>`;
    document.getElementById('hudTC').innerHTML = `<div class="chip" id="wave"></div><div class="bar hidden" id="xbar"><i id="xbarI" style="width:0"></i></div><button class="sb pe hidden" id="skipB" style="margin-top:5px">⏩ Chamar horda agora</button>`;
    document.getElementById('hudTR').innerHTML = (S.teste ? `<button class="cbtn pe" id="testeB" style="width:46px;height:46px;font-size:18px;border-color:#e9f45a">🧪</button>` : '') + `<button class="cbtn pe" id="pauseB" style="width:46px;height:46px;font-size:18px">⏸</button>`;
    document.getElementById('hudBR').innerHTML = `
      <button class="cbtn pe" id="bandB">🩹<small>Bandagem</small><span class="cnt" id="bandN">0</span></button>
      <button class="cbtn pe" id="remB">💊<small>Remédio</small><span class="cnt" id="remN">0</span></button>
      <button class="cbtn pe" id="weapon"></button>
      <button class="cbtn big pe off" id="acaoB"><span id="acaoT">—</span><div class="prog" id="acaoP"></div></button>`;
    const $ = id => document.getElementById(id);
    this.el = { hp: $('hpI'), vidas: $('vidasC'), balas: $('balasC'), moch: $('mochC'), wave: $('wave'), xbar: $('xbar'), xbarI: $('xbarI'), skip: $('skipB'), weapon: $('weapon'), acao: $('acaoB'), acaoT: $('acaoT'), acaoP: $('acaoP'), bandN: $('bandN'), remN: $('remN'), inds: $('inds') };
    this.el.inds.innerHTML = '';
    this.inds = [];
    for (let k = 0; k < 10; k++) { const d = document.createElement('div'); d.className = 'ind'; d.style.display = 'none'; this.el.inds.appendChild(d); this.inds.push(d); }
    const tap = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap(this.el.acao, () => this.iniciarAcao());
    tap(this.el.weapon, () => this.trocarArma());
    tap($('bandB'), () => this.curar('bandagem'));
    tap($('remB'), () => this.curar('remedio'));
    tap(this.el.skip, () => { if (this.fase === 'calma') this.timer = 0; });
    tap($('pauseB'), () => this.pausar());
    if (S.teste) tap($('testeB'), () => this.painelTeste());
    tap(this.el.moch, () => this.verMochila());
    this.keyH = e => {
      if (ui.isOpen()) return;
      if (e.code === 'KeyE' || e.code === 'Space') this.iniciarAcao();
      if (e.code === 'KeyQ') this.trocarArma();
      if (e.code === 'Digit1') this.curar('bandagem');
      if (e.code === 'Digit2') this.curar('remedio');
      if (e.code === 'Escape') this.pausar();
    };
    window.addEventListener('keydown', this.keyH);
    this.atualizarHUD(true);
  }
  atualizarHUD() {
    const p = this.player, e = this.el;
    e.hp.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    const rest = this.diff.mortes - p.mortes;
    e.vidas.textContent = this.diff.mortes === 0 ? '☠️ Hardcore' : `❤️ ${'●'.repeat(Math.max(0, rest))}${'○'.repeat(p.mortes)} vidas extras`;
    e.balas.textContent = `🔫 ${this.balas}`;
    e.moch.textContent = `🎒 ${this.usoMochila()}/${capMochila()}`;
    const a = this.armas[this.armaIdx];
    const mun = a.chamas ? `⛽ ${(this.mochila.combustivel || 0)} + ${Math.ceil(this.player.chamaT)}s` : `${a.mag}/${a.pente} · ${a.infinita ? '∞' : this.balas}`;
    e.weapon.innerHTML = `${a.nome}${a.tier > 1 ? ' T' + a.tier : ''}<br><small style="opacity:.75">${this.player.recarga > 0 ? 'recarregando…' : mun} · trocar</small>`;
    e.bandN.textContent = this.mochila.bandagem || 0; e.remN.textContent = this.mochila.remedio || 0;
    let w = '';
    if (this.fase === 'calma') w = `Calmaria · horda ${this.horda + 1}/${this.area.hordas} em ${Math.ceil(this.timer)}s<small>Barricade portas e janelas, saqueie e conserte o gerador</small>`;
    else if (this.fase === 'horda') w = `🧟 Horda ${this.horda}/${this.area.hordas} · ${this.zombies.length + this.toSpawn} zumbis`;
    else if (this.fase === 'extracao') w = `🚁 Evacuação liberada!<small>Vá até o ponto H e aguente a horda final</small>`;
    else if (this.fase === 'extraindo') w = `🚁 Extraindo… ${Math.floor(this.xprog * 100)}%<small>${this.dentroZona ? 'Fique dentro do círculo!' : '⚠️ Volte para o círculo — a barra está pausada'}</small>`;
    e.wave.innerHTML = w;
    e.skip.classList.toggle('hidden', this.fase !== 'calma');
    e.xbar.classList.toggle('hidden', this.fase !== 'extraindo');
    e.xbarI.style.width = (this.xprog * 100) + '%';
  }

  // ================= AÇÕES =================
  alvoProximo() {
    const p = this.player.pos; let best = null, bd = 1.65;
    const d = (x, z) => Math.hypot(p.x - x, p.z - z);
    for (const c of this.caixas) { const v = d(c.x + 0.5, c.y + 0.5); if (c.itens && v < bd) { bd = v; best = { tipo: 'saquear', alvo: c, dur: 1.6 / this.bonus.saque }; } }
    for (const e of this.entradas) {
      const v = d(e.cx + e.ix, e.cz + e.iy);
      if (v < bd + 0.2 && e.hp < 180) { bd = v; best = { tipo: e.hp > 0 ? 'reforcar' : 'barricar', alvo: e, dur: 1.0, precisa: 'tabua' }; }
    }
    if (this.gerador && !this.gerador.ok) { const v = d(this.gerador.x + 0.5, this.gerador.y + 0.5); if (v < bd) { bd = v; best = { tipo: 'gerador', alvo: this.gerador, dur: 3, precisa: 'gerador' }; } }
    for (const c of this.cameras) { const v = d(c.x + 0.5, c.y + 0.5); if (!c.ok && v < bd) { bd = v; best = { tipo: 'camera', alvo: c, dur: 1, precisa: 'energia' }; } }
    if (this.preso && this.preso.estado === 'preso') { const v = d(this.preso.x, this.preso.z); if (v < bd + 0.3) { bd = v; best = { tipo: 'resgatar', alvo: this.preso, dur: 2 }; } }
    return best;
  }
  podeFazer(a) {
    if (!a) return 'Nada por perto';
    if (a.precisa === 'tabua' && !(this.mochila.tabua > 0)) return 'Sem tábuas';
    if (a.precisa === 'gerador' && !(this.mochila.engrenagem > 0 && this.mochila.fio > 0)) return 'Precisa 1⚙️ + 1🔌';
    if (a.precisa === 'energia' && !this.gerador?.ok) return 'Sem energia';
    if (a.tipo === 'saquear' && this.usoMochila() >= capMochila()) return 'Mochila cheia';
    return null;
  }
  iniciarAcao() {
    if (this.acao) return;
    const a = this.alvoProximo(); const err = this.podeFazer(a);
    if (err) { if (a) toast(err); return; }
    this.acao = { ...a, t: 0, x: this.player.pos.x, z: this.player.pos.z };
  }
  concluirAcao(a) {
    const tirar = (k, n = 1) => { this.mochila[k] -= n; if (this.mochila[k] <= 0) delete this.mochila[k]; };
    if (a.tipo === 'saquear') {
      const c = a.alvo, got = [];
      for (const k in c.itens) {
        while (c.itens[k] > 0 && this.usoMochila() < capMochila()) {
          c.itens[k]--; if (k === 'municao') this.balas += BALAS_POR_PENTE; else this.mochila[k] = (this.mochila[k] || 0) + 1;
          got.push(ITENS[k].ic);
        }
        if (c.itens[k] <= 0) delete c.itens[k];
      }
      if (!Object.keys(c.itens).length) { c.itens = null; c.mk.visible = false; c.mesh.material = mat('#4a4a4a'); }
      toast(got.length ? `Pegou ${got.join(' ')}` : 'Mochila cheia');
      if (c.itens) toast('Mochila cheia — sobrou coisa na caixa');
      sfx('ok');
    } else if (a.tipo === 'barricar' || a.tipo === 'reforcar') {
      tirar('tabua'); a.alvo.hp = Math.min(180, a.alvo.hp + 60); this.atualizarTabuas(a.alvo); this.flowDirty = true; sfx('barr');
    } else if (a.tipo === 'gerador') {
      tirar('engrenagem'); tirar('fio'); a.alvo.ok = true; a.alvo.luz.material = mat('#30ff60', { emissive: '#00ff40' });
      this.hemi.intensity = 1.6; this.sun.intensity = 1.1; this.scene.remove(a.alvo.label);
      toast('⚡ Gerador ligado! Luzes acesas — ative as câmeras'); sfx('ok');
    } else if (a.tipo === 'camera') {
      a.alvo.ok = true; a.alvo.luz.material = mat('#30ff60', { emissive: '#00ff40' }); a.alvo.tela.material = mat('#3a8', { emissive: '#1a5' });
      toast('📹 Câmera ativa: zumbis próximos aparecem nas bordas da tela'); sfx('ok');
    } else if (a.tipo === 'resgatar') {
      const pr = a.alvo; pr.estado = 'seguindo'; this.scene.remove(pr.label);
      const armado = pr.sv.prof === 'militar';
      if (armado && pr.model.animado) { segurarArma(pr.model, 'fuzil'); pr.model.estados = { ...pr.model.estados, idle: 'rifle_parado', walk: 'andando_arma', run: 'andando_arma' }; pr.model.lock = 0; }
      const c = { sv: pr.sv, pos: new THREE.Vector3(pr.x, 0, pr.z), hp: armado ? 70 : 50, maxHp: armado ? 70 : 50, cd: 0, vivo: true, model: pr.model, armado, resgatado: true };
      this.comps.push(c); toast(`🆘 ${pr.sv.nome} (${pr.sv.prof}) vai com você até a evacuação`); sfx('ok');
    }
    this.atualizarHUD();
  }
  atualizarTabuas(e) { const n = Math.ceil(e.hp / 60); e.planks.forEach((p, k) => p.visible = k < n); }
  trocarArma(idx) {
    if (this.armas.length < 2 && idx === undefined) return;
    this.armaIdx = idx ?? (this.armaIdx + 1) % this.armas.length;
    this.player.recarga = 0;
    if (this.player.model.animado) segurarArma(this.player.model, this.armas[this.armaIdx].id);
    this.atualizarHUD(); sfx('barr');
  }
  curar(tipo) {
    if (!(this.mochila[tipo] > 0)) { toast(`Sem ${ITENS[tipo].nome.toLowerCase()}`); return; }
    const p = this.player; if (p.hp >= p.maxHp) { toast('Vida cheia'); return; }
    this.mochila[tipo]--; if (!this.mochila[tipo]) delete this.mochila[tipo];
    p.hp = Math.min(p.maxHp, p.hp + (tipo === 'bandagem' ? 30 : 60) * this.bonus.cura);
    sfx('ok'); this.atualizarHUD();
  }
  pausar() {
    ui.openPanel({
      title: '⏸ Pausado',
      body: `<p>${this.loc.ic} <b>${this.loc.nome}</b> · ${this.diff.nome}</p><p class="muted">${this.diff.desc}</p>
        <p class="muted">Controles: joystick na metade esquerda da tela. A mira é automática. No PC: WASD, E = ação, Q = trocar arma, 1/2 = curar.</p>`,
      foot: `<button class="sb r" data-a="sair">Abandonar (perde a mochila)</button><button class="sb" data-a="fechar">Continuar</button>`,
      on: { sair: () => { ui.closePanel(); this.terminar(false, 'Você abandonou a expedição.'); }, fechar: () => ui.closePanel() },
    });
  }
  painelTeste() {
    const matarTodos = () => { this.zombies.forEach(z => { if (!z.morto) this.dano(z, 1e9); }); this.toSpawn = 0; };
    const render = () => ui.setBody(`<p class="muted">Ferramentas do modo teste. Nada daqui existe no jogo normal.</p>
      <div class="grid">
        <div class="card" data-a="deus"><h3>${this.deus ? '🟢' : '⚪'} Invencível</h3><div class="s">Zumbis não tiram vida</div></div>
        <div class="card" data-a="mil"><h3>${S.soMilitar ? '🟢' : '⚪'} Só zumbi militar</h3><div class="s">Todos os zumbis que nascerem serão o militar</div></div>
        <div class="card" data-a="spawn"><h3>🧟 +5 militares</h3><div class="s">Nascem agora do lado de fora</div></div>
        <div class="card" data-a="matar"><h3>💥 Matar todos</h3><div class="s">Mata os zumbis vivos e encerra a horda</div></div>
        <div class="card" data-a="horda"><h3>⏩ Próxima horda</h3><div class="s">Começa a próxima horda agora</div></div>
        <div class="card" data-a="extr"><h3>🚁 Liberar evacuação</h3><div class="s">Pula direto para o ponto H</div></div>
        <div class="card" data-a="moch"><h3>🎒 Encher mochila</h3><div class="s">+5 de cada item e +120 balas</div></div>
        <div class="card" data-a="vida"><h3>❤️ Curar</h3><div class="s">Vida cheia</div></div>
      </div>`);
    ui.openPanel({ title: '🧪 Modo teste', body: '', foot: `<button class="sb" data-a="fechar">Fechar</button>`, on: {
      fechar: () => ui.closePanel(),
      deus: () => { this.deus = !this.deus; render(); },
      mil: () => { S.soMilitar = !S.soMilitar; render(); },
      spawn: () => { for (let k = 0; k < 5; k++) this.spawnZumbi('militar'); if (this.fase === 'calma') this.timer = 999; ui.closePanel(); toast('5 militares chegando (calmaria pausada)'); },
      matar: () => { matarTodos(); ui.closePanel(); },
      horda: () => { matarTodos(); if (this.horda < this.area.hordas) { this.fase = 'calma'; this.timer = 0; } ui.closePanel(); },
      extr: () => { matarTodos(); this.horda = this.area.hordas; this.fase = 'horda'; ui.closePanel(); },
      moch: () => { for (const k of ['tabua', 'bandagem', 'remedio', 'engrenagem', 'fio', 'ferramenta']) this.mochila[k] = (this.mochila[k] || 0) + 5; this.balas += 120; this.atualizarHUD(); toast('Mochila cheia de coisa'); },
      vida: () => { this.player.hp = this.player.maxHp; this.atualizarHUD(); },
    } });
    render();
  }
  verMochila() {
    const lin = Object.keys(this.mochila).map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}</b>${this.mochila[k]}</div>`).join('') || '<p class="muted">Vazia</p>';
    ui.openPanel({ title: `🎒 Mochila ${this.usoMochila()}/${capMochila()}`, body: `<div class="grid">${lin}<div class="it">📦<b>Balas</b>${this.balas}</div></div>`, foot: `<button class="sb" data-a="fechar">Fechar</button>`, on: { fechar: () => ui.closePanel() } });
  }

  // ================= HORDAS =================
  recalcFlow() {
    const p = this.player.pos, g = this.grid;
    this.flow = flowField(g, Math.floor(p.x), Math.floor(p.z), (x, y) => {
      const v = g.get(x, y);
      if (v === 1 || v === 4) return Infinity;
      if (v === 3) return this.entryAt.get(g.i(x, y)).hp > 0 ? 14 : 1;
      return 1;
    });
    this.flowDirty = false;
  }
  spawnZumbi(tipoForcado) {
    if (!this.spawnZ.length) return;
    const tipo = tipoForcado || (S.teste && S.soMilitar ? 'militar' : pick(this.area.tipos));
    const Z = ZUMBIS[tipo];
    const [x, y] = pick(this.spawnZ);
    const mods = [].concat(Z.modelo || []).filter(modeloPronto);
    const m = mods.length ? criarAnimado(pick(mods), { scale: Z.esc }) : makeChibi({ zombie: true, skin: Z.cor, shirt: pick(Z.roupa), pants: '#2a2a22', scale: Z.esc, hair: Math.random() < 0.5 ? '#2a2a1a' : null });
    const hp = Z.hp * this.area.zHp * this.diff.zHp;
    const z = { tipo, Z, pos: new THREE.Vector3(x + 0.5, 0, y + 0.5), hp, maxHp: hp, vel: Z.vel * rand(0.9, 1.1), dmg: Z.dmg * this.diff.zDmg, model: m, cd: rand(0, 1), r: 0.28 * Z.esc, hit: 0, morto: 0 };
    m.group.position.copy(z.pos); this.scene.add(m.group); this.zombies.push(z);
    if (m.animado) { m.mixer.setTime(Math.random() * 3); if (Math.random() < 0.3) { z.parado = play(m, 'gritando', { once: true }); const d = Math.hypot(z.pos.x - this.player.pos.x, z.pos.z - this.player.pos.z); if (d < 14) somZumbi('grito', 0.5 * (1 - d / 16), 1.6, 1.2); } }
    if (Math.random() < 0.15) sfx('grunhido');
  }
  iniciarHorda() {
    this.horda++; this.fase = 'horda';
    this.toSpawn = this.area.zBase + this.area.zInc * (this.horda - 1); this.spawnT = 0;
    if (this.bonus.pentePorHorda) { this.balas += this.bonus.pentePorHorda * BALAS_POR_PENTE; toast(`🏭 Fabricante entregou ${this.bonus.pentePorHorda} pente(s)`); }
    toast(`🧟 Horda ${this.horda} chegando!`); if (!somZumbi('grito', 0.7, 2.6, 0)) sfx('grunhido');
  }
  fimHorda() {
    for (const c of this.caixas) { if (!c.itens) { c.itens = this.rolarLoot(); c.mk.visible = true; c.mesh.material = mat({ posto: '#b84a3a', delegacia: '#4b5d7a', hospital: '#d9d9d9', mercado: '#c8a050', escola: '#6a8a4a', fabrica: '#7a7a6a' }[this.loc.deco] || '#8a6a4a'); } }
    if (this.horda >= this.area.hordas) {
      this.fase = 'extracao'; this.zona.visible = true; toast('🚁 Evacuação liberada! Vá até o ponto H'); sfx('ok');
    } else { this.fase = 'calma'; this.timer = 25; toast('✅ Horda superada! Os pontos de saque foram reabastecidos'); sfx('ok'); }
  }

  // ================= LOOP =================
  update(dt) {
    if (this.ended) return;
    this.t += dt;
    const inp = readInput(), p = this.player;
    if (p.morrendo > 0) { inp.active = false; inp.mag = 0; }
    // movimento do jogador
    const spd = 3.6;
    if (inp.active) { moveCircle(p.pos, inp.mx * spd * dt, inp.mz * spd * dt, 0.3, (x, y) => this.pBlocked(x, y)); p.face = Math.atan2(inp.mx, inp.mz); }
    if (this.acao && (Math.hypot(p.pos.x - this.acao.x, p.pos.z - this.acao.z) > 0.25)) { this.acao = null; toast('Ação cancelada'); }
    if (this.acao) { this.acao.t += dt; if (this.acao.t >= this.acao.dur) { const a = this.acao; this.acao = null; this.concluirAcao(a); } }
    p.inv = Math.max(0, p.inv - dt);
    // fases
    if (this.fase === 'calma') { this.timer -= dt; if (this.timer <= 0) this.iniciarHorda(); }
    else if (this.fase === 'horda') {
      this.spawnT -= dt;
      if (this.toSpawn > 0 && this.spawnT <= 0 && this.zombies.length < 45) { this.spawnZumbi(); this.toSpawn--; this.spawnT = 0.75; }
      if (this.toSpawn <= 0 && this.zombies.length === 0) this.fimHorda();
    } else if (this.fase === 'extracao' || this.fase === 'extraindo') {
      this.dentroZona = Math.hypot(p.pos.x - this.extr.x, p.pos.z - this.extr.z) < 1.7;
      if (this.fase === 'extracao' && this.dentroZona) { this.fase = 'extraindo'; toast('Segure a posição! Horda final!'); sfx('grunhido'); }
      if (this.fase === 'extraindo') {
        if (this.dentroZona) this.xprog += dt / 35;
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.zombies.length < 55) {
          const bruto = this.cfg.area >= 1 && Math.random() < 0.12;
          this.spawnZumbi(bruto ? 'brutamonte' : null); this.spawnT = 0.5;
        }
        if (this.xprog >= 1) { this.terminar(true); return; }
      }
      this.zona.rotation.y += dt;
    }
    // campo de fluxo
    this.flowT -= dt;
    const pc = Math.floor(p.pos.x) + Math.floor(p.pos.z) * 1000;
    if (this.flowT <= 0 || this.flowDirty || pc !== this.lastPc) { if (this.flowT <= 0 || this.flowDirty) { this.recalcFlow(); this.flowT = 0.35; this.lastPc = pc; } }
    this.updCombate(dt);
    this.updZumbis(dt);
    this.updComps(dt);
    this.updProj(dt);
    this.updFx(dt);
    // visual do jogador
    p.model.group.position.copy(p.pos);
    p.model.group.rotation.y = p.face;
    this.animJogador(dt, inp);
    p.model.group.visible = p.morrendo > 0 || !(p.inv > 0 && Math.floor(this.t * 10) % 2);
    if (p.morrendo > 0) { p.morrendo -= dt; if (p.morrendo <= 0) this.depoisDaMorte(); }
    this.updDrops(dt);
    this.updChamas(dt);
    this.updSons(dt);
    this.lanterna.position.set(p.pos.x, 2.2, p.pos.z);
    camFollow(p.pos.x, p.pos.z, dt);
    for (const c of this.caixas) if (c.itens) { c.mk.position.y = 1.05 + Math.sin(this.t * 3 + c.x) * 0.08; c.mk.rotation.y += dt * 2; }
    if (this.preso && this.preso.estado === 'preso') { if (this.preso.model.animado) animar(this.preso.model, dt, 0); else animChibi(this.preso.model, dt * 0.3, 0); }
    this.updAcaoBtn();
    this.updIndicadores();
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.atualizarHUD(); this.hudT = 0.2; }
  }
  updAcaoBtn() {
    const a = this.acao || this.alvoProximo(); const err = this.acao ? null : this.podeFazer(a);
    const label = a ? (ACAO_NOMES[a.tipo] + (err ? `<br><small style="font-size:9px">${err}</small>` : '')) : '—';
    if (label !== this._lbl) { this.el.acaoT.innerHTML = label; this._lbl = label; }
    this.el.acao.classList.toggle('off', !a || !!err);
    const pr = this.acao ? this.acao.t / this.acao.dur : 0;
    this.el.acaoP.style.background = pr > 0 ? `conic-gradient(#b6e36b ${pr * 360}deg, transparent 0)` : 'none';
    this.el.acaoP.style.webkitMask = this.el.acaoP.style.mask = 'radial-gradient(circle, transparent 60%, #000 61%)';
  }
  alvoTiro(x, z, alc) {
    let best = null, bd = alc;
    for (const zb of this.zombies) {
      if (zb.morto) continue;
      const d = Math.hypot(zb.pos.x - x, zb.pos.z - z);
      if (d < bd && this.grid.los(x, z, zb.pos.x, zb.pos.z)) { bd = d; best = zb; }
    }
    return best;
  }
  animJogador(dt, inp) {
    const p = this.player, m = p.model;
    if (!m.animado) { animChibi(m, dt, inp.active ? 1 : 0); return; }
    const a = this.armas[this.armaIdx];
    const A = ANIM_ARMA[(ARMA_3D[a.id] || {}).anim || 'pistola'];
    let clip, speed = 1;
    m.esconderArma = false;
    if (this.acao) {
      clip = { saquear: 'vasculhando_bau', barricar: 'vasculhando', reforcar: 'vasculhando', gerador: 'vasculhando', camera: 'pegando', resgatar: 'recrutando' }[this.acao.tipo];
      m.esconderArma = true;
    } else if (p.recarga > 0) { clip = 'recarregando'; speed = 3.3 / TEMPO_RECARGA; }
    else if (inp.active) {
      // andando de costas enquanto mira (só a pistola tem essa animação)
      const frente = Math.sin(p.face) * inp.mx + Math.cos(p.face) * inp.mz;
      const costas = p.mirando && frente < -0.3 * inp.mag && A.walkBack;
      const tiro = p.mirando;
      clip = inp.mag < 0.62 ? (costas ? (tiro && A.walkBackTiro) || A.walkBack : (tiro && A.walkTiro) || A.walk)
                            : (costas ? (tiro && A.walkBackTiro) || A.runBack : (tiro && A.runTiro) || A.run);
      if (inp.mag < 0.62) speed = Math.max(0.6, inp.mag * 1.6);
    } else clip = p.mirando ? A.tiro : A.idle;
    animar(m, dt, 0, { clip, clipSpeed: speed });
  }
  updCombate(dt) {
    const p = this.player; p.cd -= dt; p.faca -= dt;
    p.model.aim = false; p.mirando = false;
    if (this.acao || p.morrendo > 0) return;
    // faca quando o zumbi está colado
    let perto = null, pd = this.faca.alc;
    for (const z of this.zombies) { if (z.morto) continue; const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z); if (d < pd) { pd = d; perto = z; } }
    if (perto) {
      p.face = Math.atan2(perto.pos.x - p.pos.x, perto.pos.z - p.pos.z); p.model.aim = true; p.mirando = true;
      if (p.faca <= 0) { this.dano(perto, this.faca.dmg); p.faca = this.faca.cad; sfx('faca'); this.particula(perto.pos, '#cfe0ff'); }
      return;
    }
    let a = this.armas[this.armaIdx];
    const pistola = () => { const pi = this.armas.findIndex(w => w.infinita); if (pi >= 0 && pi !== this.armaIdx) { this.trocarArma(pi); return true; } return false; };
    // recarga em andamento
    if (p.recarga > 0) { p.recarga -= dt; if (p.recarga <= 0) this.concluirRecarga(a); return; }
    if (a.chamas) {
      if (p.chamaT <= 0 && !(this.mochila.combustivel > 0)) { if (pistola()) toast('Sem combustível — trocou para a pistola'); return; }
    } else if (a.mag <= 0) {
      if (a.infinita || this.balas > 0) { this.iniciarRecarga(); return; }
      if (pistola()) toast('Sem balas — trocou para a pistola');
      return;
    }
    const alvo = this.alvoTiro(p.pos.x, p.pos.z, a.alc);
    if (!alvo) {
      // sem zumbi por perto: completa o pente
      if (!a.chamas && a.mag < a.pente && (a.infinita || this.balas > 0) && !this.zombies.some(z => !z.morto && Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < 5)) this.iniciarRecarga();
      return;
    }
    p.face = Math.atan2(alvo.pos.x - p.pos.x, alvo.pos.z - p.pos.z); p.model.aim = true; p.mirando = true;
    if (p.cd > 0) return;
    p.cd = a.cad;
    if (a.chamas) { this.lancarChamas(a); return; }
    a.mag--;
    const disp = a.disp * (1 - this.bonus.disp);
    for (let k = 0; k < a.proj; k++) this.atirar(p.pos, p.face + rand(-disp, disp), a.dmg, a.alc);
    sfx(a.proj > 1 ? 'escopeta' : 'tiro');
  }
  iniciarRecarga() { this.player.recarga = TEMPO_RECARGA; sfx('barr'); this.atualizarHUD(); }
  concluirRecarga(a) {
    const falta = a.pente - a.mag;
    if (a.infinita) a.mag = a.pente;
    else { const n = Math.min(falta, this.balas); this.balas -= n; a.mag += n; }
    this.player.recarga = 0; this.atualizarHUD();
  }
  // lança-chamas: dano em cone, gasta combustível da mochila
  lancarChamas(a) {
    const p = this.player;
    if (p.chamaT <= 0) {
      this.mochila.combustivel--; if (!this.mochila.combustivel) delete this.mochila.combustivel;
      p.chamaT = SEG_POR_COMBUSTIVEL; this.atualizarHUD();
    }
    p.chamaT -= a.cad;
    for (const z of this.zombies) {
      if (z.morto) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > a.alc) continue;
      let da = Math.atan2(dx, dz) - p.face; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < a.disp && this.grid.los(p.pos.x, p.pos.z, z.pos.x, z.pos.z)) this.dano(z, a.dmg, true);
    }
    if (!this.chamaGeo) { this.chamaGeo = new THREE.SphereGeometry(0.16, 7, 5); this.chamas = []; }
    for (let k = 0; k < 2; k++) {
      const ang = p.face + rand(-a.disp * 0.7, a.disp * 0.7), v = rand(5, 7);
      const m = new THREE.Mesh(this.chamaGeo, new THREE.MeshBasicMaterial({ color: pick(['#ffb030', '#ff7a1a', '#ffd84a']), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(p.pos.x + Math.sin(p.face) * 0.65, 0.72, p.pos.z + Math.cos(p.face) * 0.65);
      this.scene.add(m); this.chamas.push({ m, vx: Math.sin(ang) * v, vz: Math.cos(ang) * v, t: 0, vida: a.alc / v });
    }
    if (Math.random() < 0.3) sfx('escopeta');
  }
  updChamas(dt) {
    if (!this.chamas) return;
    for (let i = this.chamas.length - 1; i >= 0; i--) {
      const c = this.chamas[i]; c.t += dt;
      c.m.position.x += c.vx * dt; c.m.position.z += c.vz * dt; c.m.position.y += dt * 0.6;
      const f = c.t / c.vida; c.m.scale.setScalar(1 + f * 2.5); c.m.material.opacity = Math.max(0, 0.9 * (1 - f));
      if (f >= 1) { this.scene.remove(c.m); c.m.material.dispose(); this.chamas.splice(i, 1); }
    }
  }
  // munição que cai dos zumbis (modelos 3D de bala)
  soltarMunicao(pos) {
    if (!this.drops) this.drops = [];
    if (this.drops.length >= 15) return;
    const a = this.armas[this.armaIdx];
    const tipo = (ARMA_3D[a.id] || {}).bala || 'bala_rifle';
    let m = criarObjeto(tipo);
    if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.3), mat('#c9a227')); }
    const g = new THREE.Group(); g.add(m); m.rotation.x = Math.PI / 2; m.position.z = 0;
    g.position.set(pos.x, 0.3, pos.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.6 }));
    ring.position.y = -0.27; g.add(ring);
    this.scene.add(g); this.drops.push({ g, t: 30 });
  }
  updDrops(dt) {
    if (!this.drops) return;
    const p = this.player.pos;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t -= dt;
      d.g.rotation.y += dt * 2.5; d.g.position.y = 0.3 + Math.sin(this.t * 4 + i) * 0.06;
      const perto = Math.hypot(d.g.position.x - p.x, d.g.position.z - p.z) < 0.9;
      if (perto) { this.balas += BALAS_POR_PENTE; toast(`📦 +${BALAS_POR_PENTE} balas`); sfx('ok'); this.atualizarHUD(); }
      if (perto || d.t <= 0) { this.scene.remove(d.g); this.drops.splice(i, 1); }
    }
  }
  updSons(dt) {
    this.somT = (this.somT ?? 2) - dt;
    if (this.somT > 0) return;
    this.somT = rand(1.4, 3.2);
    const p = this.player.pos;
    const vivos = this.zombies.filter(z => !z.morto && Math.hypot(z.pos.x - p.x, z.pos.z - p.z) < 13);
    if (!vivos.length) return;
    const z = pick(vivos), d = Math.hypot(z.pos.x - p.x, z.pos.z - p.z);
    if (!somZumbi('som', 0.75 * (1 - d / 15), rand(1.2, 2.2), 0.8)) sfx('grunhido');
  }
  atirar(from, ang, dmg, alc) {
    const m = new THREE.Mesh(this.projGeo, this.projMat);
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    m.position.set(from.x + dir.x * 0.5, 0.75, from.z + dir.z * 0.5); m.rotation.y = ang;
    this.scene.add(m);
    this.projs.push({ m, dir, dmg, life: alc / 24 });
    this.flash.position.set(from.x + dir.x * 0.55, 0.75, from.z + dir.z * 0.55); this.flash.visible = true; this.flashT = 0.05;
  }
  updProj(dt) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i]; let dead = false;
      const steps = 3;
      for (let s = 0; s < steps && !dead; s++) {
        pr.m.position.x += pr.dir.x * 24 * dt / steps; pr.m.position.z += pr.dir.z * 24 * dt / steps;
        if (this.grid.get(Math.floor(pr.m.position.x), Math.floor(pr.m.position.z)) === 1) { dead = true; break; }
        for (const z of this.zombies) {
          if (z.morto) continue;
          if (Math.hypot(z.pos.x - pr.m.position.x, z.pos.z - pr.m.position.z) < z.r + 0.18) { this.dano(z, pr.dmg); dead = true; break; }
        }
      }
      pr.life -= dt;
      if (dead || pr.life <= 0) { this.scene.remove(pr.m); this.projs.splice(i, 1); }
    }
  }
  dano(z, d, chama) {
    z.hp -= d; z.hit = 0.12; if (!chama) sfx('hit');
    if (z.hp <= 0 && !z.morto) {
      z.morto = 0.5; this.particula(z.pos, '#4f7a2f', true);
      if (!somZumbi('morte', 0.55, rand(0.9, 1.4), 0.25)) sfx('grunhido');
      if (Math.random() < 0.18) this.soltarMunicao(z.pos);
      if (z.model.animado) { z.model.lock = 0; play(z.model, z.rastejando ? 'morrendo_1' : z.model.estados.morte, { once: true, travar: true, speed: 1.3, fade: 0.1 }); z.morto = 3.2; }
    } else if (z.hp > 0 && z.model.animado && z.tipo === 'militar' && !z.rastejando && z.hp < z.maxHp * 0.35 && Math.random() < 0.5) {
      // militar ferido cai e continua rastejando
      z.rastejando = true; z.vel *= 0.5; z.parado = 0; z.model.lock = 0; z.model.atkClip = null;
      Object.assign(z.model.estados, { idle: 'rastejando', walk: 'rastejando', run: 'rastejando', atk: 'mordendo_chao' });
      play(z.model, 'rastejando', { fade: 0.3 });
    }
  }
  particula(pos, cor, chao) {
    if (chao) {
      const m = new THREE.Mesh(this.sangueGeo, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7, depthWrite: false }));
      m.position.set(pos.x + rand(-0.2, 0.2), 0.015, pos.z + rand(-0.2, 0.2)); m.scale.setScalar(rand(0.8, 1.6));
      this.scene.add(m); this.fx.push({ m, t: 6, fade: true });
      if (this.fx.length > 60) { const f = this.fx.shift(); this.scene.remove(f.m); f.m.material.dispose(); }
    }
  }
  updFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t -= dt;
      if (f.t < 1) f.m.material.opacity = Math.max(0, f.t * 0.7);
      if (f.t <= 0) { this.scene.remove(f.m); f.m.material.dispose(); this.fx.splice(i, 1); }
    }
  }
  updZumbis(dt) {
    const p = this.player, g = this.grid;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.morto) {
        z.morto -= dt;
        if (z.model.animado) { z.model.mixer.update(dt); if (z.morto < 0.6) z.model.group.position.y = -(0.6 - z.morto) * 0.6; }
        else { z.model.inner.rotation.x = -(1 - z.morto / 0.5) * 1.5; z.model.group.position.y = -(1 - z.morto / 0.5) * 0.2; }
        if (z.morto <= 0) { this.scene.remove(z.model.group); this.zombies.splice(i, 1); }
        continue;
      }
      z.cd -= dt; z.hit = Math.max(0, z.hit - dt);
      // alvo: jogador ou companheiro mais próximo
      let alvo = p, ad = Math.hypot(p.pos.x - z.pos.x, p.pos.z - z.pos.z);
      for (const c of this.comps) { if (!c.vivo) continue; const d = Math.hypot(c.pos.x - z.pos.x, c.pos.z - z.pos.z); if (d < ad && d < 1.2) { ad = d; alvo = c; } }
      let vx = 0, vz = 0, movendo = true;
      if (z.parado > 0) { z.parado -= dt; movendo = false; }
      else if (ad < 0.75 + z.r) {
        movendo = false;
        z.face = Math.atan2(alvo.pos.x - z.pos.x, alvo.pos.z - z.pos.z);
        if (z.cd <= 0) { z.cd = 1.0; this.ferir(alvo, z.dmg); }
      } else {
        const cx = Math.floor(z.pos.x), cz = Math.floor(z.pos.z);
        let tx = null, tz = null, entrada = null;
        const dentro = g.get(cx, cz) === 0;
        if (dentro && alvo === p && ad < 4 && g.los(z.pos.x, z.pos.z, p.pos.x, p.pos.z)) { tx = p.pos.x; tz = p.pos.z; }
        else if (this.flow) {
          let bv = this.flow[g.i(cx, cz)], bx = null, by = null;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = cx + ox, ny = cz + oy; if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
            if (ox && oy) { const a1 = g.get(cx + ox, cz), a2 = g.get(cx, cz + oy); if (a1 === 1 || a1 === 4 || a2 === 1 || a2 === 4 || a1 === 3 || a2 === 3) continue; }
            const v = this.flow[g.i(nx, ny)];
            if (v < bv) { bv = v; bx = nx; by = ny; }
          }
          if (bx !== null) {
            tx = bx + 0.5; tz = by + 0.5;
            if (g.get(bx, by) === 3) { const e = this.entryAt.get(g.i(bx, by)); if (e.hp > 0) entrada = e; }
          } else { tx = p.pos.x; tz = p.pos.z; }
        }
        z.naBarricada = false;
        if (entrada && Math.hypot(tx - z.pos.x, tz - z.pos.z) < 1.0 + z.r) {
          movendo = false; z.naBarricada = true; z.face = Math.atan2(tx - z.pos.x, tz - z.pos.z);
          if (z.cd <= 0) {
            z.cd = 1.0; entrada.hp -= z.Z.dmgBarr * (this.cfg.diff === 'dificil' ? 1.3 : 1); sfx('barr');
            if (entrada.hp <= 0) { entrada.hp = 0; this.flowDirty = true; toast('🪵 Uma barricada caiu!'); }
            this.atualizarTabuas(entrada);
          }
        } else if (tx !== null) {
          const dx = tx - z.pos.x, dz = tz - z.pos.z, d = Math.hypot(dx, dz) || 1;
          vx = dx / d * z.vel; vz = dz / d * z.vel; z.face = Math.atan2(dx, dz);
        }
      }
      // separação entre zumbis
      for (let j = 0; j < this.zombies.length; j++) {
        if (j === i) continue; const o = this.zombies[j]; if (o.morto) continue;
        const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z, d2 = dx * dx + dz * dz, mn = z.r + o.r;
        if (d2 < mn * mn && d2 > 1e-4) { const d = Math.sqrt(d2), f = (mn - d) / d * 2.5; vx += dx * f; vz += dz * f; }
      }
      moveCircle(z.pos, vx * dt, vz * dt, z.r, (x, y) => this.zBlocked(x, y));
      z.model.group.position.copy(z.pos);
      if (z.face !== undefined) z.model.group.rotation.y = z.face;
      if (z.model.animado) {
        const e = z.model.estados;
        animar(z.model, dt, movendo ? 0.5 : 0, { atacando: !movendo && !(z.parado > 0), walkSpeed: z.vel / (z.rastejando ? 0.6 : 1.1), idleSpeed: 0.4,
          runAt: z.Z.corre ? 0.3 : 0.62, clip: (!movendo && z.naBarricada && e.barricada && !(z.parado > 0)) ? e.barricada : null, clipSpeed: 1.2 });
        z.model.inner.scale.setScalar(z.hit > 0 ? 1.08 : 1);
      } else {
        animChibi(z.model, dt, movendo ? z.vel / 2 : 0.2);
        z.model.inner.scale.setScalar(z.Z.esc * (z.hit > 0 ? 1.12 : 1));
      }
    }
  }
  ferir(alvo, dmg) {
    if (alvo === this.player) {
      const p = this.player; if (p.inv > 0 || this.deus) return;
      p.hp -= dmg; sfx('dano');
      const h = document.getElementById('hurt'); h.style.opacity = 0.7; clearTimeout(this._hurtT); this._hurtT = setTimeout(() => h.style.opacity = 0, 180);
      if (this.acao) { this.acao = null; }
      if (p.hp <= 0) this.morrer();
      this.atualizarHUD();
    } else {
      alvo.hp -= dmg;
      if (alvo.hp <= 0 && alvo.vivo) {
        alvo.vivo = false; alvo.morteT = 1.5; sfx('morte');
        toast(`💀 ${alvo.sv.nome} morreu${alvo.resgatado ? '' : ' — perdido para sempre'}`);
      }
    }
  }
  morrer() {
    const p = this.player; if (p.morrendo > 0) return;
    p.mortes++; sfx('morte');
    this.acao = null; p.recarga = 0;
    p.fim = p.mortes > this.diff.mortes;
    if (p.model.animado) {
      // animação de morte e só depois volta (ou encerra)
      p.model.lock = 0; play(p.model, 'morrendo', { once: true, travar: true, fade: 0.1 });
      p.morrendo = 2.4; p.inv = 99;
    } else this.depoisDaMorte();
  }
  depoisDaMorte() {
    const p = this.player; p.morrendo = 0;
    if (p.model.animado) { p.model.lock = 0; p.model.travar = false; }
    if (p.fim) { this.terminar(false, this.diff.mortes === 0 ? 'Modo Hardcore: uma morte encerra a missão.' : 'Você morreu mais vezes do que o permitido.'); return; }
    // penalidade
    let perdidos = 0;
    if (this.diff.perdaMorte > 0) {
      const lista = []; for (const k in this.mochila) for (let n = 0; n < this.mochila[k]; n++) lista.push(k);
      const nP = Math.floor(lista.length * this.diff.perdaMorte);
      lista.sort(() => Math.random() - 0.5).slice(0, nP).forEach(k => { this.mochila[k]--; if (!this.mochila[k]) delete this.mochila[k]; perdidos++; });
      const bl = Math.floor(this.balas * this.diff.perdaMorte); this.balas -= bl;
    }
    p.hp = p.maxHp; p.inv = 3; p.pos.set(this.spawn.x, 0, this.spawn.z);
    camFollow(p.pos.x, p.pos.z, 0, true);
    const rest = this.diff.mortes - p.mortes;
    toast(`💀 Você caiu! ${rest > 0 ? rest + ' vida(s) extra(s) restante(s)' : 'Última chance!'}${perdidos ? ` · perdeu ${perdidos} itens` : ''}`);
  }
  updComps(dt) {
    const p = this.player;
    this.comps.forEach((c, idx) => {
      if (!c.vivo) {
        if (c.morteT > 0) {
          c.morteT -= dt;
          if (c.model.animado) { if (!c.animMorte) { c.animMorte = 1; c.model.lock = 0; play(c.model, 'morrendo', { once: true, travar: true }); c.morteT = 4; } animar(c.model, dt, 0); }
          else c.model.inner.rotation.x = -Math.min(1.5, (1.5 - c.morteT) * 2);
          if (c.morteT <= 0) this.scene.remove(c.model.group);
        }
        return;
      }
      const ang = p.face + Math.PI + (idx - (this.comps.length - 1) / 2) * 0.9;
      const tx = p.pos.x + Math.sin(ang) * 1.3, tz = p.pos.z + Math.cos(ang) * 1.3;
      const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
      let mov = 0;
      if (d > 8) { c.pos.set(p.pos.x, 0, p.pos.z); }
      else if (d > 0.4) { const v = Math.min(4, d * 2.5); moveCircle(c.pos, dx / d * v * dt, dz / d * v * dt, 0.28, (x, y) => this.pBlocked(x, y)); mov = v / 3.6; c.face = Math.atan2(dx, dz); }
      c.model.aim = false;
      if (c.armado) {
        c.cd -= dt;
        const alvo = this.alvoTiro(c.pos.x, c.pos.z, 7);
        if (alvo) {
          c.face = Math.atan2(alvo.pos.x - c.pos.x, alvo.pos.z - c.pos.z); c.model.aim = true;
          if (c.cd <= 0) { c.cd = 0.65; this.atirar(c.pos, c.face + rand(-0.12, 0.12) * (c.sv.prof === 'militar' ? 0.4 : 1), c.sv.prof === 'militar' ? 13 : 9, 7); sfx('tiro'); }
        }
      }
      c.model.group.position.copy(c.pos); c.model.group.rotation.y = c.face || 0;
      if (c.model.animado) animar(c.model, dt, mov, { clip: c.model.aim && mov < 0.15 && c.armado ? 'atirando' : null, walkSpeed: 1 });
      else animChibi(c.model, dt, mov);
    });
  }
  updIndicadores() {
    const cams = this.cameras.filter(c => c.ok);
    let k = 0;
    if (cams.length) {
      const W = window.innerWidth, H = window.innerHeight, cxs = W / 2, cys = H / 2;
      for (const z of this.zombies) {
        if (k >= this.inds.length) break; if (z.morto) continue;
        if (!cams.some(c => Math.hypot(c.x + 0.5 - z.pos.x, c.y + 0.5 - z.pos.z) < 11)) continue;
        const s = toScreen(z.pos); if (s.on) continue;
        const dx = s.x - cxs, dy = s.y - cys; const sc = Math.min((cxs - 26) / Math.abs(dx || 1e-3), (cys - 26) / Math.abs(dy || 1e-3));
        const el = this.inds[k++]; el.style.display = 'block';
        el.style.left = (cxs + dx * sc - 9) + 'px'; el.style.top = (cys + dy * sc - 8) + 'px';
        el.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      }
    }
    for (; k < this.inds.length; k++) this.inds[k].style.display = 'none';
  }
  terminar(ok, motivo) {
    if (this.ended) return; this.ended = true; this.acao = null;
    const vivos = this.comps.filter(c => c.vivo);
    const mortos = this.comps.filter(c => !c.vivo && !c.resgatado).map(c => c.sv.id);
    const resgatados = ok ? vivos.filter(c => c.resgatado).map(c => c.sv) : [];
    for (const a of this.armas) if (!a.infinita && a.mag > 0) { this.balas += a.mag; a.mag = 0; }
    const dinheiro = ok ? Math.round(this.area.$ * this.diff.$) : 0;
    this.onEnd({ ok, motivo, mochila: ok ? this.mochila : {}, balas: ok ? this.balas : 0, mortos, resgatados, dinheiro, levados: this.levados, local: this.loc, cfg: this.cfg });
  }
  dispose() {
    window.removeEventListener('keydown', this.keyH);
    this.inds.forEach(e => e.style.display = 'none');
  }
}
