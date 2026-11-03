// Galeria (modo teste): mostra cada personagem 3D e toca cada animação
import { THREE, VIEW, resize, camera, mat } from './engine.js';
import { MODELOS, NOMES_ANIM, modeloPronto, criarAnimado, clipsDe, play, animar, segurarArma, armaDaAnim } from './models.js';

export class Galeria {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b201c');
    this.scene.add(new THREE.HemisphereLight('#fff1d6', '#3a3226', 2.2));
    const sun = new THREE.DirectionalLight('#ffe0b0', 1.4); sun.position.set(8, 20, 14); this.scene.add(sun);
    const chao = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), mat('#3a4236')); this.scene.add(chao);
    VIEW.size = 1.45; resize();
    // câmera olha um pouco acima do chão
    this.camY = 0.7;
    this.lista = Object.keys(MODELOS).filter(modeloPronto);
    this.idx = 0; this.girar = true; this.velo = 1;
    this.montarHUD();
    this.mostrar(this.lista[0]);
  }
  mostrar(k) {
    if (this.m) this.scene.remove(this.m.group);
    this.k = k;
    this.m = criarAnimado(k);
    this.m.lock = 1; // a galeria controla as animações
    this.scene.add(this.m.group);
    this.anim = clipsDe(k)[0];
    this.tocar(this.anim);
    this.render();
  }
  tocar(n) { this.anim = n; if (this.k !== 'zumbi_militar') segurarArma(this.m, armaDaAnim(n)); this.m.lock = 0; play(this.m, n, { restart: true, fade: 0.15, speed: this.velo }); this.m.lock = 1; this.render(); }
  montarHUD() {
    document.getElementById('hudTL').innerHTML = `<div class="chip">🎬 Galeria de animações</div>`;
    document.getElementById('hudTR').innerHTML = `<button class="sb pe" id="gVoltar">← Voltar ao QG</button>`;
    document.getElementById('gVoltar').onclick = () => this.game.irBase();
    const br = document.getElementById('hudBR');
    br.style.cssText = 'left:10px;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;align-items:stretch';
    this.br = br;
    br.addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const v = b.dataset.v;
      if (b.dataset.g === 'mod') this.mostrar(v);
      if (b.dataset.g === 'anim') this.tocar(v);
      if (b.dataset.g === 'girar') { this.girar = !this.girar; this.render(); }
      if (b.dataset.g === 'velo') { this.velo = +v; this.tocar(this.anim); }
    });
  }
  render() {
    const nomes = { protagonista: '🧍 Protagonista', protagonista_arma: '🔫 Protagonista com fuzil', zumbi_militar: '🧟 Zumbi militar', militar_vivo: '🎖️ Militar (sobrevivente)' };
    this.br.innerHTML = `
      <div class="row pe" style="justify-content:center">${this.lista.map(k => `<button class="sb ${k === this.k ? '' : 'g'}" data-g="mod" data-v="${k}">${nomes[k] || k}</button>`).join('')}
        <button class="sb g" data-g="girar">${this.girar ? '⏸ Parar giro' : '🔄 Girar'}</button>
        ${[0.5, 1].map(v => `<button class="sb ${this.velo === v ? '' : 'g'}" data-g="velo" data-v="${v}">${v === 1 ? 'Normal' : 'Câmera lenta'}</button>`).join('')}</div>
      <div class="pe" style="display:flex;gap:6px;overflow-x:auto;white-space:nowrap;padding-bottom:4px;touch-action:pan-x">${clipsDe(this.k).map(n => `<button class="sb ${n === this.anim ? '' : 'g'}" style="flex:none" data-g="anim" data-v="${n}">${NOMES_ANIM[n] || n}</button>`).join('')}</div>`;
  }
  update(dt) {
    if (this.girar) this.m.group.rotation.y += dt * 0.6;
    animar(this.m, dt, 0);
    // câmera mais baixa, de frente, para ver bem o personagem
    camera.position.set(7, 3.2, 7); camera.lookAt(0, 0.62, 0);
  }
  dispose() { this.br.style.cssText = ''; VIEW.size = 6.5; resize(); }
}
