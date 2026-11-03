// Personagens 3D animados (arquivos .glb convertidos dos FBX do Mixamo)
import { THREE, animChibi } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const MODELOS = {
  protagonista: {
    url: './assets/protagonista.glb', altura: 1.35,
    estados: { idle: 'parado', walk: 'andando', run: 'correndo' },
  },
  zumbi_militar: {
    url: './assets/zumbi_militar.glb', altura: 1.4,
    estados: { idle: 'andando', walk: 'andando', run: 'andando', atk: ['ataque_1', 'ataque_2', 'mordendo_em_pe'], morte: ['morrendo_1', 'morrendo_2'] },
  },
};
// nomes amigáveis para a galeria
export const NOMES_ANIM = {
  parado: 'Parado', parado2: 'Parado (olhando)', andando: 'Andando', correndo: 'Correndo',
  ataque_1: 'Ataque 1', ataque_2: 'Ataque 2', gritando: 'Gritando', morrendo_1: 'Morrendo 1', morrendo_2: 'Morrendo 2',
  rastejando: 'Rastejando', mordendo_em_pe: 'Mordendo em pé', mordendo_chao: 'Mordendo no chão', comendo_chao: 'Comendo no chão',
};

const cache = {};
const shadowGeo = new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

export async function carregarModelos(onProg) {
  const L = new GLTFLoader();
  const prog = {};
  const total = () => { const v = Object.values(prog); return v.reduce((a, b) => a + b, 0) / Object.keys(MODELOS).length; };
  await Promise.all(Object.entries(MODELOS).map(async ([k, d]) => {
    try {
      let g;
      try { g = await L.loadAsync(d.url, e => { if (e.total) { prog[k] = e.loaded / e.total; onProg && onProg(total()); } }); }
      catch (err) {
        // alternativa: o mesmo .glb embutido num arquivo .js (usado na versão publicada no Claude)
        const mod = await import(new URL(d.url + '.js', document.baseURI).href);
        const bin = Uint8Array.from(atob(mod.default), c => c.charCodeAt(0));
        g = await L.parseAsync(bin.buffer, './assets/');
      }
      prog[k] = 1; onProg && onProg(total());
      // material leve (Lambert) para rodar bem no celular
      g.scene.traverse(o => {
        if (o.isMesh) {
          const map = o.material.map;
          o.material = new THREE.MeshLambertMaterial({ map });
          o.frustumCulled = false;
          o.userData.manter = true;
        }
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      const h = box.getSize(new THREE.Vector3()).y;
      cache[k] = { scene: g.scene, clips: g.animations, escala: d.altura / h, minY: box.min.y, def: d };
    } catch (e) { console.warn('Falha ao carregar', k, e); }
  }));
}
export const modeloPronto = k => !!cache[k];
export const clipsDe = k => cache[k] ? cache[k].clips.map(c => c.name) : [];

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
  mixer.addEventListener('finished', e => { if (e.action === m.cur && !m.travar) m.lock = 0; });
  if (opts.arma) {
    // arminha simples presa na mão direita
    const mao = obj.getObjectByName('mixamorigRightHand');
    if (mao) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.32), new THREE.MeshLambertMaterial({ color: '#222' }));
      gun.scale.setScalar(1 / s); gun.position.set(0, 0.08 / s, 0.06 / s); gun.rotation.x = Math.PI / 2;
      mao.add(gun); m.gun = gun;
    }
  }
  play(m, m.estados.idle);
  return m;
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
  if (m.cur && o.fade !== 0) { a.fadeIn(o.fade ?? 0.2); m.cur.fadeOut(o.fade ?? 0.2); } else if (m.cur) m.cur.stop();
  a.play();
  m.cur = a; m.curName = name;
  if (o.once) { m.lock = 1; m.travar = !!o.travar; }
  return a.getClip().duration / (o.speed ?? 1);
}
// substitui animChibi: escolhe parado/andando/correndo pela velocidade
export function animar(m, dt, speed, opts = {}) {
  if (!m.animado) { animChibi(m, dt, speed); return; }
  if (!m.lock) {
    const e = m.estados;
    if (opts.atacando && e.atk) play(m, m.atkClip || (m.atkClip = Array.isArray(e.atk) ? e.atk[Math.floor(Math.random() * e.atk.length)] : e.atk), { speed: 1.5 });
    else if (speed < 0.08) play(m, e.idle, { speed: opts.idleSpeed ?? 1 });
    else if (speed < (opts.runAt ?? 0.62)) play(m, e.walk, { speed: opts.walkSpeed ?? Math.max(0.5, speed * 1.4) });
    else play(m, e.run, { speed: opts.runSpeed ?? 1 });
  }
  m.mixer.update(dt);
}
