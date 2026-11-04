// Personagens, armas e itens 3D (.glb convertidos dos FBX) + sons dos zumbis
import { THREE, animChibi } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- Personagens animados ----------
function EST_ZUMBI() { return { idle: 'parado', walk: 'andando', run: 'correndo', atk: ['ataque_1', 'ataque_2', 'mordendo_em_pe'], morte: ['morrendo_1', 'morrendo_2'], barricada: 'quebrando_barricada' }; }
function EST_SV() { return { idle: 'parado', walk: 'andando', run: 'correndo', morte: 'morrendo', falar: ['falando', 'falando_2'] }; }
export const MODELOS = {
  protagonista: {
    url: './assets/protagonista.glb', altura: 1.35,
    estados: { idle: 'parado', walk: 'andando', run: 'correndo' },
    alt: { fuzil: 'protagonista_arma', escopeta: 'protagonista_escopeta' },
  },
  // protagonista já modelado com o fuzil nas mãos (usado com fuzil/SMG/caçadora)
  protagonista_arma: {
    url: './assets/protagonista_arma.glb', altura: 1.35, giro: Math.PI + 0.40, // o arquivo olha para -Z; +0.40 alinha o cano com a mira
    estados: { idle: 'parado', walk: 'andando', run: 'correndo', tiro: 'atirando' },
  },
  zumbi_militar: {
    url: './assets/zumbi_militar.glb', altura: 1.4,
    estados: { idle: 'andando', walk: 'andando', run: 'andando', atk: ['ataque_1', 'ataque_2', 'mordendo_em_pe'], morte: ['morrendo_1', 'morrendo_2'] },
  },
  // zumbis novos (riggados no Blender com as animações da pasta zumbis/movimentação)
  zumbi_fazendeiro: { url: './assets/zumbi_fazendeiro.glb', altura: 1.4, estados: EST_ZUMBI() },
  zumbi_enfermeira: { url: './assets/zumbi_enfermeira.glb', altura: 1.35, estados: EST_ZUMBI() },
  zumbi_medico:     { url: './assets/zumbi_medico.glb', altura: 1.4, estados: EST_ZUMBI() },
  zumbi_policial:   { url: './assets/zumbi_policial.glb', altura: 1.4, estados: EST_ZUMBI() },
  // sobreviventes novos (animações da pasta sobreviventes/movimentação + andar/correr/morrer do protagonista)
  enfermeira: { url: './assets/sv_enfermeira.glb', altura: 1.3, estados: EST_SV() },
  botanico:   { url: './assets/sv_botanico.glb', altura: 1.32, estados: EST_SV() },
  mercador:   { url: './assets/sv_mercador.glb', altura: 1.32, estados: EST_SV() },
  // protagonista já modelado com a escopeta nas mãos
  protagonista_escopeta: {
    url: './assets/protagonista_escopeta.glb', altura: 1.35, giro: -0.24, // alinha o cano com a mira
    estados: { idle: 'parado', walk: 'andando', run: 'correndo', tiro: 'atirando' },
  },
  militar_vivo: {
    url: './assets/militar_vivo.glb', altura: 1.38,
    estados: { idle: 'parado', walk: 'andando', run: 'correndo' },
  },
};
// ---------- Objetos (armas e munição) ----------
// tam = comprimento no jogo; pega = onde a mão segura (0 = traseira, 1 = cano)
export const OBJETOS = {
  bala_9mm:         { url: './assets/itens/bala_9mm.glb', tam: 0.32 },
  bala_rifle:       { url: './assets/itens/bala_rifle.glb', tam: 0.36 },
  bala_escopeta:    { url: './assets/itens/bala_escopeta.glb', tam: 0.4 },
  bala_sniper:      { url: './assets/itens/bala_sniper.glb', tam: 0.36 },
};
// arma do jogo -> modelo 3D, conjunto de animações e munição que cai dos zumbis
export const ARMA_3D = {
  pistola:     { obj: 'arma_pistola', anim: 'pistola', bala: 'bala_9mm' },
  escopeta:    { obj: 'arma_escopeta', anim: 'escopeta', bala: 'bala_escopeta', alt: 'escopeta' },
  fuzil:       { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_rifle', alt: 'fuzil' },
  smg:         { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_rifle', esc: 0.82, alt: 'fuzil' },
  cacadora:    { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_sniper', esc: 1.08, alt: 'fuzil' },
  lancachamas: { obj: 'arma_lancachamas', anim: 'lanca', bala: null },
  faca:        { obj: null, anim: 'pistola' },
};
export const ANIM_ARMA = {
  pistola:  { idle: 'pistola_parado', walk: 'pistola_andando', run: 'pistola_correndo', walkBack: 'pistola_andando_tras', runBack: 'pistola_correndo_tras', tiro: 'atirando_pistola' },
  rifle:    { idle: 'rifle_parado', walk: 'rifle_andando', run: 'rifle_correndo', tiro: 'atirando_rifle', recarga: 'recarregando',
              walkTiro: 'rifle_andando_atirando', runTiro: 'rifle_correndo_atirando', walkBack: 'rifle_andando_tras', runBack: 'rifle_andando_tras', walkBackTiro: 'rifle_andando_tras_atirando' },
  escopeta: { idle: 'escopeta_parado', walk: 'escopeta_andando', run: 'escopeta_correndo', tiro: 'atirando_escopeta', recarga: 'recarregando',
              walkTiro: 'escopeta_andando_atirando', runTiro: 'escopeta_correndo_atirando', walkBack: 'escopeta_andando_tras', runBack: 'escopeta_andando_tras', walkBackTiro: 'escopeta_andando_tras_atirando' },
  lanca:    { idle: 'lanca_parado', walk: 'lanca_andando', run: 'lanca_correndo', tiro: 'lanca_atirando', recarga: 'recarregando' },
};
// animações do protagonista com o fuzil na mão (modelo alternativo) e o que usar quando ele não carregou
const ALT_CLIP = {};
const SEM_ALT = {};
for (const [pre, tiro] of [['rifle', 'atirando_rifle'], ['escopeta', 'atirando_escopeta']]) {
  Object.assign(ALT_CLIP, { [pre + '_parado']: 'parado', [pre + '_andando']: 'andando', [pre + '_correndo']: 'correndo', [tiro]: 'atirando',
    [pre + '_andando_atirando']: 'andando_atirando', [pre + '_correndo_atirando']: 'correndo_atirando', [pre + '_andando_tras']: 'andando_tras', [pre + '_andando_tras_atirando']: 'andando_tras_atirando' });
  Object.assign(SEM_ALT, { [pre + '_andando_atirando']: pre + '_andando', [pre + '_correndo_atirando']: pre + '_correndo', [pre + '_andando_tras']: pre + '_andando', [pre + '_andando_tras_atirando']: pre + '_andando' });
}
// nomes amigáveis para a galeria
export const NOMES_ANIM = {
  parado: 'Parado', parado2: 'Parado (olhando)', andando: 'Andando', correndo: 'Correndo',
  ataque_1: 'Ataque 1', ataque_2: 'Ataque 2', gritando: 'Gritando', morrendo_1: 'Morrendo 1', morrendo_2: 'Morrendo 2',
  rastejando: 'Rastejando', mordendo_em_pe: 'Mordendo em pé', mordendo_chao: 'Mordendo no chão', comendo_chao: 'Comendo no chão',
  pistola_parado: 'Pistola parado', pistola_andando: 'Pistola andando', pistola_correndo: 'Pistola correndo', pistola_andando_tras: 'Pistola andando de costas',
  pistola_correndo_tras: 'Pistola correndo de costas', pistola_mirando: 'Pistola mirando', atirando_pistola: 'Atirando (pistola)',
  rifle_parado: 'Fuzil parado', rifle_andando: 'Fuzil andando', rifle_correndo: 'Fuzil correndo', atirando_rifle: 'Atirando (fuzil)', recarregando: 'Recarregando',
  escopeta_parado: 'Escopeta parado', atirando_escopeta: 'Atirando (escopeta)', andando_arma: 'Andando com arma', morrendo: 'Morrendo',
  vasculhando: 'Vasculhando itens', vasculhando_bau: 'Vasculhando baú', abrindo_bau: 'Abrindo baú', fechando_bau: 'Fechando baú', pegando: 'Pegando algo',
  recrutando: 'Recrutando sobrevivente', escopeta_andando: 'Escopeta andando', escopeta_correndo: 'Escopeta correndo',
  lanca_parado: 'Lança-chamas parado', lanca_andando: 'Lança-chamas andando', lanca_correndo: 'Lança-chamas correndo', lanca_atirando: 'Lança-chamas atirando', andando_frente_arma: 'Andando (arma à frente)', atirando: 'Atirando', triste: 'Parado (triste)',
  andando_atirando: 'Andando e atirando', quebrando_barricada: 'Quebrando barricada', falando: 'Falando', falando_2: 'Falando 2', parado2: 'Parado 2', andando_tras: 'Andando de costas', andando_tras_atirando: 'De costas atirando', correndo_atirando: 'Correndo e atirando',
};
// arma que aparece na mão em cada animação da galeria
export function armaDaAnim(n) {
  if (/pistola/.test(n)) return 'pistola';
  if (/escopeta/.test(n)) return 'escopeta';
  if (/^lanca/.test(n)) return 'lancachamas';
  if (/rifle|recarreg|andando_arma|andando_frente_arma|^atirando$/.test(n)) return 'fuzil';
  return null;
}

// ---------- Carregamento ----------
// tenta o arquivo normal; se o servidor não entrega (versão publicada no Claude), usa a cópia em base64 dentro de um .js
export async function baixarBinario(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return await r.arrayBuffer();
  } catch (e) {
    const mod = await import(new URL(url + '.js', document.baseURI).href);
    return Uint8Array.from(atob(mod.default), c => c.charCodeAt(0)).buffer;
  }
}
const cache = {}, cacheObj = {};
const shadowGeo = new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
const leve = (root, manter) => root.traverse(o => {
  if (o.isMesh) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nm = mats.map(m => new THREE.MeshLambertMaterial({ map: m.map || null, color: m.map ? 0xffffff : m.color }));
    o.material = Array.isArray(o.material) ? nm : nm[0];
    o.frustumCulled = false; o.userData.manter = manter;
  }
});

export async function carregarModelos(onProg) {
  const L = new GLTFLoader();
  const tudo = [...Object.entries(MODELOS).map(([k, d]) => ['m', k, d]), ...Object.entries(OBJETOS).map(([k, d]) => ['o', k, d])];
  let feitos = 0;
  await Promise.all(tudo.map(async ([tipo, k, d]) => {
    try {
      const g = await L.parseAsync(await baixarBinario(d.url), './assets/');
      leve(g.scene, true);
      if (tipo === 'm') {
        // mede o personagem já na pose de "parado" (a pose de repouso do arquivo pode estar acima do chão)
        const idle = g.animations.find(c => c.name === d.estados.idle) || g.animations[0];
        if (idle) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(idle).play(); mx.update(0); g.scene.updateMatrixWorld(true); }
        const box = new THREE.Box3();
        g.scene.traverse(o => { if (o.isSkinnedMesh) box.expandByObject(o, true); });
        cache[k] = { scene: g.scene, clips: g.animations, escala: d.altura / box.getSize(new THREE.Vector3()).y, minY: box.min.y, def: d };
      } else {
        // centraliza: comprimento no eixo Z (cano para +Z) e a mão na origem
        // modelos do Tripo vêm deitados (Z para cima): rx endireita
        const o = new THREE.Group(); g.scene.rotation.x = d.rx || 0; o.add(g.scene); o.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(o); const sz = box.getSize(new THREE.Vector3());
        const wrap = new THREE.Group(), mid = new THREE.Group();
        const c = box.getCenter(new THREE.Vector3()); o.position.sub(c); mid.add(o);
        const maior = sz.x >= sz.z ? 'x' : 'z';
        if (maior === 'x') mid.rotation.y = -Math.PI / 2; // +X vira +Z
        const s = d.tam / Math.max(sz.x, sz.y, sz.z); mid.scale.setScalar(s);
        if (d.pega !== undefined) mid.position.z = (0.5 - d.pega) * d.tam;
        wrap.add(mid);
        cacheObj[k] = wrap;
      }
    } catch (e) { console.warn('Falha ao carregar', k, e); }
    feitos++; onProg && onProg(feitos / tudo.length);
  }));
  await carregarSons();
}
export const modeloPronto = k => !!cache[k];
export const objPronto = k => !!cacheObj[k];
export const clipsDe = k => cache[k] ? cache[k].clips.map(c => c.name) : [];
export function criarObjeto(k) { return cacheObj[k] ? cacheObj[k].clone(true) : null; }

export function criarAnimado(k, opts = {}) {
  const c = cache[k];
  const obj = SkeletonUtils.clone(c.scene);
  const s = c.escala * (opts.scale || 1);
  obj.scale.setScalar(s);
  obj.position.y = -c.minY * s;
  if (c.def.giro) obj.rotation.y = c.def.giro;
  const group = new THREE.Group(), inner = new THREE.Group();
  inner.add(obj); group.add(inner);
  if (!opts.semSombra) { const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.y = 0.02; sh.scale.setScalar(opts.scale || 1); group.add(sh); }
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const clip of c.clips) actions[clip.name] = mixer.clipAction(clip);
  const m = { group, inner, obj, mixer, actions, estados: { ...c.def.estados, ...(opts.estados || {}) }, cur: null, curName: '', lock: 0, t: 0, aim: false, animado: true, escala: s };
  m.mao = obj.getObjectByName('mixamorigRightHand');
  mixer.addEventListener('finished', e => { if (e.action === m.cur && !m.travar) m.lock = 0; });
  // modelo alternativo (protagonista com o fuzil): fica escondido dentro do mesmo grupo
  if (c.def.alt) {
    m.alts = {};
    for (const [tipo, k] of Object.entries(c.def.alt)) if (cache[k]) { const a = criarAnimado(k, { semSombra: true, scale: opts.scale }); a.group.visible = false; inner.add(a.group); m.alts[tipo] = a; }
  }
  segurarArma(m, opts.arma || null);
  play(m, m.estados.idle);
  return m;
}
// coloca a arma 3D na mão (a posição segue a mão; a direção segue o personagem)
export function segurarArma(m, armaId) {
  m.armaId = armaId;
  const info = ARMA_3D[armaId];
  const novo = (m.alts && info && info.alt && m.alts[info.alt]) || null;
  if (m.usandoAlt && m.alt !== novo) mostrarAlt(m, false);
  if (novo) m.alt = novo;
  m.altOn = !!novo;
  const alvo = info && info.obj;
  if (!m.armas) { m.armas = []; m.obj.traverse(o => { if (/^arma_/.test(o.name) && o.parent && !/^arma_/.test(o.parent.name)) m.armas.push(o); }); }
  m.arma = null;
  for (const a of m.armas) { const on = !!alvo && a.name.startsWith(alvo); a.visible = on; if (on) m.arma = a; }
}
const _v = new THREE.Vector3();
// a arma já vem presa ao osso da mão (Blender); aqui só esconde durante ações sem arma
function posicionarArma(m) { if (m.arma) m.arma.visible = !m.esconderArma; }
function mostrarAlt(m, on) { m.usandoAlt = on; m.alt.group.visible = on; m.obj.visible = !on; if (!on) { m.alt.mixer.stopAllAction(); m.alt.cur = null; } }
// toca uma animação; once = toca uma vez e para no último quadro
export function play(m, name, o = {}) {
  if (Array.isArray(name)) name = name[Math.floor(Math.random() * name.length)];
  if (m.alt) {
    const an = m.altOn && ALT_CLIP[name];
    if (an && m.alt.actions[an]) { if (!m.usandoAlt) { mostrarAlt(m, true); o = { ...o, fade: 0 }; } m.curName = name; return play(m.alt, an, o); }
    if (m.usandoAlt) { mostrarAlt(m, false); if (m.cur) m.cur.stop(); m.cur = null; }
  }
  if (!m.actions[name] && SEM_ALT[name]) name = SEM_ALT[name];
  const a = m.actions[name]; if (!a) return 0;
  if (m.cur === a && !o.restart) { a.timeScale = o.speed ?? 1; return a.getClip().duration; }
  a.reset();
  a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  a.clampWhenFinished = !!o.once;
  a.timeScale = o.speed ?? 1;
  a.setEffectiveWeight(1);
  if (m.cur && m.cur !== a && o.fade !== 0) { a.fadeIn(o.fade ?? 0.2); m.cur.fadeOut(o.fade ?? 0.2); } else if (m.cur && m.cur !== a) m.cur.stop();
  a.play();
  m.cur = a; m.curName = name;
  if (o.once) { m.lock = 1; m.travar = !!o.travar; }
  return a.getClip().duration / (o.speed ?? 1);
}
// escolhe parado/andando/correndo pela velocidade (ou uma animação forçada em opts.clip)
export function animar(m, dt, speed, opts = {}) {
  if (!m.animado) { animChibi(m, dt, speed); return; }
  if (!m.lock) {
    const e = opts.estados || m.estados;
    if (opts.clip) play(m, opts.clip, { speed: opts.clipSpeed ?? 1 });
    else if (opts.atacando && e.atk) play(m, m.atkClip || (m.atkClip = Array.isArray(e.atk) ? e.atk[Math.floor(Math.random() * e.atk.length)] : e.atk), { speed: 1.5 });
    else if (speed < 0.08) play(m, e.idle, { speed: opts.idleSpeed ?? 1 });
    else if (speed < (opts.runAt ?? 0.62)) play(m, e.walk, { speed: opts.walkSpeed ?? Math.max(0.5, speed * 1.4) });
    else play(m, e.run, { speed: opts.runSpeed ?? 1 });
  }
  m.mixer.update(dt);
  if (m.usandoAlt) m.alt.mixer.update(dt);
  posicionarArma(m);
}

// ---------- Sons dos zumbis (arquivos mp3) ----------
const SONS = { som: './assets/sons/zumbi_som.mp3', grito: './assets/sons/zumbi_grito.mp3', morte: './assets/sons/zumbi_morte.mp3' };
const bufs = {}; let actx = null, brutos = {};
async function carregarSons() {
  await Promise.all(Object.entries(SONS).map(async ([k, u]) => { try { brutos[k] = await baixarBinario(u); } catch (e) { console.warn('som', k, e); } }));
}
// precisa ser chamado depois de um toque do jogador (regra dos navegadores)
export async function iniciarSons(ctx) {
  actx = ctx; if (!actx) return;
  for (const k in brutos) { if (bufs[k]) continue; try { bufs[k] = await actx.decodeAudioData(brutos[k].slice(0)); } catch (e) { console.warn('decode', k, e); } }
}
const ultimo = {};
// toca um trecho do arquivo (cada arquivo tem uns 8 s de sons diferentes)
export function somZumbi(k, vol = 0.6, dur = 1.6, minGap = 0.3) {
  const b = bufs[k]; if (!actx || !b) return false;
  const now = actx.currentTime;
  if (ultimo[k] && now - ultimo[k] < minGap) return false;
  ultimo[k] = now;
  try {
    const src = actx.createBufferSource(); src.buffer = b;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const g = actx.createGain(); src.connect(g); g.connect(actx.destination);
    const maxOff = Math.max(0, Math.min(b.duration, k === 'grito' ? 6.3 : b.duration) - dur);
    const off = Math.random() * maxOff;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.05);
    g.gain.setValueAtTime(vol, now + dur - 0.25); g.gain.linearRampToValueAtTime(0, now + dur);
    src.start(now, off, dur + 0.05);
    return true;
  } catch (e) { return false; }
}

// ---------- Sobreviventes ----------
import { makeChibi } from './engine.js';
export const ESTADOS_MILITAR_ARMADO = { idle: 'rifle_parado', walk: 'andando_arma', run: 'andando_arma', tiro: 'atirando', morte: 'morrendo' };
// modelo 3D de cada profissão (o fabricante/mecânico ainda não tem modelo 3D)
export const MODELO_PROF = { militar: 'militar_vivo', enfermeiro: 'enfermeira', farmaceutico: 'enfermeira', agricultor: 'botanico' };
export function criarSobrevivente(sv, opts = {}) {
  if (sv.prof === 'militar' && modeloPronto('militar_vivo')) {
    return criarAnimado('militar_vivo', { arma: opts.armado ? 'fuzil' : null, estados: opts.armado ? ESTADOS_MILITAR_ARMADO : (opts.preso ? { idle: 'triste' } : {}) });
  }
  const k = MODELO_PROF[sv.prof];
  if (k && modeloPronto(k) && !opts.armado) return criarAnimado(k, { estados: opts.preso ? { idle: 'triste' } : {} });
  const m = makeChibi({ skin: sv.skin, shirt: sv.shirt, hair: sv.hair, gun: !!opts.armado });
  if (opts.preso) m.arms.forEach(a => a.rotation.x = -2.6);
  return m;
}
