import { renderer, camera, initAudio, resetInput, toast, disposeScene, sfx } from './engine.js';
import { S, carregar, salvar, resetar, temSave, addEstoque, tickProducao, usarSaveTeste, novoEstadoTeste } from './state.js';
import { carregarModelos } from './models.js';
import { Galeria } from './galeria.js';
import { ITENS, BALAS_POR_PENTE, PROFISSOES } from './data.js';
import { Base } from './base.js';
import { Expedition } from './expedition.js';
import * as ui from './ui.js';

const game = {
  modo: null,
  irBase() {
    this.trocar(() => new Base(this));
  },
  abrirGaleria() {
    this.trocar(() => new Galeria(this));
  },
  iniciarExpedicao(cfg) {
    this.trocar(() => new Expedition(cfg, r => setTimeout(() => this.fimExpedicao(r), 600)));
  },
  trocar(m) {
    if (this.modo) { this.modo.dispose?.(); disposeScene(this.modo.scene); }
    resetInput();
    document.getElementById('hudTL').innerHTML = document.getElementById('hudTC').innerHTML = document.getElementById('hudTR').innerHTML = document.getElementById('hudBR').innerHTML = '';
    this.modo = null;
    this.modo = m();
  },
  fimExpedicao(r) {
    tickProducao();
    S.expedicoes++;
    // sobreviventes mortos são perdidos para sempre
    const mortos = S.sobreviventes.filter(s => r.mortos.includes(s.id));
    S.sobreviventes = S.sobreviventes.filter(s => !r.mortos.includes(s.id));
    let h = '';
    if (r.ok) {
      const ganhos = { ...r.mochila };
      const pentes = Math.round(r.balas / BALAS_POR_PENTE); if (pentes) ganhos.municao = (ganhos.municao || 0) + pentes;
      const vendido = addEstoque(ganhos);
      S.dinheiro += r.dinheiro;
      S.extraidos[`${r.cfg.area}-${r.cfg.loc}`] = true;
      for (const sv of r.resgatados) { sv.id = S.nextId++; S.sobreviventes.push(sv); }
      const lista = Object.entries(ganhos).filter(([, v]) => v > 0).map(([k, v]) => `<div class="it">${ITENS[k].ic}<b>${ITENS[k].nome}</b>${v}</div>`).join('');
      h += `<p style="font-size:18px">✅ Você escapou de <b>${r.local.nome}</b>!</p><p>Prêmio da missão: <span class="money">$${r.dinheiro}</span></p>`;
      h += `<h4>Trouxe na mochila</h4>${lista ? `<div class="grid">${lista}</div>` : '<p class="muted">Nada.</p>'}`;
      if (vendido) h += `<p class="muted">O estoque lotou: o excesso foi vendido por $${vendido}. Evolua o Paiol.</p>`;
      if (r.resgatados.length) h += `<h4>Novos sobreviventes no QG</h4>${r.resgatados.map(sv => `<p>🆘 <b>${sv.nome}</b> — ${PROFISSOES[sv.prof].ic} ${PROFISSOES[sv.prof].nome}. Coloque no Alojamento para trabalhar.</p>`).join('')}`;
    } else {
      h += `<p style="font-size:18px">❌ Missão fracassada</p><p class="muted">${r.motivo || ''}</p><p>Tudo o que estava na mochila (inclusive o que você levou) foi perdido.</p>`;
    }
    if (mortos.length) h += `<h4>Perdas permanentes</h4>${mortos.map(s => `<p>💀 ${s.nome} (${PROFISSOES[s.prof].nome})</p>`).join('')}`;
    salvar();
    this.irBase();
    ui.openPanel({ title: r.ok ? 'Extração concluída' : 'Fim da expedição', body: h, foot: `<button class="sb" data-a="fechar">Voltar ao QG</button>`, on: { fechar: () => ui.closePanel() } });
    sfx(r.ok ? 'ok' : 'morte');
  },
};

// tela inicial
const title = document.getElementById('title');
document.getElementById('bPlay').textContent = temSave() ? 'Continuar' : 'Jogar';
const comecar = (novo, teste) => {
  initAudio();
  usarSaveTeste(!!teste);
  if (teste) { if (!carregar() || !S.teste) { novoEstadoTeste(); salvar(); } }
  else if (novo) resetar(); else carregar();
  title.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  try { const d = document.documentElement; if (d.requestFullscreen && matchMedia('(pointer:coarse)').matches) d.requestFullscreen().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (_) {}
  game.irBase();
  if (S.teste) toast('🧪 Modo teste: toque no 🧪 no canto para as ferramentas');
  else if (S.expedicoes === 0) ui.openPanel({
    title: '🧟 Bem-vindo ao QG',
    body: `<p>O mundo acabou. Este abrigo é o que restou.</p><p>1. Vá até a <b>🗺️ Mesa de Guerra</b> e escolha um local.</p><p>2. Lá dentro, use <b>tábuas</b> para barricar portas e janelas antes da horda, saqueie as caixas ✨ e conserte o gerador.</p><p>3. Sobreviva às hordas e chegue ao ponto <b>H</b> para ser evacuado com o loot.</p><p>4. De volta ao QG, venda, construa e evolua a base.</p><p class="muted">Ande tocando e arrastando na metade esquerda da tela. A mira é automática.</p>`,
    foot: `<button class="sb" data-a="fechar">Bora</button>`, on: { fechar: () => ui.closePanel() },
  });
};
document.getElementById('bPlay').onclick = () => comecar(false);
document.getElementById('bTeste').onclick = () => comecar(false, true);
// carrega os personagens 3D antes de liberar os botões
const btns = ['bPlay', 'bNew', 'bTeste'].map(id => document.getElementById(id));
btns.forEach(b => b.disabled = true);
const carregando = document.getElementById('carregando');
carregarModelos(f => { carregando.textContent = `Carregando personagens… ${Math.round(f * 100)}%`; })
  .finally(() => { btns.forEach(b => b.disabled = false); carregando.textContent = ''; });
document.getElementById('bNew').onclick = e => {
  const b = e.currentTarget;
  if (!temSave() || b.dataset.ok) comecar(true);
  else { b.dataset.ok = 1; b.textContent = 'Apagar progresso e começar?'; }
};
if (!temSave()) document.getElementById('bNew').classList.add('hidden');

// loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const m = game.modo;
  if (!m) return;
  if (!ui.isOpen()) m.update(dt);
  renderer.render(m.scene, camera);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (document.hidden && game.modo) salvar(); });
window.__game = game;
