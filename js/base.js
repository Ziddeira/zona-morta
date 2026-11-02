import { THREE, makeChibi, animChibi, Grid, moveCircle, rand, pick, toast, sfx, mat, makeLabel, camFollow, readInput, VIEW, resize } from './engine.js';
import { ITENS, ARMAS, FABRICAR, custoTier, ESTRUTURAS, CUSTO_ESTRUTURA, PROFISSOES, DIFICULDADES, AREAS, CONSUMIVEIS, LOJA, LIBERAR_AREA, MOCHILA_MAX, custoMochila, statsArma, BALAS_POR_PENTE } from './data.js';
import { S, salvar, capMochila, capEstoque, usoEstoque, temCusto, pagar, custoTxt, bonusAtivo, trabalhadores, bonusExpedicao, tickProducao, coletar, taxas, capPend, resetar } from './state.js';
import * as ui from './ui.js';

const W = 28, H = 18;
const EST = [
  { id: 'mesa', x: 14, z: 9, nome: 'Mesa de Guerra', ic: '🗺️' },
  { id: 'mercado', x: 14, z: 3.2, nome: 'Mercado', ic: '💰' },
  { id: 'oficina', x: 5, z: 4.5, nome: 'Oficina de Armas', ic: '🛠️', pad: true },
  { id: 'enfermaria', x: 5, z: 13.5, nome: 'Enfermaria', ic: '🏥', pad: true },
  { id: 'paiol', x: 23, z: 4.5, nome: 'Paiol', ic: '📦', pad: true },
  { id: 'estufa', x: 23, z: 13.5, nome: 'Estufa', ic: '🌱', pad: true },
  { id: 'curral', x: 14, z: 15, nome: 'Curral', ic: '🐄', pad: true },
  { id: 'alojamento', x: 9.2, z: 9, nome: 'Alojamento', ic: '🛏️' },
  { id: 'estoque', x: 18.8, z: 9, nome: 'Estoque', ic: '🗄️' },
];
const nomeProf = p => PROFISSOES[p].ic + ' ' + PROFISSOES[p].nome;

export class Base {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#141613');
    VIEW.size = 6.5; resize();
    this.grid = new Grid(W, H, 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x === 0 || y === 0 || x === W - 1 || y === H - 1) this.grid.set(x, y, 1);
    [[13, 8], [14, 8], [13, 9], [14, 9]].forEach(([x, y]) => this.grid.set(x, y, 4));
    for (let x = 12; x <= 15; x++) this.grid.set(x, 2, 4);
    this.sel = { area: 0, loc: 0, diff: 'facil' };
    this.montarCena();
    this.player = { pos: new THREE.Vector3(14, 0, 11.5), face: Math.PI };
    this.pm = makeChibi({ shirt: '#2f5d8a', pants: '#2b2b33', skin: '#d9a77c', cap: '#3d5f22' });
    this.scene.add(this.pm.group);
    this.svs = [];
    tickProducao();
    this.refazTudo();
    this.montarHUD();
    camFollow(this.player.pos.x, this.player.pos.z, 0, true);
  }
  montarCena() {
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight('#fff1d6', '#3a3226', 1.5));
    const sun = new THREE.DirectionalLight('#ffe0b0', 1.1); sun.position.set(8, 20, 14); sc.add(sun);
    // piso
    const P = 8, cv = document.createElement('canvas'); cv.width = W * P; cv.height = H * P;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { ctx.fillStyle = (x + y) % 2 ? '#5d5a52' : '#57544c'; ctx.fillRect(x * P, y * P, P, P); }
    for (const e of EST) if (e.pad) { ctx.fillStyle = 'rgba(180,220,120,0.10)'; ctx.fillRect((e.x - 2.5) * P, (e.z - 2.5) * P, 5 * P, 5 * P); ctx.strokeStyle = 'rgba(200,230,140,0.35)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeRect((e.x - 2.5) * P, (e.z - 2.5) * P, 5 * P, 5 * P); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    chao.position.set(W / 2, 0, H / 2); sc.add(chao);
    const walls = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.grid.get(x, y) === 1) walls.push([x, y]);
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.0, 1), mat('#7b7060'), walls.length);
    const m4 = new THREE.Matrix4(); walls.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, 0.5, y + 0.5); wm.setMatrixAt(i, m4); }); sc.add(wm);
    // mesa de guerra
    const mesa = new THREE.Group(); mesa.position.set(14, 0, 9);
    const tampo = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), mat('#5a3d22')); tampo.position.y = 0.75; mesa.add(tampo);
    [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), mat('#3d2a17')); p.position.set(x, 0.37, z); mesa.add(p); });
    const mapa = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.02, 1.3), mat('#cdbb8a')); mapa.position.y = 0.82; mesa.add(mapa);
    for (let k = 0; k < 5; k++) { const pin = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(pick(['#d33', '#3a3', '#dd3']))); pin.position.set(rand(-0.7, 0.7), 0.86, rand(-0.5, 0.5)); mesa.add(pin); }
    sc.add(mesa);
    // mercado: balcão + comerciante
    const balcao = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.8), mat('#7a5a3a')); balcao.position.set(14, 0.4, 2.5); sc.add(balcao);
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), mat('#333')); caixa.position.set(13.2, 0.95, 2.5); sc.add(caixa);
    const com = makeChibi({ shirt: '#8a6a2a', skin: '#c68e5f', hair: '#222' }); com.group.position.set(14.6, 0, 1.6); sc.add(com.group); this.comerciante = com;
    // alojamento: beliches
    for (let k = 0; k < 3; k++) { const b = new THREE.Group(); b.position.set(7.5 + k * 1.2, 0, 7.3);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.8), mat('#3d4f6b')); c1.position.y = 0.4; b.add(c1);
      const c2 = c1.clone(); c2.position.y = 1.1; b.add(c2);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), mat('#555')); tr.position.set(0.45, 0.65, 0.9); b.add(tr); sc.add(b); }
    // estoque: armários
    for (let k = 0; k < 3; k++) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.6), mat('#5d6a6f')); a.position.set(18 + k * 0.9, 0.7, 7.4); sc.add(a); }
    // luminárias
    for (const [x, z] of [[7, 9], [21, 9], [14, 5], [14, 13]]) { const l = new THREE.PointLight('#ffd9a0', 6, 9, 1.2); l.position.set(x, 3, z); sc.add(l); }
    this.estGroups = {};
    this.labels = {};
    this.pendMk = {};
    for (const e of EST) {
      const g = new THREE.Group(); g.position.set(e.x, 0, e.z); sc.add(g); this.estGroups[e.id] = g;
      const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat('#ffd84a', { emissive: '#aa8800' })); mk.position.set(e.x, 2.8, e.z); mk.visible = false; sc.add(mk); this.pendMk[e.id] = mk;
    }
  }
  labelTxt(e) {
    if (!e.pad) return `${e.ic} ${e.nome}`;
    const n = S.estruturas[e.id];
    return n ? `${e.ic} ${e.nome} Nv.${n}` : `🔨 Construir ${e.nome}`;
  }
  refazTudo() {
    for (const e of EST) {
      if (this.labels[e.id]) this.scene.remove(this.labels[e.id]);
      const lb = makeLabel(this.labelTxt(e), { h: 0.62, bg: e.pad && !S.estruturas[e.id] ? 'rgba(60,40,10,0.75)' : 'rgba(0,0,0,0.6)' });
      lb.position.set(e.x, e.id === 'mercado' ? 2.5 : 2.2, e.id === 'mercado' ? 2.2 : e.z); this.scene.add(lb); this.labels[e.id] = lb;
      if (e.pad) this.montarEstrutura(e);
    }
    this.montarSobreviventes();
  }
  montarEstrutura(e) {
    const g = this.estGroups[e.id]; while (g.children.length) g.remove(g.children[0]);
    const n = S.estruturas[e.id];
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; };
    if (!n) { // obra: pilha de tábuas e placa
      box(1.2, 0.3, 0.5, '#8a5a32', -0.5, 0, 0.6); box(1.2, 0.15, 0.5, '#9a6a3a', -0.4, 0.3, 0.6);
      box(0.08, 1, 0.08, '#5a3d22', 0.8, 0, -0.6); box(0.7, 0.45, 0.06, '#c9a227', 0.8, 0.8, -0.58);
      return;
    }
    if (e.id === 'oficina') {
      box(1.8, 0.8, 0.8, '#6b4a2b', 0, 0, -1.2); box(0.4, 0.25, 0.3, '#444', -0.4, 0.8, -1.2);
      if (n >= 2) { box(0.1, 1.4, 1.6, '#4a3523', 1.8, 0, 0); for (let k = 0; k < 3; k++) box(0.08, 0.12, 0.8, '#222', 1.7, 0.4 + k * 0.35, 0); }
      if (n >= 3) { box(0.8, 0.9, 0.8, '#5d6a6f', -1.5, 0, 1.2); box(0.3, 0.3, 0.3, '#c33', -1.5, 0.9, 1.2); }
    } else if (e.id === 'enfermaria') {
      for (let k = 0; k < n + 1; k++) { box(0.8, 0.45, 1.6, '#e9eef0', -1.5 + k * 1.1, 0, -0.4); box(0.7, 0.12, 0.4, '#9ad', -1.5 + k * 1.1, 0.45, -1); }
      box(0.8, 1.2, 0.4, '#d9dfe2', 1.6, 0, 1.6); box(0.25, 0.25, 0.05, '#d33', 1.6, 0.8, 1.38);
    } else if (e.id === 'paiol') {
      for (let k = 0; k < n * 2; k++) { box(0.7, 0.6, 0.7, pick(['#8a6a3a', '#6f5530', '#7a7a5a']), -1.4 + (k % 4) * 0.95, Math.floor(k / 4) * 0.6, -1.2 + Math.floor(k / 4) * 0.2); }
      box(1.6, 1.3, 0.5, '#5d6a6f', 0.6, 0, 1.5);
    } else if (e.id === 'estufa') {
      for (let k = 0; k < n + 1; k++) {
        const z = -1.6 + k * 1.1; box(3.6, 0.35, 0.7, '#6b4a2b', 0, 0, z);
        for (let j = 0; j < 6; j++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), mat(pick(['#4a8a3a', '#5aa04a', '#3f7a30']))); p.position.set(-1.5 + j * 0.6, 0.5, z); g.add(p); }
      }
      const vid = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2, 4.4), new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.12, depthWrite: false })); vid.position.y = 1; g.add(vid);
    } else if (e.id === 'curral') {
      for (const [x, z, w, d] of [[0, -2, 4.4, 0.1], [0, 2, 4.4, 0.1], [-2.2, 0, 0.1, 4], [2.2, 0, 0.1, 4]]) box(w, 0.6, d, '#7a5a32', x, 0, z);
      for (let k = 0; k < n * 2; k++) g.add(this.animal(k % 2 ? 'galinha' : 'vaca', rand(-1.5, 1.5), rand(-1.4, 1.4)));
    }
  }
  animal(tipo, x, z) {
    const a = new THREE.Group(); a.position.set(x, 0, z); a.rotation.y = rand(0, 6.28);
    if (tipo === 'vaca') {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.9), mat('#eee')); c.position.y = 0.5; a.add(c);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat('#eee')); m.position.set(0, 0.7, 0.55); a.add(m);
      const mancha = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.3), mat('#222')); mancha.position.set(0, 0.6, -0.1); a.add(mancha);
      for (const [lx, lz] of [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mat('#ddd')); l.position.set(lx, 0.15, lz); a.add(l); }
    } else {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat('#f4f0e0')); c.position.y = 0.2; a.add(c);
      const cr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), mat('#d33')); cr.position.set(0, 0.38, 0.06); a.add(cr);
    }
    return a;
  }
  montarSobreviventes() {
    this.svs.forEach(s => this.scene.remove(s.model.group)); this.svs = [];
    for (const sv of S.sobreviventes) {
      const m = makeChibi({ skin: sv.skin, shirt: sv.shirt, hair: sv.hair });
      const e = EST.find(x => x.id === (sv.posto || 'alojamento'));
      const home = { x: e.x, z: e.z + (sv.posto ? 0 : 1.2) };
      const pos = new THREE.Vector3(home.x + rand(-1.2, 1.2), 0, home.z + rand(-1, 1));
      const lb = makeLabel(`${PROFISSOES[sv.prof].ic} ${sv.nome}`, { h: 0.4 }); lb.position.y = 1.55; m.group.add(lb);
      this.scene.add(m.group); this.svs.push({ sv, model: m, pos, home, alvo: null, t: rand(0, 3) });
    }
  }
  montarHUD() {
    document.getElementById('hudTL').innerHTML = `<div class="row" style="gap:6px"><div class="chip money" id="bMoney"></div><div class="chip" id="bEst"></div><div class="chip" id="bSv"></div></div>`;
    document.getElementById('hudTC').innerHTML = `<div class="chip" id="bDica" style="font-size:12px"></div>`;
    document.getElementById('hudTR').innerHTML = `<button class="cbtn pe" id="bMenu" style="width:46px;height:46px;font-size:18px">⚙️</button>`;
    document.getElementById('hudBR').innerHTML = `<span></span><button class="cbtn big pe off" id="bAcao"><span id="bAcaoT">—</span></button>`;
    const tap = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap(document.getElementById('bAcao'), () => this.interagir());
    tap(document.getElementById('bMenu'), () => this.menu());
    this.keyH = e => { if (ui.isOpen()) return; if (e.code === 'KeyE' || e.code === 'Space') this.interagir(); };
    window.addEventListener('keydown', this.keyH);
    this.hud();
  }
  hud() {
    document.getElementById('bMoney').textContent = `$ ${S.dinheiro}`;
    document.getElementById('bEst').textContent = `🗄️ ${usoEstoque()}/${capEstoque()}`;
    document.getElementById('bSv').textContent = `👥 ${S.sobreviventes.length}`;
    let dica = 'Vá até a 🗺️ Mesa de Guerra para escolher uma missão';
    if (!S.estruturas.oficina && S.expedicoes > 0) dica = 'Venda o loot no 💰 Mercado e construa a 🛠️ Oficina';
    document.getElementById('bDica').textContent = dica;
  }
  estProxima() {
    const p = this.player.pos; let best = null, bd = 2.8;
    for (const e of EST) { const d = Math.hypot(p.x - e.x, p.z - (e.id === 'mercado' ? 3.4 : e.z)); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  update(dt) {
    const inp = readInput(), p = this.player;
    if (inp.active) { moveCircle(p.pos, inp.mx * 4 * dt, inp.mz * 4 * dt, 0.3, (x, y) => this.grid.get(x, y) !== 0); p.face = Math.atan2(inp.mx, inp.mz); }
    this.pm.group.position.copy(p.pos); this.pm.group.rotation.y = p.face; animChibi(this.pm, dt, inp.active ? 1 : 0);
    camFollow(p.pos.x, p.pos.z, dt);
    animChibi(this.comerciante, dt * 0.3, 0);
    for (const s of this.svs) {
      s.t -= dt;
      if (s.t <= 0) { s.alvo = { x: s.home.x + rand(-1.6, 1.6), z: s.home.z + rand(-1.3, 1.3) }; s.t = rand(2, 5); }
      let mov = 0;
      if (s.alvo) { const dx = s.alvo.x - s.pos.x, dz = s.alvo.z - s.pos.z, d = Math.hypot(dx, dz); if (d > 0.1) { moveCircle(s.pos, dx / d * 1.2 * dt, dz / d * 1.2 * dt, 0.25, (x, y) => this.grid.get(x, y) !== 0); s.model.group.rotation.y = Math.atan2(dx, dz); mov = 0.5; } else s.alvo = null; }
      s.model.group.position.copy(s.pos); animChibi(s.model, dt, mov);
    }
    const e = this.estProxima();
    const t = e ? `Abrir<br>${e.ic}` : '—';
    if (t !== this._t) { document.getElementById('bAcaoT').innerHTML = t; this._t = t; document.getElementById('bAcao').classList.toggle('off', !e); }
    this.tick = (this.tick || 0) - dt;
    if (this.tick <= 0) {
      this.tick = 2; tickProducao();
      for (const id in this.pendMk) this.pendMk[id].visible = Object.values(S.pend[id] || {}).some(v => v >= 1);
      this.hud();
    }
    for (const id in this.pendMk) if (this.pendMk[id].visible) { this.pendMk[id].rotation.y += dt * 2; this.pendMk[id].position.y = 2.9 + Math.sin(performance.now() / 300) * 0.1; }
  }
  depois() { salvar(); this.refazTudo(); this.hud(); this.tick = 0; }

  // ================= PAINÉIS =================
  interagir() {
    const e = this.estProxima(); if (!e) return; sfx('ok');
    tickProducao();
    if (e.id === 'mesa') this.painelMesa();
    else if (e.id === 'mercado') this.painelMercado('vender');
    else if (e.id === 'alojamento') this.painelAlojamento();
    else if (e.id === 'estoque') this.painelEstoque();
    else this.painelEstrutura(e.id);
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
    if (a === 0) return true;
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
      voltar: () => this.painelMesa(),
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
  painelEstoque() {
    const ks = Object.keys(S.estoque).filter(k => S.estoque[k] > 0);
    ui.openPanel({ title: `🗄️ Estoque ${usoEstoque()}/${capEstoque()}`, body: (ks.length ? `<div class="grid">${ks.map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}</b>${S.estoque[k]}</div>`).join('')}</div>` : '<p class="muted">Vazio.</p>') + `<h4>Armas</h4><div class="grid">${Object.keys(S.armas).map(w => `<div class="it">🔫<b>${ARMAS[w].nome}</b>T${S.armas[w]}</div>`).join('')}</div><p class="muted">Construa e evolua o 📦 Paiol para guardar mais. O que não couber ao voltar de uma expedição é vendido pela metade do preço.</p>` });
  }
  painelAlojamento() {
    const render = () => {
      let h = '';
      if (!S.sobreviventes.length) h = `<p class="muted">Ninguém aqui ainda. Durante as expedições, procure pessoas presas (🆘), resgate-as e chegue vivo à evacuação.</p>`;
      else h = `<p class="muted">Coloque cada pessoa numa estrutura construída. Fora da especialidade ela trabalha (+50% de produção), mas o bônus da profissão fica desligado.</p><div class="grid">${S.sobreviventes.map(sv => this.cardSv(sv)).join('')}</div>`;
      ui.setBody(h);
    };
    ui.openPanel({ title: '🛏️ Alojamento', body: '', on: { posto: el => { this.atribuir(+el.dataset.id, el.value); render(); } } });
    render();
  }
  cardSv(sv) {
    const P = PROFISSOES[sv.prof];
    const ops = Object.keys(ESTRUTURAS).filter(k => S.estruturas[k] > 0);
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
      if (n < E.max) { const c = CUSTO_ESTRUTURA[id][n]; h += `<div class="row"><b>${n ? `Evoluir para Nv.${n + 1}` : 'Construir'}:</b> ${custoTxt(c)} <button class="sb" data-a="up" ${temCusto(c) ? '' : 'disabled'}>${n ? 'Evoluir' : 'Construir'}</button></div>`; }
      else h += `<p><b>Nível máximo</b></p>`;
      if (n) {
        const tx = taxas()[id];
        if (id === 'paiol') h += `<p>Capacidade do estoque: <b>${capEstoque()}</b></p>`;
        if (tx) {
          const pend = S.pend[id] || {};
          h += `<h4>Produção</h4><div class="grid">${Object.keys(tx).map(k => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}<br><span class="muted">${(tx[k] * 60).toFixed(0)}/hora · guarda até ${capPend(id)}</span></b>${Math.floor(pend[k] || 0)}</div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="sb" data-a="col">Coletar</button></div>`;
        } else if (id !== 'paiol') h += `<p class="muted">Sem produção agora${id === 'oficina' ? ' (coloque um Fabricante aqui para produzir munição e sucata)' : ''}.</p>`;
        const ws = trabalhadores(id);
        h += `<h4>Trabalhadores ${ws.length}/2</h4>`;
        h += ws.length ? `<div class="grid">${ws.map(sv => `<div class="it">${PROFISSOES[sv.prof].ic}<b>${sv.nome}<br><span class="muted">${bonusAtivo(sv) ? '★ ' + PROFISSOES[sv.prof].base : 'fora da especialidade'}</span></b><button class="sb g" data-a="tirar" data-id="${sv.id}">Tirar</button></div>`).join('')}</div>` : '';
        const livres = S.sobreviventes.filter(s => s.posto !== id);
        if (ws.length < 2 && livres.length) h += `<div class="row" style="margin-top:6px"><select data-c="por"><option value="">+ Colocar alguém…</option>${livres.map(s => `<option value="${s.id}">${s.nome} — ${nomeProf(s.prof)}${PROFISSOES[s.prof].posto === id ? ' ★' : ''}${s.posto ? ` (em ${ESTRUTURAS[s.posto].nome})` : ''}</option>`).join('')}</select></div>`;
        if (!S.sobreviventes.length) h += `<p class="muted">Resgate sobreviventes nas expedições para trabalharem aqui.</p>`;
        if (id === 'oficina') h += this.htmlOficina();
      }
      ui.setBody(h);
    };
    ui.openPanel({ title: `${E.ic} ${E.nome}${S.estruturas[id] ? ' Nv.' + S.estruturas[id] : ''}`, body: '', on: {
      up: () => { const c = CUSTO_ESTRUTURA[id][S.estruturas[id]]; if (!temCusto(c)) return; tickProducao(); pagar(c); S.estruturas[id]++; sfx('ok'); toast(`${E.ic} ${E.nome} Nv.${S.estruturas[id]}!`); this.depois(); this.painelEstrutura(id); },
      col: () => { const r = coletar(id); const t = Object.entries(r.got).map(([k, v]) => ITENS[k].ic + v).join(' '); toast(t ? `Coletou ${t}` : 'Nada para coletar ainda'); if (r.vendido) toast(`Estoque cheio: vendeu o excesso por $${r.vendido}`); sfx('ok'); this.depois(); render(); },
      tirar: b => { this.atribuir(+b.dataset.id, null); render(); },
      por: el => { if (el.value) { this.atribuir(+el.value, id); render(); } },
      fab: b => { const w = b.dataset.k, c = FABRICAR[w]; if (!temCusto(c)) return; pagar(c); S.armas[w] = 1; sfx('ok'); toast(`🔫 ${ARMAS[w].nome} fabricada!`); this.depois(); render(); },
      tier: b => { const w = b.dataset.k, c = custoTier(S.armas[w]); if (!temCusto(c)) return; pagar(c); S.armas[w]++; sfx('ok'); toast(`${ARMAS[w].nome} agora é T${S.armas[w]}`); this.depois(); render(); },
      moch: () => { const c = custoMochila(S.mochila); if (!temCusto(c)) return; pagar(c); S.mochila++; sfx('ok'); toast(`🎒 Mochila agora leva ${capMochila()}`); this.depois(); render(); },
    } });
    render();
  }
  htmlOficina() {
    const n = S.estruturas.oficina, maxT = Math.min(4, n + 1);
    let h = `<h4>Fabricar armas</h4><div class="grid">`;
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
  dispose() { window.removeEventListener('keydown', this.keyH); }
}
