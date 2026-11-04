import { THREE, makeChibi, animChibi, Grid, moveCircle, rand, pick, toast, sfx, mat, makeLabel, camFollow, readInput, VIEW, resize, camera, toScreen } from './engine.js';
import { ITENS, ARMAS, FABRICAR, FAB_MUNICAO, custoTier, ESTRUTURAS, CUSTO_ESTRUTURA, PROFISSOES, DIFICULDADES, AREAS, CONSUMIVEIS, LOJA, LIBERAR_AREA, MOCHILA_MAX, custoMochila, statsArma, BALAS_POR_PENTE } from './data.js';
import { S, salvar, capMochila, capEstoque, usoEstoque, temCusto, pagar, custoTxt, bonusAtivo, trabalhadores, bonusExpedicao, tickProducao, coletar, taxas, capPend, resetar } from './state.js';
import * as ui from './ui.js';
import { modeloPronto, criarAnimado, animar, criarSobrevivente } from './models.js';

// ================= PLANTA DO BUNKER =================
// cada sala é um ambiente separado (interior em células, inclusive); portas ligam as salas ao salão central
const W = 32, H = 23, ALT_PAREDE = 2.0;
const SALAS = {
  salao:      { x0: 11, z0: 6,  x1: 21, z1: 15, piso: 'concreto' },
  mercado:    { x0: 11, z0: 1,  x1: 21, z1: 4,  piso: 'madeira' },
  oficina:    { x0: 1,  z0: 1,  x1: 9,  z1: 7,  piso: 'metal' },
  enfermaria: { x0: 1,  z0: 9,  x1: 9,  z1: 15, piso: 'azulejo' },
  estufa:     { x0: 1,  z0: 17, x1: 9,  z1: 21, piso: 'terra' },
  estoque:    { x0: 23, z0: 1,  x1: 30, z1: 7,  piso: 'concreto2' },
  alojamento: { x0: 23, z0: 9,  x1: 30, z1: 15, piso: 'carpete' },
  gerador:    { x0: 23, z0: 17, x1: 30, z1: 21, piso: 'metal' },
  entrada:    { x0: 11, z0: 17, x1: 21, z1: 21, piso: 'faixas' },
};
const PORTAS = [[15, 5], [16, 5], [17, 5], [10, 6], [10, 7], [10, 11], [10, 12], [22, 6], [22, 7], [22, 11], [22, 12], [15, 16], [16, 16], [17, 16], [10, 19], [10, 20], [22, 19], [22, 20]];
// pontos de interação (o botão aparece quando o jogador está dentro da sala; a mesa só quando está perto dela)
const EST = [
  { id: 'mesa', x: 16, z: 10.5, nome: 'Mesa de Guerra', ic: '🗺️', sala: 'salao', raio: 2.6 },
  { id: 'mercado', x: 16, z: 2.6, nome: 'Mercado', ic: '💰', sala: 'mercado' },
  { id: 'oficina', x: 5, z: 4, nome: 'Oficina de Armas', ic: '🛠️', pad: true, sala: 'oficina' },
  { id: 'enfermaria', x: 5, z: 12, nome: 'Enfermaria', ic: '🏥', pad: true, sala: 'enfermaria' },
  { id: 'estufa', x: 5, z: 19, nome: 'Estufa', ic: '🌱', pad: true, sala: 'estufa' },
  { id: 'estoque', x: 26.5, z: 4, nome: 'Estoque', ic: '🗄️', pad: true, sala: 'estoque' },
  { id: 'alojamento', x: 26.5, z: 12, nome: 'Alojamento', ic: '🛏️', pad: true, sala: 'alojamento' },
];
const nomeProf = p => PROFISSOES[p].ic + ' ' + PROFISSOES[p].nome;
const dentro = (s, x, z) => x >= s.x0 && x < s.x1 + 1 && z >= s.z0 && z < s.z1 + 1;
const salaDe = (x, z) => Object.keys(SALAS).find(k => dentro(SALAS[k], x, z)) || null;

// ================= MAPA DA MESA DE GUERRA =================
// coordenadas no papel (0..1); cada área tem a sua zona e cada local um alfinete
const MAPA = {
  zonas: [
    { cor: '#6f9a4a', borda: '#3e5f25', poly: [[0.04, 0.12], [0.36, 0.06], [0.40, 0.50], [0.34, 0.92], [0.06, 0.88]], rot: [0.2, 0.47] },
    { cor: '#d4b24a', borda: '#8a6d1e', poly: [[0.36, 0.06], [0.68, 0.10], [0.70, 0.56], [0.62, 0.94], [0.34, 0.92], [0.40, 0.50]], rot: [0.53, 0.5] },
    { cor: '#c9563f', borda: '#7a2418', poly: [[0.68, 0.10], [0.96, 0.08], [0.95, 0.92], [0.62, 0.94], [0.70, 0.56]], rot: [0.82, 0.5] },
  ],
  pinos: [
    [[0.14, 0.26], [0.27, 0.34], [0.12, 0.66], [0.25, 0.76]],
    [[0.46, 0.24], [0.6, 0.3], [0.48, 0.7], [0.58, 0.8]],
    [[0.76, 0.24], [0.88, 0.32], [0.78, 0.72], [0.88, 0.8]],
  ],
  corPino: ['#2f7de0', '#e8d23a', '#e0402f'],
};
const MESA = { x: 16, z: 10.5, larg: 3.2, prof: 2.1, alt: 0.82 };

export class Base {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d0f0d');
    VIEW.size = 6.5; resize();
    this.grid = new Grid(W, H, 1);
    for (const k in SALAS) { const s = SALAS[k]; for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) this.grid.set(x, z, 0); }
    for (const [x, z] of PORTAS) this.grid.set(x, z, 0);
    this.sel = { area: 0, loc: 0, diff: 'facil' };
    this.montarCena();
    this.player = { pos: new THREE.Vector3(16, 0, 19.5), face: Math.PI };
    this.pm = modeloPronto('protagonista') ? criarAnimado('protagonista') : makeChibi({ shirt: '#2f5d8a', pants: '#2b2b33', skin: '#d9a77c', cap: '#3d5f22' });
    this.scene.add(this.pm.group);
    this.svs = [];
    tickProducao();
    this.refazTudo();
    this.montarHUD();
    camFollow(this.player.pos.x, this.player.pos.z, 0, true);
  }
  // ---------- texturas desenhadas no código (sem arquivos) ----------
  texPiso() {
    const P = 32, cv = document.createElement('canvas'); cv.width = W * P; cv.height = H * P;
    const c = cv.getContext('2d'); c.fillStyle = '#1a1c1a'; c.fillRect(0, 0, cv.width, cv.height);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const ladrilho = (x, z, tipo) => {
      const X = x * P, Z = z * P;
      if (tipo === 'concreto' || tipo === 'concreto2' || tipo === 'faixas') {
        c.fillStyle = tipo === 'concreto2' ? '#5a5d5c' : '#64635d'; c.fillRect(X, Z, P, P);
        c.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 6; i++) c.fillRect(X + rnd(0, P), Z + rnd(0, P), 2, 2);
        c.strokeStyle = 'rgba(0,0,0,0.18)'; c.strokeRect(X + 0.5, Z + 0.5, P - 1, P - 1);
      } else if (tipo === 'madeira') {
        c.fillStyle = (x + Math.floor(z / 2)) % 2 ? '#7a5434' : '#6e4a2c'; c.fillRect(X, Z, P, P);
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.moveTo(X, Z + P / 2); c.lineTo(X + P, Z + P / 2); c.stroke();
      } else if (tipo === 'metal') {
        c.fillStyle = '#4c5256'; c.fillRect(X, Z, P, P); c.strokeStyle = '#2e3235'; c.lineWidth = 2; c.strokeRect(X + 1, Z + 1, P - 2, P - 2); c.lineWidth = 1;
        c.fillStyle = '#6a7276'; for (const [a, b] of [[4, 4], [P - 6, 4], [4, P - 6], [P - 6, P - 6]]) c.fillRect(X + a, Z + b, 2, 2);
        c.strokeStyle = 'rgba(255,255,255,0.06)'; for (let i = 6; i < P; i += 8) { c.beginPath(); c.moveTo(X + i, Z + 6); c.lineTo(X + i - 4, Z + P - 6); c.stroke(); }
      } else if (tipo === 'azulejo') {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#c9d2d0' : '#b9c4c2'; c.fillRect(X + i * P / 2, Z + j * P / 2, P / 2, P / 2); }
        c.strokeStyle = 'rgba(0,0,0,0.15)'; c.strokeRect(X + 0.5, Z + 0.5, P - 1, P - 1);
      } else if (tipo === 'terra') {
        c.fillStyle = '#5c4430'; c.fillRect(X, Z, P, P); for (let i = 0; i < 10; i++) { c.fillStyle = Math.random() < 0.5 ? '#4b3725' : '#6a5038'; c.fillRect(X + rnd(0, P), Z + rnd(0, P), 3, 3); }
      } else if (tipo === 'carpete') {
        c.fillStyle = '#5b3f3a'; c.fillRect(X, Z, P, P); c.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < P; i += 4) c.fillRect(X, Z + i, P, 1);
      }
    };
    for (const k in SALAS) { const s = SALAS[k]; for (let z = s.z0; z <= s.z1; z++) for (let x = s.x0; x <= s.x1; x++) ladrilho(x, z, s.piso); }
    for (const [x, z] of PORTAS) { ladrilho(x, z, 'metal'); }
    // faixas de perigo na entrada e em volta da porta-cofre
    const faixa = (x0, z0, w, h) => { c.save(); c.beginPath(); c.rect(x0 * P, z0 * P, w * P, h * P); c.clip(); for (let i = -h * P; i < w * P + h * P; i += 16) { c.fillStyle = (i / 16) % 2 ? '#d8b42a' : '#222'; c.beginPath(); c.moveTo(x0 * P + i, z0 * P); c.lineTo(x0 * P + i + 8, z0 * P); c.lineTo(x0 * P + i + 8 - h * P, z0 * P + h * P); c.lineTo(x0 * P + i - h * P, z0 * P + h * P); c.fill(); } c.restore(); };
    faixa(11, 21.5, 11, 0.5); faixa(14, 16, 5, 0.25); faixa(14, 16.75, 5, 0.25);
    // manchas de sujeira nas salas ainda velhas (refeitas a cada mudança)
    for (const k of ['oficina', 'enfermaria', 'estufa', 'estoque', 'alojamento']) if (!S.estruturas[k]) {
      const s = SALAS[k];
      for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${pick(['30,22,12', '20,20,16', '60,30,20'])},${rnd(0.15, 0.35)})`; c.beginPath(); c.ellipse(rnd(s.x0, s.x1 + 1) * P, rnd(s.z0, s.z1 + 1) * P, rnd(6, 26), rnd(5, 18), rnd(0, 3), 0, 6.3); c.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }
  texMapa() {
    const cw = 1024, ch = 672, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    // papel envelhecido
    const gr = c.createRadialGradient(cw / 2, ch / 2, 100, cw / 2, ch / 2, 620); gr.addColorStop(0, '#efe2bf'); gr.addColorStop(1, '#c9b07a');
    c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(110,80,40,${Math.random() * 0.06})`; c.fillRect(Math.random() * cw, Math.random() * ch, 3, 3); }
    // zonas
    MAPA.zonas.forEach((zn, a) => {
      c.beginPath(); zn.poly.forEach(([x, y], i) => i ? c.lineTo(x * cw, y * ch) : c.moveTo(x * cw, y * ch)); c.closePath();
      c.globalAlpha = this.areaLiberada(a) ? 0.42 : 0.18; c.fillStyle = zn.cor; c.fill(); c.globalAlpha = 1;
      c.lineWidth = 5; c.setLineDash([16, 10]); c.strokeStyle = zn.borda; c.stroke(); c.setLineDash([]);
    });
    // estradas e rio desenhados à mão
    c.strokeStyle = '#8c7650'; c.lineWidth = 9; c.lineCap = 'round';
    for (const r of [[[0.02, 0.5], [0.3, 0.48], [0.55, 0.52], [0.98, 0.46]], [[0.5, 0.02], [0.52, 0.4], [0.47, 0.98]], [[0.2, 0.05], [0.18, 0.95]], [[0.8, 0.04], [0.83, 0.96]]]) { c.beginPath(); r.forEach(([x, y], i) => i ? c.lineTo(x * cw, y * ch) : c.moveTo(x * cw, y * ch)); c.stroke(); }
    c.strokeStyle = '#5d86a8'; c.lineWidth = 12; c.beginPath(); c.moveTo(0.0 * cw, 0.85 * ch); c.bezierCurveTo(0.3 * cw, 0.7 * ch, 0.55 * cw, 1.0 * ch, 1.0 * cw, 0.78 * ch); c.stroke();
    // quadradinhos de prédios
    c.fillStyle = 'rgba(70,50,30,0.35)'; for (let i = 0; i < 70; i++) { const x = Math.random() * cw, y = Math.random() * ch; c.fillRect(x, y, 10 + Math.random() * 18, 8 + Math.random() * 14); }
    // números das zonas
    MAPA.zonas.forEach((zn, a) => {
      const [x, y] = zn.rot; c.font = 'bold 120px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(40,25,10,0.55)'; c.fillText(String(a + 1), x * cw, y * ch);
      if (!this.areaLiberada(a)) { c.font = '70px Arial'; c.fillText('🔒', x * cw, y * ch + 95); }
    });
    // bordas e rosa dos ventos
    c.lineWidth = 10; c.strokeStyle = '#7a6236'; c.strokeRect(5, 5, cw - 10, ch - 10);
    c.font = 'bold 34px Arial'; c.fillStyle = '#5a4424'; c.textAlign = 'center'; c.fillText('N ▲', cw - 70, 50);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return tex;
  }
  montarCena() {
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight('#fff1d6', '#2e2a22', 1.35));
    const sun = new THREE.DirectionalLight('#ffe8c8', 0.7); sun.position.set(8, 20, 14); sc.add(sun);
    this.chaoMat = new THREE.MeshLambertMaterial({ map: this.texPiso() });
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), this.chaoMat);
    chao.position.set(W / 2, 0, H / 2); sc.add(chao);
    // paredes: uma instância por célula; as da frente da câmera abaixam quando o jogador está atrás delas
    this.paredes = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (this.grid.get(x, z) === 1) {
      // só paredes que encostam em alguma sala (o resto é rocha)
      let viz = false; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.grid.get(x + dx, z + dz) === 0) viz = true;
      if (viz) this.paredes.push({ x, z, h: ALT_PAREDE });
    }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    this.paredeMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#8a8478' }), this.paredes.length);
    this.paredeTopo = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.08, 1.02), new THREE.MeshLambertMaterial({ color: '#3b3a36' }), this.paredes.length);
    const cor = new THREE.Color();
    this.paredes.forEach((p, i) => { const g = (p.x * 7 + p.z * 13) % 5; cor.set(g ? '#8a8478' : '#7c766b'); this.paredeMesh.setColorAt(i, cor); });
    this.atualizarParedes(1);
    sc.add(this.paredeMesh, this.paredeTopo);
    // rocha em volta do bunker
    const rocha = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, H + 30).rotateX(-Math.PI / 2), mat('#15130f')); rocha.position.set(W / 2, -0.01, H / 2); sc.add(rocha);
    this.montarFixos();
    // grupos das salas que mudam de estado
    this.estGroups = {}; this.labels = {}; this.pendMk = {};
    for (const e of EST) {
      const g = new THREE.Group(); sc.add(g); this.estGroups[e.id] = g;
      const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat('#ffd84a', { emissive: '#aa8800' })); mk.position.set(e.x, 2.9, e.z); mk.visible = false; sc.add(mk); this.pendMk[e.id] = mk;
    }
  }
  atualizarParedes(k) {
    const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4();
    const p = this.player ? this.player.pos : null;
    this.paredes.forEach((w, i) => {
      let alvo = ALT_PAREDE;
      if (p) {
        // paredes entre o jogador e a câmera (câmera fica em +x,+z) viram "rodapé", como numa casa em corte
        const dx = w.x + 0.5 - p.x, dz = w.z + 0.5 - p.z;
        const frente = (dx + dz) * Math.SQRT1_2, lado = Math.abs(dx - dz) * Math.SQRT1_2;
        if (frente > -0.2 && frente < 9 && lado < 4.2) alvo = 0.32;
        // paredes externas do lado da câmera ficam sempre baixas
        if (w.x === W - 1 || w.z === H - 1) alvo = 0.32;
      }
      w.h += (alvo - w.h) * k;
      m4.makeScale(1, w.h, 1).setPosition(w.x + 0.5, 0, w.z + 0.5); this.paredeMesh.setMatrixAt(i, m4);
      m5.makeTranslation(w.x + 0.5, w.h + 0.04, w.z + 0.5); this.paredeTopo.setMatrixAt(i, m5);
    });
    this.paredeMesh.instanceMatrix.needsUpdate = true; this.paredeTopo.instanceMatrix.needsUpdate = true;
  }
  // ---------- objetos que não mudam: mesa de guerra, mercado, entrada, gerador ----------
  montarFixos() {
    const sc = this.scene;
    const B = (w, h, d, c, x, y, z, o = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || mat(c, o)); m.position.set(x, y + h / 2, z); if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.rx) m.rotation.x = o.rx; sc.add(m); return m; };
    const C = (r, h, c, x, y, z, o = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 12), mat(c, o)); m.position.set(x, y + h / 2, z); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; sc.add(m); return m; };
    this.B = B; this.C = C;
    // ===== salão: mesa de guerra com o mapa das zonas =====
    const { x: mx, z: mz, larg, prof, alt } = MESA;
    B(larg + 0.2, 0.14, prof + 0.2, '#5a3d22', mx, alt - 0.14, mz);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.16, alt - 0.14, 0.16, '#3a2716', mx + a * (larg / 2 - 0.05), 0, mz + b * (prof / 2 - 0.05));
    B(larg - 0.3, 0.06, 0.12, '#3a2716', mx, 0.25, mz);
    this.mapaMat = new THREE.MeshLambertMaterial({ map: this.texMapa() });
    const papel = new THREE.Mesh(new THREE.PlaneGeometry(larg - 0.1, prof - 0.1).rotateX(-Math.PI / 2), this.mapaMat); papel.position.set(mx, alt + 0.005, mz); sc.add(papel);
    // alfinetes
    this.pinos = [];
    MAPA.pinos.forEach((lista, a) => lista.forEach(([u, v], l) => {
      const px = mx - (larg - 0.1) / 2 + u * (larg - 0.1), pz = mz - (prof - 0.1) / 2 + v * (prof - 0.1);
      const haste = C(0.008, 0.1, '#ccc', px, alt, pz, { seg: 5 });
      const cab = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(MAPA.corPino[a], { emissive: MAPA.corPino[a], emissiveIntensity: 0.15 })); cab.position.set(px, alt + 0.11, pz); sc.add(cab);
      this.pinos.push({ a, l, pos: new THREE.Vector3(px, alt + 0.12, pz), cab });
    }));
    // rádio, lanterna e caneca na mesa
    B(0.3, 0.2, 0.18, '#3d4a35', mx + larg / 2 - 0.3, alt, mz - prof / 2 + 0.22); C(0.012, 0.3, '#222', mx + larg / 2 - 0.2, alt + 0.2, mz - prof / 2 + 0.2, { seg: 5 });
    C(0.05, 0.08, '#c33', mx - larg / 2 + 0.25, alt, mz + prof / 2 - 0.2);
    // luminária pendurada sobre a mesa
    this.lustre = [C(0.02, 1.0, '#222', mx, 2.6, mz, { seg: 5 }), C(0.35, 0.18, '#3a3f3a', mx, 2.42, mz, { rt: 0.08 })];
    const luz = new THREE.PointLight('#ffd9a0', 6, 9, 1.4); luz.position.set(mx, 2.3, mz); sc.add(luz);
    // sacos de areia e caixotes nos cantos do salão
    for (const [x, z] of [[11.6, 6.6], [20.4, 6.6], [11.6, 15.3], [20.4, 15.3]]) for (let k = 0; k < 3; k++) B(0.6, 0.22, 0.35, '#a8935e', x + (k % 2) * 0.1, k * 0.22, z, { ry: k * 0.3 });
    B(0.8, 0.6, 0.8, '#6b5232', 12.2, 0, 13.8); B(0.6, 0.45, 0.6, '#7a6040', 12.3, 0.6, 13.8, { ry: 0.4 });
    B(0.9, 1.6, 0.5, '#4f5c4a', 20.5, 0, 9.5); // armário de rádio
    // ===== mercado: parede de armas, balcão de vidro e expositores =====
    B(6.5, 1.5, 0.12, '#3b3125', 16, 0.5, 1.08); // painel
    const armaPainel = (x, y, comp, cor) => { B(comp, 0.1, 0.05, cor, x, y, 1.18); B(0.08, 0.18, 0.05, cor, x - comp * 0.25, y - 0.15, 1.18); };
    [[13.6, 1.75, 1.1, '#2b2b2b'], [15.2, 1.75, 0.9, '#3a2a1a'], [16.8, 1.75, 1.2, '#2b2b2b'], [18.4, 1.75, 0.6, '#444'], [14.4, 1.25, 0.6, '#555'], [16, 1.25, 1.3, '#3a2a1a'], [17.8, 1.25, 0.8, '#2b2b2b']].forEach(a => armaPainel(...a));
    for (let k = 0; k < 7; k++) B(0.08, 0.06, 0.04, '#e6c84a', 13.4 + k * 0.82, 1.42, 1.2); // etiquetas
    // balcão de vidro
    B(5.4, 0.55, 0.75, '#5a3d22', 16, 0, 3.0);
    const vidroMat = new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.25, depthWrite: false });
    B(5.4, 0.45, 0.75, null, 16, 0.55, 3.0, { mat: vidroMat });
    const itensVitrine = ['#c33', '#3a7', '#dd3', '#ccc', '#7a4', '#a63', '#36c', '#c80'];
    for (let k = 0; k < 14; k++) B(0.18, 0.14, 0.14, itensVitrine[k % itensVitrine.length], 13.6 + k * 0.34, 0.58, 3.0 + (k % 2 ? 0.12 : -0.12), { ry: k });
    B(5.5, 0.04, 0.8, '#7a5a3a', 16, 1.0, 3.0);
    B(0.4, 0.25, 0.3, '#333', 14.0, 1.04, 3.0); C(0.05, 0.05, '#d4af37', 18.6, 1.04, 3.0); // caixa e sininho
    // expositores laterais
    for (const x of [11.6, 20.4]) {
      B(0.7, 1.6, 1.6, '#4a3a2a', x, 0, 2.6);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) B(0.25, 0.22, 0.25, pick(['#7a8a4a', '#c8a050', '#a04a3a', '#4a6a8a']), x, 0.15 + r * 0.5, 2.1 + k * 0.5);
    }
    const com = modeloPronto('mercador') ? criarAnimado('mercador') : makeChibi({ shirt: '#8a6a2a', skin: '#c68e5f', hair: '#222' }); com.group.position.set(16, 0, 1.9); sc.add(com.group); this.comerciante = com;
    const lm = new THREE.PointLight('#ffe2b0', 7, 8, 1.4); lm.position.set(16, 2.3, 2.8); sc.add(lm);
    // ===== entrada: porta-cofre redonda =====
    const porta = C(1.3, 0.35, '#7d858a', 16, 0, 22.0, { rx: Math.PI / 2, seg: 24 }); porta.position.y = 1.35;
    const anel = C(1.45, 0.25, '#d8b42a', 16, 0, 22.1, { rx: Math.PI / 2, seg: 24 }); anel.position.y = 1.35;
    const roda = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 16), mat('#4a5054')); roda.position.set(16, 1.35, 21.78); sc.add(roda);
    for (const x of [11.5, 12.3, 20.5]) B(0.6, 1.7, 0.5, '#5d6a6f', x, 0, 17.4); // armários
    for (let k = 0; k < 4; k++) B(0.6, 0.22, 0.35, '#a8935e', 13 + k * 0.62, (k % 2) * 0.22, 21.3);
    const le = new THREE.PointLight('#ff9a5a', 5, 7, 1.4); le.position.set(16, 2.2, 19.5); sc.add(le);
    // ===== sala do gerador =====
    B(2.2, 1.3, 1.2, '#5f6b3a', 27, 0, 19.2); B(0.5, 0.6, 0.5, '#333', 25.6, 0, 19.2); C(0.12, 1.3, '#555', 28.4, 1.3, 18.8);
    for (let k = 0; k < 3; k++) C(0.25, 0.8, '#7a2b23', 24 + k * 0.6, 0, 21.2);
    for (let k = 0; k < 5; k++) { const t = C(0.05, 5, '#6a6f72', 23.4, 1.8 + k * 0.08, 19, { rz: Math.PI / 2 }); t.position.x = 26.5; }
    const lg = new THREE.PointLight('#b6ff9a', 4, 7, 1.4); lg.position.set(27, 2.2, 19); sc.add(lg);
    // bloqueios fixos (não dá para atravessar)
    this.fixos = [];
    const bl = (x0, z0, x1, z1) => this.fixos.push([x0, z0, x1, z1]);
    bl(Math.floor(mx - larg / 2), Math.floor(mz - prof / 2), Math.ceil(mx + larg / 2) - 1, Math.ceil(mz + prof / 2) - 1);
    bl(13, 2, 18, 3); bl(11, 1, 21, 1); bl(11, 1, 11, 3); bl(21, 1, 21, 3);
    bl(26, 18, 27, 19); bl(11, 17, 12, 17); bl(20, 17, 20, 17);
  }
  labelTxt(e) {
    if (!e.pad) return `${e.ic} ${e.nome}`;
    const n = S.estruturas[e.id];
    return n ? `${e.ic} ${e.nome} Nv.${n}` : `🔨 ${e.nome} (velha)`;
  }
  refazTudo() {
    this.chaoMat.map.dispose(); this.chaoMat.map = this.texPiso();
    if (this.mapaMat) { this.mapaMat.map.dispose(); this.mapaMat.map = this.texMapa(); }
    // refaz os bloqueios: limpa móveis antigos e marca de novo
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (this.grid.get(x, z) === 4) this.grid.set(x, z, 0);
    this.bloq = this.fixos.slice();
    for (const e of EST) {
      if (this.labels[e.id]) this.scene.remove(this.labels[e.id]);
      const s = SALAS[e.sala];
      const lb = makeLabel(this.labelTxt(e), { h: 0.62, bg: e.pad && !S.estruturas[e.id] ? 'rgba(70,40,10,0.8)' : 'rgba(0,0,0,0.6)' });
      if (e.id === 'mesa') lb.position.set(e.x, 2.0, e.z); else lb.position.set((s.x0 + s.x1 + 1) / 2, 2.75, (s.z0 + s.z1 + 1) / 2);
      this.scene.add(lb); this.labels[e.id] = lb;
      if (e.pad) this.montarEstrutura(e);
    }
    for (const [x0, z0, x1, z1] of this.bloq) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.grid.get(x, z) === 0) this.grid.set(x, z, 4);
    this.montarSobreviventes();
  }
  // ---------- salas que começam velhas e ficam arrumadas ao construir/evoluir ----------
  montarEstrutura(e) {
    const g = this.estGroups[e.id]; while (g.children.length) g.remove(g.children[0]);
    const n = S.estruturas[e.id], s = SALAS[e.sala];
    const B = (w, h, d, c, x, y, z, o = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || mat(c, o)); m.position.set(x, y + h / 2, z); m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); g.add(m); return m; };
    const C = (r, h, c, x, y, z, o = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 10), mat(c, o)); m.position.set(x, y + h / 2, z); m.rotation.set(o.rx || 0, 0, o.rz || 0); g.add(m); return m; };
    const Sph = (r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(c)); m.position.set(x, y, z); g.add(m); return m; };
    const bl = (x0, z0, x1, z1) => this.bloq.push([x0, z0, x1, z1]);
    const luz = (c, i) => { const l = new THREE.PointLight(c, i, 8, 1.4); l.position.set((s.x0 + s.x1 + 1) / 2, 2.2, (s.z0 + s.z1 + 1) / 2); g.add(l); };
    const entulho = (k) => { for (let i = 0; i < k; i++) B(rand(0.1, 0.35), rand(0.04, 0.12), rand(0.1, 0.3), pick(['#4a4038', '#5a5048', '#3a332c', '#6b5a40']), rand(s.x0 + 0.4, s.x1 + 0.6), 0, rand(s.z0 + 0.4, s.z1 + 0.6), { ry: rand(0, 3) }); };
    const teia = (x, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.45, 6, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d8d8d0', transparent: true, opacity: 0.25, side: THREE.DoubleSide, wireframe: true })); m.position.set(x, 1.7, z); g.add(m); };
    if (e.id === 'oficina') {
      if (!n) {
        // bancada quebrada, ferramentas jogadas, barril enferrujado
        B(2.4, 0.08, 0.8, '#5d4128', 4, 0.55, 1.6, { rz: 0.25 }); B(0.12, 0.7, 0.12, '#3d2a17', 3.0, 0, 1.4); B(0.12, 0.35, 0.12, '#3d2a17', 5.0, 0, 1.4, { rz: 0.6 });
        C(0.32, 0.8, '#6a3b20', 8.2, 0, 1.8); C(0.32, 0.8, '#5a3420', 7.5, 0, 6.5, { rx: Math.PI / 2 });
        B(1.6, 1.0, 0.05, '#4a3523', 4, 0.4, 1.06, { rz: 0.1 }); entulho(16); teia(1.2, 1.2); teia(9.6, 1.2);
        bl(2, 1, 5, 1); bl(8, 1, 8, 2); luz('#ff9a5a', 3);
      } else {
        // bancada de armas: morsa, prensa de munição, painel de ferramentas
        B(3.2, 0.12, 0.9, '#7a5434', 4.5, 0.8, 1.6); for (const x of [3.0, 6.0]) B(0.14, 0.8, 0.8, '#4a3523', x, 0, 1.6);
        B(3.2, 0.06, 0.8, '#5a3d22', 4.5, 0.25, 1.6);
        B(0.35, 0.25, 0.3, '#444', 3.4, 0.92, 1.6); B(0.25, 0.4, 0.25, '#2f5d8a', 5.6, 0.92, 1.6); // morsa e prensa
        B(3.4, 1.3, 0.06, '#8a6a42', 4.5, 1.0, 1.08);
        for (let k = 0; k < 8; k++) B(0.05, 0.3, 0.04, pick(['#888', '#c33', '#333', '#a80']), 3.1 + k * 0.4, 1.5, 1.13, { rz: rand(-0.3, 0.3) });
        for (let k = 0; k < 4; k++) B(0.22, 0.14, 0.16, '#5a6a3a', 4.0 + k * 0.28, 0.92, 1.85); // caixas de munição
        C(0.04, 0.5, '#222', 6.3, 0.92, 1.4); C(0.14, 0.12, '#d8b42a', 6.3, 1.4, 1.5, { rt: 0.05 });
        bl(3, 1, 6, 2);
        if (n >= 2) { B(0.12, 1.6, 2.2, '#3b3125', 1.1, 0.2, 4.5); for (let k = 0; k < 4; k++) { B(0.06, 0.1, 1.0, '#222', 1.2, 0.6 + k * 0.35, 4.5); } }
        if (n >= 3) { B(1.0, 1.2, 0.9, '#5d6a6f', 8.3, 0, 6.3); B(0.4, 0.4, 0.05, '#c33', 8.3, 0.7, 5.84); for (let k = 0; k < 6; k++) B(0.4, 0.3, 0.3, '#5a6a3a', 7.0 + (k % 3) * 0.45, Math.floor(k / 3) * 0.3, 7.4); bl(8, 6, 8, 6); }
        luz('#ffd9a0', 6);
      }
    } else if (e.id === 'enfermaria') {
      const maca = (x, z, ok) => {
        if (ok) { B(0.8, 0.12, 1.7, '#cfd8dc', x, 0.5, z); B(0.75, 0.12, 1.6, '#f4f6f7', x, 0.62, z); B(0.6, 0.12, 0.35, '#9ad', x, 0.74, z - 0.6); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(0.03, 0.5, '#aab', x + a * 0.33, 0, z + b * 0.75, { seg: 6 }); C(0.015, 1.4, '#bbb', x + 0.55, 0, z - 0.6, { seg: 5 }); B(0.18, 0.25, 0.06, '#cfe', x + 0.55, 1.25, z - 0.6); }
        else { B(0.8, 0.12, 1.7, '#6a5a4a', x, 0.3, z, { rz: 0.35, ry: rand(-0.4, 0.4) }); B(0.7, 0.1, 1.1, '#7a6a50', x + 0.1, 0.42, z + 0.2, { rz: 0.3, rx: 0.2 }); C(0.03, 0.5, '#6a5040', x + 0.4, 0, z + 0.7, { seg: 6, rz: 0.9 }); C(0.015, 1.4, '#6a6a5a', x + 0.6, 0, z - 0.4, { seg: 5, rz: 1.35 }); }
      };
      if (!n) {
        maca(2.5, 11, false); maca(5.2, 11.2, false);
        B(0.9, 1.4, 0.45, '#8a8a7a', 8.5, 0, 9.6, { rz: 0.5 }); for (let k = 0; k < 8; k++) C(0.05, 0.14, pick(['#7a6a50', '#556']), rand(7, 9.5), 0, rand(10, 12), { rz: 1.5 });
        B(1.4, 0.05, 0.5, '#8a3a2a', 3.8, 0.0, 14.2, { ry: 0.3 }); entulho(18); teia(1.2, 9.2); bl(2, 10, 5, 11); luz('#c8ff9a', 2.5);
      } else {
        const qt = n + 1; for (let k = 0; k < qt; k++) maca(2.2 + k * 1.9, 10.6, true);
        bl(1, 9, Math.min(9, 2 + qt * 2), 11);
        B(1.0, 1.6, 0.45, '#e6ebee', 8.6, 0, 14.6); B(0.35, 0.35, 0.05, '#d33', 8.6, 1.2, 14.36); for (let k = 0; k < 6; k++) B(0.12, 0.18, 0.12, pick(['#fff', '#9cf', '#f9c']), 8.3 + (k % 3) * 0.3, 0.3 + Math.floor(k / 3) * 0.5, 14.5);
        if (n >= 2) { B(0.05, 1.5, 1.6, '#cfe6e0', 6.8, 0, 13.2); B(0.05, 1.5, 1.6, '#cfe6e0', 4.5, 0, 13.2, { ry: 0.3 }); }
        if (n >= 3) { B(0.5, 0.5, 0.4, '#334', 1.6, 0.9, 13.8); B(0.4, 0.3, 0.02, '#3c6', 1.6, 1.0, 13.59); B(0.6, 0.9, 0.5, '#d9dfe2', 1.6, 0, 13.8); }
        bl(8, 14, 8, 14); luz('#e8f6ff', 7);
      }
    } else if (e.id === 'estufa') {
      const vidroOk = new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.16, depthWrite: false });
      const cx = 5, cz = 19.2;
      // estrutura da estufa (armação + vidros)
      const armacao = n ? '#e6e6e0' : '#6a5a4a';
      for (const x of [1.3, 3.2, 5.1, 7.0, 8.9]) for (const z of [17.3, 21.1]) B(0.08, 1.8, 0.08, armacao, x, 0, z, n ? {} : { rz: rand(-0.12, 0.12) });
      B(7.7, 0.08, 0.08, armacao, cx, 1.8, 17.3); B(7.7, 0.08, 0.08, armacao, cx, 1.8, 21.1);
      if (n) { B(7.7, 1.8, 0.04, null, cx, 0, 17.3, { mat: vidroOk }); B(0.04, 1.8, 3.8, null, 1.3, 0, cz, { mat: vidroOk }); B(0.04, 1.8, 3.8, null, 8.9, 0, cz, { mat: vidroOk }); }
      else { for (let k = 0; k < 4; k++) B(rand(0.5, 1.2), rand(0.4, 1), 0.03, '#9ab', rand(2, 8), rand(0.2, 1), 17.32, { rz: rand(-0.5, 0.5), mat: new THREE.MeshLambertMaterial({ color: '#9ab', transparent: true, opacity: 0.3 }) }); for (let k = 0; k < 20; k++) B(0.12, 0.01, 0.08, '#cde', rand(1.5, 8.5), 0, rand(17.5, 21), { ry: rand(0, 3) }); }
      const linhas = n ? Math.min(3, n + 1) : 3;
      for (let r = 0; r < linhas; r++) {
        const z = 18.0 + r * 1.2;
        B(6.2, 0.35, 0.6, n ? '#7a5434' : '#4a3a2c', cx, 0, z, n ? {} : { ry: rand(-0.05, 0.05) });
        for (let j = 0; j < 7; j++) {
          const x = 2.3 + j * 0.9;
          if (n) {
            Sph(0.2, pick(['#4a8a3a', '#5aa04a', '#3f7a30']), x, 0.55, z);
            if (n >= 2 && j % 2) Sph(0.09, pick(['#e04848', '#f0c030', '#e080c0', '#ff8030']), x + 0.1, 0.72, z + 0.05);
          } else { C(0.015, 0.35, '#6a5a3a', x, 0.35, z, { seg: 4, rz: rand(-0.6, 0.6) }); if (Math.random() < 0.6) Sph(0.07, '#5a4a3a', x + 0.05, 0.62, z); }
        }
        bl(2, Math.floor(z), 8, Math.floor(z));
      }
      if (n >= 3) for (let k = 0; k < 3; k++) { const l = B(1.6, 0.06, 0.12, '#b080ff', 3 + k * 2, 1.7, 19.2, { emissive: '#8040ff', emissiveIntensity: 0.8 }); }
      if (n) { B(0.3, 0.25, 0.2, '#3a7a4a', 8.4, 0, 21.6); luz(n >= 3 ? '#e0c0ff' : '#ffffe0', 5); } else { entulho(10); luz('#ffb070', 2); }
    } else if (e.id === 'estoque') {
      const prat = (x, z, ok) => {
        if (ok) { B(1.8, 1.8, 0.5, '#5d6a6f', x, 0, z, { mat: new THREE.MeshLambertMaterial({ color: '#5d6a6f', transparent: true, opacity: 0.0 }) }); for (let r = 0; r < 4; r++) { B(1.8, 0.05, 0.55, '#6a777c', x, 0.1 + r * 0.5, z); for (let k = 0; k < 5; k++) B(0.28, 0.3, 0.32, pick(['#8a6a3a', '#7a8a4a', '#c8a050', '#4a6a8a', '#c33']), x - 0.7 + k * 0.35, 0.15 + r * 0.5, z, { ry: rand(-0.2, 0.2) }); } for (const a of [-0.88, 0.88]) B(0.05, 1.8, 0.55, '#4a5458', x + a, 0, z); }
        else { B(1.8, 0.05, 0.55, '#5a5a50', x, 0.6, z, { rz: 0.5 }); B(0.05, 1.6, 0.5, '#4a4a42', x - 0.8, 0, z, { rz: 0.3 }); for (let k = 0; k < 4; k++) B(0.3, 0.28, 0.3, '#6a5a3a', x + rand(-0.8, 0.8), 0, z + rand(0.3, 0.9), { ry: rand(0, 3) }); }
      };
      if (!n) { prat(25, 1.6, false); prat(28.5, 1.6, false); entulho(14); teia(30.6, 1.2); luz('#ff9a5a', 2.5); bl(24, 1, 29, 1); }
      else {
        const qt = Math.min(6, 2 * n + 1); const pos = [[24.2, 1.5], [26.4, 1.5], [28.6, 1.5], [24.2, 4.5], [28.6, 4.5], [26.4, 6.8]];
        for (let k = 0; k < qt; k++) { prat(pos[k][0], pos[k][1], true); const [x, z] = pos[k]; bl(Math.floor(x - 0.9), Math.floor(z), Math.floor(x + 0.9), Math.floor(z)); }
        for (let k = 0; k < n * 3; k++) C(0.18, 0.5, '#3a7aa8', 29.8, 0, 6.6 - k * 0.4 > 3 ? 6.6 - k * 0.4 : 3); // galões de água
        luz('#fff0d0', 6);
      }
    } else if (e.id === 'alojamento') {
      const beliche = (x, z) => {
        for (const y of [0.3, 1.15]) { B(0.95, 0.12, 1.9, '#5a6670', x, y, z); B(0.85, 0.14, 1.8, pick(['#3d4f6b', '#6b3d3d', '#4f6b3d']), x, y + 0.12, z); B(0.5, 0.1, 0.3, '#ddd', x, y + 0.26, z - 0.7); }
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.06, 1.6, 0.06, '#444', x + a * 0.45, 0, z + b * 0.92);
      };
      if (!n) {
        for (let k = 0; k < 3; k++) { B(0.9, 0.12, 1.8, pick(['#6a5a48', '#5a4e3e']), 24.5 + k * 1.5, 0, 10.5 + (k % 2) * 0.4, { ry: rand(-0.3, 0.3) }); B(0.4, 0.08, 0.25, '#8a8070', 24.5 + k * 1.5, 0.12, 9.9); }
        B(1.6, 0.05, 1.2, '#4a3a30', 27.5, 0, 14, { ry: 0.5 }); entulho(12); teia(30.6, 9.2); luz('#ff9a5a', 2.5);
      } else {
        const qt = n + 1; for (let k = 0; k < qt; k++) { const x = 24 + k * 1.8; beliche(x, 10.4); bl(Math.floor(x - 0.4), 9, Math.floor(x + 0.4), 11); }
        for (let k = 0; k < n; k++) B(0.5, 1.5, 0.45, '#4f6b5a', 30.3, 0, 14.5 - k * 0.6);
        if (n >= 2) { B(2.0, 0.05, 1.4, '#7a4a3a', 26.5, 0, 13.6); B(0.8, 0.5, 0.6, '#6b4a2b', 26.5, 0, 13.6); }
        if (n >= 3) { B(0.6, 0.5, 0.4, '#222', 27.6, 0.5, 13.6); B(0.5, 0.35, 0.02, '#4af', 27.6, 0.6, 13.39); }
        luz('#ffe0b0', 6);
      }
    }
  }
  montarSobreviventes() {
    this.svs.forEach(s => this.scene.remove(s.model.group)); this.svs = [];
    for (const sv of S.sobreviventes) {
      const m = criarSobrevivente(sv);
      const sala = SALAS[sv.posto && SALAS[sv.posto] ? sv.posto : 'alojamento'];
      const home = { x: (sala.x0 + sala.x1 + 1) / 2, z: (sala.z0 + sala.z1 + 1) / 2 + 1.2, sala };
      const pos = this.pontoLivre(sala) || new THREE.Vector3(home.x, 0, home.z);
      const lb = makeLabel(`${PROFISSOES[sv.prof].ic} ${sv.nome}`, { h: 0.4 }); lb.position.y = 1.55; m.group.add(lb);
      this.scene.add(m.group); this.svs.push({ sv, model: m, pos, home, alvo: null, t: rand(0, 3) });
    }
  }
  pontoLivre(sala) {
    for (let k = 0; k < 30; k++) { const x = rand(sala.x0 + 0.4, sala.x1 + 0.6), z = rand(sala.z0 + 0.4, sala.z1 + 0.6); if (this.grid.get(Math.floor(x), Math.floor(z)) === 0) return new THREE.Vector3(x, 0, z); }
    return null;
  }
  montarHUD() {
    document.getElementById('hudTL').innerHTML = `<div class="row" style="gap:6px"><div class="chip money" id="bMoney"></div><div class="chip" id="bEst"></div><div class="chip" id="bSv"></div></div>`;
    document.getElementById('hudTC').innerHTML = `<div class="chip" id="bDica" style="font-size:12px"></div>`;
    document.getElementById('hudTR').innerHTML = (S.teste ? `<button class="cbtn pe" id="bTesteQG" style="width:46px;height:46px;font-size:18px;border-color:#e9f45a">🧪</button>` : '') + `<button class="cbtn pe" id="bMenu" style="width:46px;height:46px;font-size:18px">⚙️</button>`;
    document.getElementById('hudBR').innerHTML = `<span></span><button class="cbtn big pe off" id="bAcao"><span id="bAcaoT">—</span></button>`;
    const tap = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap(document.getElementById('bAcao'), () => this.interagir());
    tap(document.getElementById('bMenu'), () => this.menu());
    if (S.teste) tap(document.getElementById("bTesteQG"), () => this.painelTeste());
    this.keyH = e => { if (ui.isOpen()) return; if (this.mapa) { if (e.code === 'Escape') this.sairMapa(); return; } if (e.code === 'KeyE' || e.code === 'Space') this.interagir(); };
    window.addEventListener('keydown', this.keyH);
    this.hud();
  }
  hud() {
    document.getElementById('bMoney').textContent = `$ ${S.dinheiro}`;
    document.getElementById('bEst').textContent = `🗄️ ${usoEstoque()}/${capEstoque()}`;
    document.getElementById('bSv').textContent = `👥 ${S.sobreviventes.length}`;
    let dica = 'Vá até a 🗺️ Mesa de Guerra, no salão central, para escolher uma missão';
    if (S.expedicoes > 0 && !S.estruturas.oficina) dica = 'Venda o loot no 💰 Mercado e reforme a 🛠️ Oficina';
    document.getElementById('bDica').textContent = dica;
  }
  estProxima() {
    const p = this.player.pos;
    const m = EST[0]; if (Math.hypot(p.x - m.x, p.z - m.z) < m.raio) return m;
    const sala = salaDe(p.x, p.z); if (!sala) return null;
    return EST.find(e => e.sala === sala && e.id !== 'mesa') || null;
  }
  update(dt) {
    const p = this.player;
    if (this.mapa) { this.updateMapa(dt); }
    else {
      const inp = readInput();
      if (inp.active) { moveCircle(p.pos, inp.mx * 4 * dt, inp.mz * 4 * dt, 0.3, (x, y) => this.grid.get(x, y) !== 0); p.face = Math.atan2(inp.mx, inp.mz); }
      this.pm.group.position.copy(p.pos); this.pm.group.rotation.y = p.face; animar(this.pm, dt, inp.active ? inp.mag : 0);
      camFollow(p.pos.x, p.pos.z, dt);
    }
    this.atualizarParedes(1 - Math.exp(-dt * 10));
    if (this.comerciante && this.comerciante.animado) {
      // o comerciante conversa quando o jogador chega perto do balcão
      const pp = this.pm.group.position, perto = salaDe(pp.x, pp.z) === 'mercado';
      animar(this.comerciante, dt, 0, perto ? { clip: 'falando' } : {});
      this.comerciante.group.rotation.y = perto ? Math.atan2(pp.x - 16, pp.z - 1.9) : 0;
    } else if (this.comerciante) animChibi(this.comerciante, dt * 0.3, 0);
    for (const s of this.svs) {
      s.t -= dt;
      if (s.t <= 0) { const q = this.pontoLivre(s.home.sala); s.alvo = q ? { x: q.x, z: q.z } : null; s.t = rand(3, 7); }
      let mov = 0;
      if (s.alvo) { const dx = s.alvo.x - s.pos.x, dz = s.alvo.z - s.pos.z, d = Math.hypot(dx, dz); if (d > 0.1) { const ox = s.pos.x, oz = s.pos.z; moveCircle(s.pos, dx / d * 1.2 * dt, dz / d * 1.2 * dt, 0.25, (x, y) => this.grid.get(x, y) !== 0); if (Math.hypot(s.pos.x - ox, s.pos.z - oz) < 0.2 * dt) s.alvo = null; s.model.group.rotation.y = Math.atan2(dx, dz); mov = 0.5; } else s.alvo = null; }
      s.model.group.position.copy(s.pos); animar(s.model, dt, mov, { walkSpeed: 1 });
    }
    if (!this.mapa) {
      const e = this.estProxima();
      const t = e ? `Abrir<br>${e.ic}` : '—';
      if (t !== this._t) { document.getElementById('bAcaoT').innerHTML = t; this._t = t; document.getElementById('bAcao').classList.toggle('off', !e); }
    }
    this.tick = (this.tick || 0) - dt;
    if (this.tick <= 0) {
      this.tick = 2; tickProducao();
      for (const id in this.pendMk) this.pendMk[id].visible = Object.values(S.pend[id] || {}).some(v => v >= 1);
      this.hud();
    }
    for (const id in this.pendMk) if (this.pendMk[id].visible) { this.pendMk[id].rotation.y += dt * 2; this.pendMk[id].position.y = 2.9 + Math.sin(performance.now() / 300) * 0.1; }
  }
  depois() { salvar(); this.refazTudo(); this.hud(); this.tick = 0; }

  // ================= MAPA DA MESA (câmera dá zoom até o papel) =================
  abrirMapa() {
    if (this.mapa) return;
    sfx('ok');
    // o jogador fica de pé na borda sul da mesa, olhando para ela
    const p = this.player; p.pos.set(MESA.x, 0, MESA.z + MESA.prof / 2 + 0.55); p.face = Math.PI;
    this.pm.group.position.copy(p.pos); this.pm.group.rotation.y = p.face; animar(this.pm, 0.016, 0);
    this.mapa = { t: 0, saindo: false, de: { pos: camera.position.clone(), size: VIEW.size, alvo: new THREE.Vector3(p.pos.x, 0, p.pos.z) } };
    document.getElementById('hud').style.visibility = 'hidden';
    this.lustre.forEach(m => m.visible = false); for (const id in this.labels) this.labels[id].visible = false;
    const ov = document.createElement('div'); ov.id = 'mapaUI';
    ov.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;font-family:inherit';
    ov.innerHTML = `<div id="mpPinos"></div>
      <button class="cbtn pe" id="mpVoltar" style="position:absolute;left:10px;top:10px;pointer-events:auto;padding:8px 14px;font-size:14px">← Voltar</button>
      <div id="mpZonas" style="position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;gap:6px;pointer-events:auto"></div>
      <div id="mpInfo" style="position:absolute;right:10px;bottom:10px;width:min(300px,38vw);max-height:calc(100% - 70px);overflow:auto;background:#000c;border:1px solid #fff3;border-radius:12px;padding:10px;pointer-events:auto;font-size:13px"></div>`;
    document.body.appendChild(ov); this.mapaUI = ov;
    ov.querySelector('#mpVoltar').onclick = () => this.sairMapa();
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b || b.disabled) return;
      const a = b.dataset.m;
      if (a === 'zona') { const i = +b.dataset.i; this.sel.area = i; this.sel.loc = 0; sfx('ok'); }
      else if (a === 'pino') { this.sel.area = +b.dataset.a; this.sel.loc = +b.dataset.l; sfx('ok'); }
      else if (a === 'diff') this.sel.diff = b.dataset.k;
      else if (a === 'prep') { if (this.areaLiberada(this.sel.area)) this.painelPreparo(); return; }
      this.renderMapaUI();
    });
    // botões dos alfinetes (posicionados sobre o papel a cada quadro)
    const pinos = ov.querySelector('#mpPinos');
    this.pinoEls = this.pinos.map(pn => {
      const L = AREAS[pn.a].locais[pn.l]; const b = document.createElement('button');
      b.dataset.m = 'pino'; b.dataset.a = pn.a; b.dataset.l = pn.l;
      b.style.cssText = `position:absolute;transform:translate(-50%,-100%);pointer-events:auto;background:#000b;border:2px solid ${MAPA.corPino[pn.a]};border-radius:10px;padding:2px 6px;font-size:12px;color:#fff;white-space:nowrap`;
      b.innerHTML = `${L.ic}<span style="display:none"> ${L.nome}</span>`;
      pinos.appendChild(b); return b;
    });
    this.renderMapaUI();
  }
  renderMapaUI() {
    if (!this.mapaUI) return;
    const s = this.sel, A = AREAS[s.area], lib = this.areaLiberada(s.area);
    this.mapaUI.querySelector('#mpZonas').innerHTML = AREAS.map((a, i) => `<button class="sb ${i === s.area ? '' : 'g'}" data-m="zona" data-i="${i}" style="border:2px solid ${MAPA.zonas[i].cor}">${this.areaLiberada(i) ? '' : '🔒 '}Zona ${i + 1}</button>`).join('');
    this.pinoEls.forEach((b, k) => { const pn = this.pinos[k]; const on = pn.a === s.area && pn.l === s.loc; b.style.background = on ? MAPA.corPino[pn.a] : '#000b'; b.style.color = on && pn.a === 1 ? '#222' : '#fff'; b.style.opacity = this.areaLiberada(pn.a) ? 1 : 0.45; b.querySelector('span').style.display = on ? 'inline' : 'none'; b.style.zIndex = on ? 2 : 1; });
    let h = `<div style="font-weight:800;font-size:15px">${A.nome}</div>`;
    if (!lib) h += `<p class="muted">🔒 Extraia com sucesso de ${LIBERAR_AREA} locais diferentes da ${AREAS[s.area - 1].nome} para liberar.</p>`;
    else {
      const L = A.locais[s.loc];
      h += `<div style="margin:4px 0 2px;font-size:14px">${L.ic} <b>${L.nome}</b> ${S.extraidos[`${s.area}-${s.loc}`] ? '✅' : ''}</div>`;
      h += `<div class="muted">${A.hordas} hordas · ${A.entradas} entradas${A.tipos.includes('corredor') ? ' · corredores' : ''}${A.tipos.includes('brutamonte') ? ' · brutamontes' : ''}</div>`;
      h += `<div class="muted">Mais comum: ${Object.entries(L.loot).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => ITENS[k].ic + ' ' + ITENS[k].nome).join(', ')}</div>`;
      h += `<div style="display:flex;gap:4px;margin:8px 0;flex-wrap:wrap">${Object.entries(DIFICULDADES).map(([k, d]) => `<button class="sb ${k === s.diff ? '' : 'g'}" data-m="diff" data-k="${k}">${d.nome}</button>`).join('')}</div>`;
      const D = DIFICULDADES[s.diff];
      h += `<div class="muted">${D.desc}</div><div style="margin:6px 0">Loot ×${D.loot} · prêmio <span class="money">$${Math.round(A.$ * D.$)}</span></div>`;
      h += `<button class="sb" data-m="prep" style="width:100%;padding:9px;font-size:14px">Preparar expedição →</button>`;
    }
    this.mapaUI.querySelector('#mpInfo').innerHTML = h;
  }
  sairMapa() {
    if (!this.mapa || this.mapa.saindo) return;
    this.mapa.saindo = true; this.mapa.t = 0;
    if (this.mapaUI) { this.mapaUI.remove(); this.mapaUI = null; }
  }
  updateMapa(dt) {
    const M = this.mapa;
    M.t = Math.min(1, M.t + dt / 0.7);
    const k = M.t * M.t * (3 - 2 * M.t);
    // câmera quase de cima, centrada no papel, com zoom suficiente para ver as bordas do QG e o jogador
    const a = window.innerWidth / window.innerHeight;
    const sizeMesa = Math.max(1.45, (MESA.larg / 2 + 0.55) / a, MESA.prof / 2 + 0.5);
    // o papel fica à esquerda; o quadro de informações ocupa a direita da tela
    const info = Math.min(300, window.innerWidth * 0.38) + 20;
    const desl = (info / 2) / window.innerWidth * 2 * sizeMesa * a;
    const alvoMesa = new THREE.Vector3(MESA.x + desl, MESA.alt, MESA.z + 0.15);
    const posMesa = new THREE.Vector3(MESA.x + desl, 14, MESA.z + 3.2);
    const de = M.de;
    const isoPos = new THREE.Vector3(de.alvo.x + 14, 19, de.alvo.z + 14);
    const [pA, pB, tA, tB, sA, sB] = M.saindo ? [posMesa, isoPos, alvoMesa, de.alvo, sizeMesa, 6.5] : [de.pos, posMesa, de.alvo, alvoMesa, de.size, sizeMesa];
    camera.position.lerpVectors(pA, pB, k);
    const look = new THREE.Vector3().lerpVectors(tA, tB, k);
    camera.lookAt(look);
    VIEW.size = sA + (sB - sA) * k; resize();
    animar(this.pm, dt, 0);
    if (!M.saindo && this.pinoEls) {
      this.pinoEls.forEach((b, i) => { const sp = toScreen(this.pinos[i].pos); b.style.left = sp.x + 'px'; b.style.top = sp.y + 'px'; b.style.visibility = M.t > 0.85 ? 'visible' : 'hidden'; });
    }
    if (M.saindo && M.t >= 1) {
      this.mapa = null; VIEW.size = 6.5; resize();
      document.getElementById('hud').style.visibility = '';
      this.lustre.forEach(m => m.visible = true); for (const id in this.labels) this.labels[id].visible = true;
      camFollow(this.player.pos.x, this.player.pos.z, 0, true);
    }
  }

  // ================= PAINÉIS =================
  interagir() {
    const e = this.estProxima(); if (!e) return; sfx('ok');
    tickProducao();
    if (e.id === 'mesa') this.abrirMapa();
    else if (e.id === 'mercado') this.painelMercado('vender');
    else this.painelEstrutura(e.id);
  }
  painelTeste() {
    ui.openPanel({
      title: '🧪 Modo teste',
      body: `<p class="muted">Save separado do jogo normal. Tudo liberado: todas as áreas e locais, todas as armas no nível máximo, estruturas no máximo, 99 de cada item e um sobrevivente de cada profissão.</p>
        <div class="grid">
          <div class="card" data-a="galeria"><h3>🎬 Ver animações</h3><div class="s">Protagonista e zumbi militar, todas as animações</div></div>
          <div class="card" data-a="dinheiro"><h3>💰 +$100.000</h3><div class="s">Dinheiro infinito na prática</div></div>
          <div class="card" data-a="itens"><h3>📦 Repor itens</h3><div class="s">Volta tudo para 99</div></div>
          <div class="card" data-a="sv"><h3>🆘 +1 sobrevivente</h3><div class="s">Profissão aleatória</div></div>
          <div class="card" data-a="mil"><h3>${S.soMilitar ? '🟢' : '⚪'} Só zumbi militar</h3><div class="s">Nas expedições, todos os zumbis serão o militar</div></div>
        </div>
        <p class="muted">Dentro da expedição, o botão 🧪 tem: invencível, matar todos, pular horda, liberar evacuação e mais.</p>`,
      foot: `<button class="sb r" data-a="sair">Sair do modo teste</button><button class="sb" data-a="fechar">Fechar</button>`,
      on: {
        fechar: () => ui.closePanel(),
        galeria: () => { ui.closePanel(); this.game.abrirGaleria(); },
        dinheiro: () => { S.dinheiro += 100000; toast('+$100.000'); this.depois(); },
        itens: () => { for (const k in ITENS) S.estoque[k] = 99; toast('Estoque reposto'); this.depois(); },
        sv: async () => { const { novoSobrevivente } = await import('./state.js'); S.sobreviventes.push(novoSobrevivente()); toast('Novo sobrevivente no Alojamento'); this.depois(); },
        mil: () => { S.soMilitar = !S.soMilitar; this.depois(); ui.closePanel(); this.painelTeste(); },
        sair: () => { salvar(); location.reload(); },
      },
    });
  }
  menu() {
    ui.openPanel({
      title: '⚙️ Menu',
      body: `<p><b>Como jogar</b></p><p class="muted">Ande com o joystick (toque e arraste na metade esquerda da tela). Chegue perto de um lugar e toque no botão verde. Na expedição a mira é automática: você só se posiciona, barrica e saqueia.</p><p class="muted">No PC: WASD para andar, E para interagir.</p><p class="muted">Seu progresso fica salvo neste navegador.</p>`,
      foot: `<button class="sb r" data-a="reset">Apagar progresso</button><button class="sb" data-a="fechar">Fechar</button>`,
      on: { fechar: () => ui.closePanel(), reset: b => { if (b.dataset.ok) { resetar(); location.reload(); } else { b.dataset.ok = 1; b.textContent = 'Toque de novo para confirmar'; } } },
    });
  }
  areaLiberada(a) {
    if (a === 0 || S.teste) return true;
    const n = AREAS[a - 1].locais.filter((_, l) => S.extraidos[`${a - 1}-${l}`]).length;
    return n >= LIBERAR_AREA;
  }
  painelMesa() {
    const render = () => {
      const s = this.sel, A = AREAS[s.area];
      let h = `<div class="tabs">${AREAS.map((a, i) => `<button class="${i === s.area ? 'on' : ''}" data-a="area" data-i="${i}">${this.areaLiberada(i) ? '' : '🔒 '}${a.nome}</button>`).join('')}</div>`;
      if (!this.areaLiberada(s.area)) {
        h += `<p class="muted">🔒 Extraia com sucesso de ${LIBERAR_AREA} locais diferentes da ${AREAS[s.area - 1].nome} para liberar.</p>`;
      } else {
        h += `<p class="muted">${A.hordas} hordas · ${A.entradas} entradas · prêmio base <span class="money">$${A.$}</span>${A.tipos.includes('corredor') ? ' · zumbis corredores' : ''}${A.tipos.includes('brutamonte') ? ' · brutamontes' : ''}</p>`;
        h += `<div class="grid">${A.locais.map((l, i) => `<div class="card ${i === s.loc ? 'sel' : ''}" data-a="loc" data-i="${i}"><h3>${l.ic} ${l.nome} ${S.extraidos[`${s.area}-${i}`] ? '✅' : ''}</h3><div class="s">Mais comum: ${Object.entries(l.loot).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => ITENS[k].ic + ' ' + ITENS[k].nome).join(', ')}</div></div>`).join('')}</div>`;
        h += `<h4>Dificuldade</h4><div class="grid">${Object.entries(DIFICULDADES).map(([k, d]) => `<div class="card ${k === s.diff ? 'sel' : ''}" data-a="diff" data-k="${k}"><h3>${d.nome}</h3><div class="s">${d.desc}</div><div class="s">Loot ×${d.loot} · prêmio <span class="money">$${Math.round(A.$ * d.$)}</span></div></div>`).join('')}</div>`;
      }
      ui.setBody(h);
      ui.setFoot(this.areaLiberada(s.area) ? `<button class="sb" data-a="prep">Preparar expedição →</button>` : '');
    };
    ui.openPanel({ title: '🗺️ Mesa de Guerra', body: '', on: {
      area: b => { this.sel.area = +b.dataset.i; this.sel.loc = 0; render(); },
      loc: b => { this.sel.loc = +b.dataset.i; render(); },
      diff: b => { this.sel.diff = b.dataset.k; render(); },
      prep: () => this.painelPreparo(),
    } });
    render();
  }
  painelPreparo() {
    const own = Object.keys(S.armas);
    const prep = this.prep || (this.prep = { armas: {}, itens: {}, esq: [] });
    for (const slot of ['principal', 'secundaria']) if (prep.armas[slot] && !own.includes(prep.armas[slot])) prep.armas[slot] = null;
    for (const slot of ['principal', 'secundaria']) if (prep.armas[slot] === undefined) prep.armas[slot] = own.find(w => ARMAS[w].slot === slot) || null;
    prep.esq = prep.esq.filter(id => S.sobreviventes.some(s => s.id === id));
    const uso = () => Object.values(prep.itens).reduce((a, b) => a + b, 0);
    for (const k in prep.itens) prep.itens[k] = Math.min(prep.itens[k], S.estoque[k] || 0);
    const render = () => {
      const L = AREAS[this.sel.area].locais[this.sel.loc];
      let h = `<p>${L.ic} <b>${L.nome}</b> · ${DIFICULDADES[this.sel.diff].nome}</p><h4>Armamento</h4><div class="grid">`;
      for (const slot of ['principal', 'secundaria']) {
        const ops = own.filter(w => ARMAS[w].slot === slot);
        h += `<div class="card"><div class="s">Arma ${slot === 'principal' ? 'principal' : 'secundária'}</div><select data-c="arma" data-slot="${slot}"><option value="">— Nenhuma —</option>${ops.map(w => `<option value="${w}" ${prep.armas[slot] === w ? 'selected' : ''}>${ARMAS[w].nome} T${S.armas[w]}</option>`).join('')}</select>${ops.length ? '' : '<div class="s">Fabrique na Oficina</div>'}</div>`;
      }
      h += `<div class="card"><div class="s">Pistola</div><b>Pistola T${S.armas.pistola}</b><div class="s">Munição infinita</div></div><div class="card"><div class="s">Corpo a corpo</div><b>Faca T${S.armas.faca}</b><div class="s">Automática quando o zumbi encosta</div></div></div>`;
      h += `<h4>Mochila ${uso()}/${capMochila()}</h4><div class="grid">`;
      for (const k of CONSUMIVEIS) {
        const tem = S.estoque[k] || 0, n = prep.itens[k] || 0;
        h += `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}<br><span class="muted">tem ${tem}</span></b><div class="step"><button data-a="menos" data-k="${k}">−</button><span>${n}</span><button data-a="mais" data-k="${k}" ${n >= tem || uso() >= capMochila() ? 'disabled' : ''}>+</button></div></div>`;
      }
      h += `</div><p class="muted">Tábuas barricam portas e janelas. 1⚙️ + 1🔌 consertam o gerador. Cada 📦 = ${BALAS_POR_PENTE} balas para as armas principal e secundária.</p>`;
      h += `<h4>Esquadrão (até 2)</h4>`;
      if (!S.sobreviventes.length) h += `<p class="muted">Nenhum sobrevivente ainda. Resgate pessoas 🆘 durante as expedições.</p>`;
      else h += `<div class="grid">${S.sobreviventes.map(sv => { const on = prep.esq.includes(sv.id); return `<div class="card ${on ? 'sel' : ''}" data-a="esq" data-id="${sv.id}"><h3>${sv.nome}</h3><div class="s">${nomeProf(sv.prof)}</div><div class="s">Em campo: ${PROFISSOES[sv.prof].campo}</div><div class="s" style="color:#f99">Se morrer, é perdido para sempre</div></div>`; }).join('')}</div>`;
      const b = bonusExpedicao(prep.esq);
      h += `<p class="muted">Bônus nesta expedição: vida ${100 + b.vida} · dispersão −${Math.round(b.disp * 100)}% · cura ×${b.cura} · saque ×${b.saque.toFixed(2)}${b.pentePorHorda ? ` · +${b.pentePorHorda} pente/horda` : ''}</p>`;
      ui.setBody(h);
    };
    ui.openPanel({ title: '🎒 Preparação', body: '', foot: `<button class="sb g" data-a="voltar">← Voltar</button><button class="sb" data-a="partir">Partir!</button>`, on: {
      arma: el => { prep.armas[el.dataset.slot] = el.value || null; },
      mais: b => { const k = b.dataset.k; if ((prep.itens[k] || 0) < (S.estoque[k] || 0) && uso() < capMochila()) prep.itens[k] = (prep.itens[k] || 0) + 1; render(); },
      menos: b => { const k = b.dataset.k; prep.itens[k] = Math.max(0, (prep.itens[k] || 0) - 1); render(); },
      esq: b => { const id = +b.dataset.id; if (prep.esq.includes(id)) prep.esq = prep.esq.filter(x => x !== id); else if (prep.esq.length < 2) prep.esq.push(id); else toast('Máximo de 2 no esquadrão'); render(); },
      voltar: () => ui.closePanel(),
      partir: () => {
        const itens = {}; for (const k in prep.itens) if (prep.itens[k] > 0) { itens[k] = prep.itens[k]; S.estoque[k] -= prep.itens[k]; if (S.estoque[k] <= 0) delete S.estoque[k]; }
        prep.itens = {};
        salvar(); ui.closePanel();
        this.game.iniciarExpedicao({ area: this.sel.area, loc: this.sel.loc, diff: this.sel.diff, armas: { ...prep.armas, pistola: 'pistola', faca: 'faca' }, itens, esquadrao: [...prep.esq] });
      },
    } });
    render();
  }
  painelMercado(aba) {
    const render = () => {
      let h = `<div class="tabs"><button class="${aba === 'vender' ? 'on' : ''}" data-a="aba" data-k="vender">Vender</button><button class="${aba === 'comprar' ? 'on' : ''}" data-a="aba" data-k="comprar">Comprar</button></div><p>Seu dinheiro: <span class="money">$${S.dinheiro}</span></p>`;
      if (aba === 'vender') {
        const ks = Object.keys(S.estoque).filter(k => S.estoque[k] > 0);
        h += ks.length ? `<div class="grid">${ks.map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome} ×${S.estoque[k]}<br><span class="money">$${ITENS[k].preco}</span> <span class="muted">cada</span></b><button class="sb g" data-a="v1" data-k="${k}">1</button><button class="sb" data-a="vt" data-k="${k}">Tudo</button></div>`).join('')}</div>` : '<p class="muted">Estoque vazio.</p>';
        h += `<p class="muted">Dica: guarde tábuas, engrenagens e fios — eles servem para construir e nas expedições.</p>`;
      } else {
        h += `<div class="grid">${LOJA.map(k => { const p = Math.round(ITENS[k].preco * 2.5); return `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}<br><span class="money">$${p}</span></b><button class="sb" data-a="c1" data-k="${k}" ${S.dinheiro < p || usoEstoque() >= capEstoque() ? 'disabled' : ''}>Comprar</button></div>`; }).join('')}</div><p class="muted">Comprar custa 2,5× o valor de venda. Saquear sai mais barato.</p>`;
      }
      ui.setBody(h);
    };
    const vender = (k, n) => { n = Math.min(n, S.estoque[k] || 0); S.estoque[k] -= n; if (!S.estoque[k]) delete S.estoque[k]; S.dinheiro += n * ITENS[k].preco; sfx('ok'); this.depois(); render(); };
    ui.openPanel({ title: '💰 Mercado', body: '', on: {
      aba: b => { aba = b.dataset.k; render(); },
      v1: b => vender(b.dataset.k, 1), vt: b => vender(b.dataset.k, 999),
      c1: b => { const k = b.dataset.k, p = Math.round(ITENS[k].preco * 2.5); if (S.dinheiro >= p && usoEstoque() < capEstoque()) { S.dinheiro -= p; S.estoque[k] = (S.estoque[k] || 0) + 1; sfx('ok'); this.depois(); render(); } },
    } });
    render();
  }
  htmlEstoque() {
    const ks = Object.keys(S.estoque).filter(k => S.estoque[k] > 0);
    return `<h4>Guardado ${usoEstoque()}/${capEstoque()}</h4>` + (ks.length ? `<div class="grid">${ks.map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}</b>${S.estoque[k]}</div>`).join('')}</div>` : '<p class="muted">Vazio.</p>') + `<h4>Armas</h4><div class="grid">${Object.keys(S.armas).map(w => `<div class="it">🔫<b>${ARMAS[w].nome}</b>T${S.armas[w]}</div>`).join('')}</div><p class="muted">O que não couber ao voltar de uma expedição é vendido pela metade do preço.</p>`;
  }
  htmlAlojamento() {
    if (!S.sobreviventes.length) return `<h4>Sobreviventes</h4><p class="muted">Ninguém aqui ainda. Durante as expedições, procure pessoas presas (🆘), resgate-as e chegue vivo à evacuação.</p>`;
    return `<h4>Sobreviventes</h4><p class="muted">Coloque cada pessoa numa sala reformada. Fora da especialidade ela trabalha (+50% de produção), mas o bônus da profissão fica desligado.</p><div class="grid">${S.sobreviventes.map(sv => this.cardSv(sv)).join('')}</div>`;
  }
  cardSv(sv) {
    const P = PROFISSOES[sv.prof];
    const ops = Object.keys(ESTRUTURAS).filter(k => S.estruturas[k] > 0 && k !== 'estoque' && k !== 'alojamento');
    const ativo = bonusAtivo(sv);
    return `<div class="card"><h3>${sv.nome}</h3><div class="s">${nomeProf(sv.prof)} · especialidade: ${ESTRUTURAS[P.posto].nome}</div>
      <div class="s">No QG: ${P.base} ${sv.posto ? (ativo ? '<b style="color:#9e6">✓ ativo</b>' : '<b style="color:#f99">✗ desligado</b>') : ''}</div>
      <div class="s">Em campo: ${P.campo}</div>
      <select data-c="posto" data-id="${sv.id}"><option value="">Descansando</option>${ops.map(k => `<option value="${k}" ${sv.posto === k ? 'selected' : ''} ${trabalhadores(k).length >= 2 && sv.posto !== k ? 'disabled' : ''}>${ESTRUTURAS[k].ic} ${ESTRUTURAS[k].nome}${k === P.posto ? ' ★' : ''}</option>`).join('')}</select></div>`;
  }
  atribuir(id, posto) {
    tickProducao();
    const sv = S.sobreviventes.find(s => s.id === id); if (!sv) return;
    if (posto && trabalhadores(posto).length >= 2 && sv.posto !== posto) { toast('Máximo de 2 por estrutura'); return; }
    sv.posto = posto || null; this.depois();
  }
  painelEstrutura(id) {
    const E = ESTRUTURAS[id];
    const render = () => {
      tickProducao();
      const n = S.estruturas[id];
      let h = `<p class="muted">${E.desc}</p>`;
      if (n < E.max) { const c = CUSTO_ESTRUTURA[id][n]; h += `<div class="row"><b>${n ? `Evoluir para Nv.${n + 1}` : 'Reformar'}:</b> ${custoTxt(c)} <button class="sb" data-a="up" ${temCusto(c) ? '' : 'disabled'}>${n ? 'Evoluir' : 'Reformar'}</button></div>`; }
      else h += `<p><b>Nível máximo</b></p>`;
      if (n) {
        const tx = taxas()[id];
        if (id === 'estoque') h += `<p>Capacidade do estoque: <b>${capEstoque()}</b></p>`;
        if (id === 'alojamento') h += `<p>Bônus de descanso: <b>+${15 * n}%</b> de produção em todas as salas</p>`;
        if (tx) {
          const pend = S.pend[id] || {};
          h += `<h4>Produção</h4><div class="grid">${Object.keys(tx).map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}<br><span class="muted">${(tx[k] * 60).toFixed(0)}/hora · guarda até ${capPend(id)}</span></b>${Math.floor(pend[k] || 0)}</div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="sb" data-a="col">Coletar</button></div>`;
        } else if (id !== 'estoque' && id !== 'alojamento') h += `<p class="muted">Sem produção agora${id === 'oficina' ? ' (coloque um Fabricante aqui para produzir munição e sucata)' : ''}.</p>`;
        const ws = trabalhadores(id);
        h += `<h4>Trabalhadores ${ws.length}/2</h4>`;
        h += ws.length ? `<div class="grid">${ws.map(sv => `<div class="it">${PROFISSOES[sv.prof].ic}<b>${sv.nome}<br><span class="muted">${bonusAtivo(sv) ? '★ ' + PROFISSOES[sv.prof].base : 'fora da especialidade'}</span></b><button class="sb g" data-a="tirar" data-id="${sv.id}">Tirar</button></div>`).join('')}</div>` : '';
        const livres = S.sobreviventes.filter(s => s.posto !== id);
        if (ws.length < 2 && livres.length) h += `<div class="row" style="margin-top:6px"><select data-c="por"><option value="">+ Colocar alguém…</option>${livres.map(s => `<option value="${s.id}">${s.nome} — ${nomeProf(s.prof)}${PROFISSOES[s.prof].posto === id ? ' ★' : ''}${s.posto ? ` (em ${ESTRUTURAS[s.posto].nome})` : ''}</option>`).join('')}</select></div>`;
        if (!S.sobreviventes.length) h += `<p class="muted">Resgate sobreviventes nas expedições para trabalharem aqui.</p>`;
        if (id === 'oficina') h += this.htmlOficina();
      } else h += `<p class="muted">A sala está velha e quebrada. Reforme para começar a usar.</p>`;
      if (id === 'estoque') h += this.htmlEstoque();
      if (id === 'alojamento') h += this.htmlAlojamento();
      ui.setBody(h);
    };
    ui.openPanel({ title: `${E.ic} ${E.nome}${S.estruturas[id] ? ' Nv.' + S.estruturas[id] : ''}`, body: '', on: {
      up: () => { const c = CUSTO_ESTRUTURA[id][S.estruturas[id]]; if (!temCusto(c)) return; tickProducao(); pagar(c); S.estruturas[id]++; sfx('ok'); toast(`${E.ic} ${E.nome} Nv.${S.estruturas[id]}!`); this.depois(); this.painelEstrutura(id); },
      col: () => { const r = coletar(id); const t = Object.entries(r.got).map(([k, v]) => ITENS[k].ic + v).join(' '); toast(t ? `Coletou ${t}` : 'Nada para coletar ainda'); if (r.vendido) toast(`Estoque cheio: vendeu o excesso por $${r.vendido}`); sfx('ok'); this.depois(); render(); },
      tirar: b => { this.atribuir(+b.dataset.id, null); render(); },
      por: el => { if (el.value) { this.atribuir(+el.value, id); render(); } },
      fab: b => { const w = b.dataset.k, c = FABRICAR[w]; if (!temCusto(c)) return; pagar(c); S.armas[w] = 1; sfx('ok'); toast(`🔫 ${ARMAS[w].nome} fabricada!`); this.depois(); render(); },
      tier: b => { const w = b.dataset.k, c = custoTier(S.armas[w]); if (!temCusto(c)) return; pagar(c); S.armas[w]++; sfx('ok'); toast(`${ARMAS[w].nome} agora é T${S.armas[w]}`); this.depois(); render(); },
      mun: b => { const q = +b.dataset.q; for (let i = 0; i < q; i++) { if (!temCusto(FAB_MUNICAO) || usoEstoque() >= capEstoque()) break; pagar(FAB_MUNICAO); S.estoque.municao = (S.estoque.municao || 0) + 1; } sfx('ok'); toast('📦 Munição fabricada'); this.depois(); render(); },
      posto: el => { this.atribuir(+el.dataset.id, el.value); render(); },
      moch: () => { const c = custoMochila(S.mochila); if (!temCusto(c)) return; pagar(c); S.mochila++; sfx('ok'); toast(`🎒 Mochila agora leva ${capMochila()}`); this.depois(); render(); },
    } });
    render();
  }
  htmlOficina() {
    const n = S.estruturas.oficina, maxT = Math.min(4, n + 1);
    let h = `<h4>Fabricar munição</h4><div class="row">1 pente (${BALAS_POR_PENTE} balas): ${custoTxt(FAB_MUNICAO)} <button class="sb" data-a="mun" data-q="1" ${temCusto(FAB_MUNICAO) ? '' : 'disabled'}>Fazer 1</button><button class="sb g" data-a="mun" data-q="5" ${temCusto(FAB_MUNICAO) ? '' : 'disabled'}>Fazer 5</button></div><h4>Fabricar armas</h4><div class="grid">`;
    for (const w in FABRICAR) {
      const c = FABRICAR[w], tem = S.armas[w];
      const st = statsArma(w, 1);
      h += `<div class="card ${n < c.nivel ? 'lock' : ''}"><h3>${ARMAS[w].nome}</h3><div class="s">${ARMAS[w].slot === 'principal' ? 'Principal' : 'Secundária'} · dano ${st.dmg}${st.proj > 1 ? '×' + st.proj : ''} · alcance ${st.alc}</div>${tem ? '<div class="s">✓ Você já tem</div>' : n < c.nivel ? `<div class="s">Requer Oficina Nv.${c.nivel}</div>` : `<div class="row">${custoTxt(c)}<button class="sb" data-a="fab" data-k="${w}" ${temCusto(c) ? '' : 'disabled'}>Fabricar</button></div>`}</div>`;
    }
    h += `</div><h4>Melhorar armas (até T${maxT})</h4><div class="grid">`;
    for (const w in S.armas) {
      const t = S.armas[w], c = custoTier(t);
      h += `<div class="card"><h3>${ARMAS[w].nome} T${t}</h3>${t >= maxT ? `<div class="s">${t >= 4 ? 'Máximo' : 'Evolua a Oficina para ir além'}</div>` : `<div class="s">T${t + 1}: +35% dano, atira mais rápido</div><div class="row">${custoTxt(c)}<button class="sb" data-a="tier" data-k="${w}" ${temCusto(c) ? '' : 'disabled'}>Melhorar</button></div>`}</div>`;
    }
    h += `</div><h4>Mochila tática</h4>`;
    if (S.mochila >= MOCHILA_MAX) h += `<p>Capacidade máxima: ${capMochila()}</p>`;
    else { const c = custoMochila(S.mochila); h += `<div class="row">Capacidade ${capMochila()} → ${capMochila() + 6}: ${custoTxt(c)} <button class="sb" data-a="moch" ${temCusto(c) ? '' : 'disabled'}>Ampliar</button></div>`; }
    return h;
  }
  dispose() { window.removeEventListener('keydown', this.keyH); if (this.mapaUI) this.mapaUI.remove(); document.getElementById('hud').style.visibility = ''; }
}
