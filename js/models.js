// Personagens, armas e itens 3D (.glb convertidos dos FBX) + sons dos zumbis
import { THREE, animChibi } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- Personagens animados ----------
export const MODELOS = {
  protagonista: {
    url: './assets/protagonista.glb', altura: 1.35,
    estados: { idle: 'parado', walk: 'andando', run: 'correndo' },
  },
  zumbi_militar: {
    url: './assets/zumbi_militar.glb', altura: 1.4,
    estados: { idle: 'andando', walk: 'andando', run: 'andando', atk: ['ataque_1', 'ataque_2', 'mordendo_em_pe'], morte: ['morrendo_1', 'morrendo_2'] },
  },
  militar_vivo: {
    url: './assets/militar_vivo.glb', altura: 1.38,
    estados: { idle: 'parado', walk: 'andando', run: 'correndo' },
  },
};
// ---------- Objetos (armas e munição) ----------
// tam = comprimento no jogo; pega = onde a mão segura (0 = traseira, 1 = cano)
export const OBJETOS = {
  arma_pistola:     { url: './assets/armas/pistola.glb', rx: -Math.PI / 2, tam: 0.32, pega: 0.25 },
  arma_escopeta:    { url: './assets/armas/escopeta.glb', rx: -Math.PI / 2, tam: 0.95, pega: 0.38 },
  arma_fuzil:       { url: './assets/armas/fuzil.glb', rx: -Math.PI / 2, tam: 0.9, pega: 0.42 },
  arma_lancachamas: { url: './assets/armas/lancachamas.glb', tam: 0.9, pega: 0.4 },
  bala_9mm:         { url: './assets/itens/bala_9mm.glb', tam: 0.32 },
  bala_rifle:       { url: './assets/itens/bala_rifle.glb', tam: 0.36 },
  bala_escopeta:    { url: './assets/itens/bala_escopeta.glb', tam: 0.4 },
  bala_sniper:      { url: './assets/itens/bala_sniper.glb', tam: 0.36 },
};
// arma do jogo -> modelo 3D, conjunto de animações e munição que cai dos zumbis
export const ARMA_3D = {
  pistola:     { obj: 'arma_pistola', anim: 'pistola', bala: 'bala_9mm' },
  escopeta:    { obj: 'arma_escopeta', anim: 'escopeta', bala: 'bala_escopeta' },
  fuzil:       { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_rifle' },
  smg:         { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_rifle', esc: 0.82 },
  cacadora:    { obj: 'arma_fuzil', anim: 'rifle', bala: 'bala_sniper', esc: 1.08 },
  lancachamas: { obj: 'arma_lancachamas', anim: 'rifle', bala: null },
  faca:        { obj: null, anim: 'pistola' },
};
export const ANIM_ARMA = {
  pistola:  { idle: 'pistola_parado', walk: 'pistola_andando', run: 'pistola_correndo', walkBack: 'pistola_andando_tras', runBack: 'pistola_correndo_tras', tiro: 'atirando_pistola' },
  rifle:    { idle: 'rifle_parado', walk: 'rifle_andando', run: 'rifle_correndo', tiro: 'atirando_rifle', recarga: 'recarregando' },
  escopeta: { idle: 'escopeta_parado', walk: 'rifle_andando', run: 'rifle_correndo', tiro: 'atirando_escopeta', recarga: 'recarregando' },
};
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
  recrutando: 'Recrutando sobrevivente', andando_frente_arma: 'Andando (arma à frente)', atirando: 'Atirando', triste: 'Parado (triste)',
};
// arma que aparece na mão em cada animação da galeria
export function armaDaAnim(n) {
  if (/pistola/.test(n)) return 'pistola';
  if (/escopeta/.test(n)) return 'escopeta';
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
        const box = new THREE.Box3().setFromObject(g.scene, true);
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
  const group = new THREE.Group(), inner = new THREE.Group();
  inner.add(obj); group.add(inner);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.y = 0.02; sh.scale.setScalar(opts.scale || 1); group.add(sh);
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const clip of c.clips) actions[clip.name] = mixer.clipAction(clip);
  const m = { group, inner, obj, mixer, actions, estados: { ...c.def.estados, ...(opts.estados || {}) }, cur: null, curName: '', lock: 0, t: 0, aim: false, animado: true, escala: s };
  m.mao = obj.getObjectByName('mixamorigRightHand');
  mixer.addEventListener('finished', e => { if (e.action === m.cur && !m.travar) m.lock = 0; });
  if (opts.arma) segurarArma(m, opts.arma);
  play(m, m.estados.idle);
  return m;
}
// coloca a arma 3D na mão (a posição segue a mão; a direção segue o personagem)
export function segurarArma(m, armaId) {
  if (m.arma) { m.inner.remove(m.arma); m.arma = null; }
  m.armaId = armaId;
  const info = ARMA_3D[armaId];
  if (!info || !info.obj || !cacheObj[info.obj]) return;
  const a = criarObjeto(info.obj);
  if (info.esc) a.scale.setScalar(info.esc);
  m.inner.add(a); m.arma = a;
}
const _v = new THREE.Vector3();
function posicionarArma(m) {
  if (!m.arma || !m.mao) return;
  m.arma.visible = !m.esconderArma;
  if (!m.arma.visible) return;
  m.obj.updateMatrixWorld(true);
  m.mao.getWorldPosition(_v); m.inner.worldToLocal(_v);
  m.arma.position.copy(_v);
  m.arma.rotation.set(0, 0, 0);
}
// toca uma animação; once = toca uma vez e para no último quadro
export function play(m, name, o = {}) {
  if (Array.isArray(name)) name = name[Math.floor(Math.random() * name.length)];
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
// militar usa o modelo 3D do militar vivo; as outras profissões ainda usam o boneco simples
export function criarSobrevivente(sv, opts = {}) {
  if (sv.prof === 'militar' && modeloPronto('militar_vivo')) {
    return criarAnimado('militar_vivo', { arma: opts.armado ? 'fuzil' : null, estados: opts.armado ? ESTADOS_MILITAR_ARMADO : (opts.preso ? { idle: 'triste' } : {}) });
  }
  const m = makeChibi({ skin: sv.skin, shirt: sv.shirt, hair: sv.hair, gun: !!opts.armado });
  if (opts.preso) m.arms.forEach(a => a.rotation.x = -2.6);
  return m;
}
