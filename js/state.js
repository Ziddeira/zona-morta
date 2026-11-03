import { ITENS, ESTRUTURAS, PROFISSOES, NOMES, ESTOQUE_BASE, ESTOQUE_POR_PAIOL, MOCHILA_BASE, MOCHILA_POR_NIVEL, BALAS_POR_PENTE } from './data.js';
import { pick } from './engine.js';

let KEY = 'zonamorta_save_v1';
const KEY_NORMAL = 'zonamorta_save_v1', KEY_TESTE = 'zonamorta_teste_v1';
export function usarSaveTeste(t) { KEY = t ? KEY_TESTE : KEY_NORMAL; }
export function novoEstado() {
  return {
    v: 1, dinheiro: 60,
    estoque: { tabua: 6, bandagem: 3, municao: 4, sucata: 2 },
    armas: { pistola: 1, faca: 1 },
    mochila: 0,
    estruturas: { oficina: 0, enfermaria: 0, paiol: 0, estufa: 0, curral: 0 },
    pend: {}, last: Date.now(),
    sobreviventes: [],
    extraidos: {},
    nextId: 1,
    expedicoes: 0,
  };
}
export let S = novoEstado();
export function carregar() {
  try { const t = localStorage.getItem(KEY); if (t) { S = Object.assign(novoEstado(), JSON.parse(t)); return true; } } catch (_) {}
  return false;
}
export function salvar() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} }
export function resetar() { S = novoEstado(); salvar(); }
// ---------- Modo teste: tudo liberado, em um save separado ----------
export function novoEstadoTeste() {
  const st = novoEstado();
  st.teste = true; st.dinheiro = 999999;
  st.estoque = {}; for (const k in ITENS) st.estoque[k] = 99;
  st.armas = { pistola: 4, faca: 4, escopeta: 4, fuzil: 4, smg: 4, cacadora: 4 };
  st.mochila = 4;
  st.estruturas = { oficina: 3, enfermaria: 3, paiol: 3, estufa: 3, curral: 3 };
  for (let a = 0; a < 3; a++) for (let l = 0; l < 4; l++) st.extraidos[`${a}-${l}`] = true;
  S = st;
  const postos = { enfermeiro: 'enfermaria', farmaceutico: 'enfermaria', militar: 'oficina', fabricante: 'oficina', agricultor: 'estufa', pecuarista: 'curral' };
  for (const prof in PROFISSOES) { const sv = novoSobrevivente(); sv.prof = prof; sv.posto = postos[prof]; S.sobreviventes.push(sv); }
  return S;
}
export function temSave() { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } }

export const capMochila = () => S.teste ? 99 : MOCHILA_BASE + MOCHILA_POR_NIVEL * S.mochila;
export const capEstoque = () => S.teste ? 99999 : ESTOQUE_BASE + ESTOQUE_POR_PAIOL * S.estruturas.paiol;
export const usoEstoque = () => Object.values(S.estoque).reduce((a, b) => a + b, 0);

// adiciona ao estoque; o que não couber é vendido pela metade do preço
export function addEstoque(itens) {
  let vendido = 0;
  for (const k in itens) {
    let n = itens[k];
    while (n > 0) {
      if (usoEstoque() < capEstoque()) { S.estoque[k] = (S.estoque[k] || 0) + 1; }
      else { vendido += Math.floor(ITENS[k].preco / 2); }
      n--;
    }
  }
  S.dinheiro += vendido;
  return vendido;
}
export function temCusto(c) {
  if (S.dinheiro < (c.$ || 0)) return false;
  for (const k in (c.itens || {})) if ((S.estoque[k] || 0) < c.itens[k]) return false;
  return true;
}
export function pagar(c) {
  S.dinheiro -= c.$ || 0;
  for (const k in (c.itens || {})) { S.estoque[k] -= c.itens[k]; if (S.estoque[k] <= 0) delete S.estoque[k]; }
}
export function custoTxt(c) {
  const p = [];
  if (c.$) p.push(`<span class="money">$${c.$}</span>`);
  for (const k in (c.itens || {})) if (c.itens[k]) {
    const ok = (S.estoque[k] || 0) >= c.itens[k];
    p.push(`<span style="color:${ok ? '#cfe' : '#f88'}">${ITENS[k].ic}${c.itens[k]}</span>`);
  }
  return p.join(' ');
}

// ---------- Sobreviventes ----------
export function novoSobrevivente() {
  const prof = pick(Object.keys(PROFISSOES));
  const skins = ['#f1c9a5', '#e0b48c', '#c68e5f', '#9c6640', '#6e4528', '#4a2f1d'];
  return { id: S.nextId++, nome: pick(NOMES), prof, posto: null, skin: pick(skins), shirt: pick(['#a0522d', '#5f7f3f', '#7a4f8a', '#b08a3a', '#3f6f8f', '#8f3f3f', '#556b2f']), hair: pick(['#2a1a10', '#4a2f1d', '#111', '#8a6a3a', '#bbb']) };
}
// bônus passivo vale se o sobrevivente está no posto da sua especialidade
export function bonusAtivo(sv) { return sv.posto && sv.posto === PROFISSOES[sv.prof].posto; }
export function trabalhadores(est) { return S.sobreviventes.filter(s => s.posto === est); }

// bônus para a expedição: base (passivos) + esquadrão (ativos)
export function bonusExpedicao(esquadrao) {
  const b = { vida: 0, disp: 0, cura: 1, pentePorHorda: 0, saque: 1 };
  const conta = (prof) => S.sobreviventes.filter(s => s.prof === prof && (bonusAtivo(s) || esquadrao.includes(s.id))).length;
  b.vida = 20 * conta('enfermeiro');
  b.disp = Math.min(0.7, 0.25 * conta('militar'));
  const sq = S.sobreviventes.filter(s => esquadrao.includes(s.id));
  b.cura = 1 + 0.5 * sq.filter(s => s.prof === 'farmaceutico').length;
  b.pentePorHorda = sq.filter(s => s.prof === 'fabricante').length;
  b.saque = 1 + 0.25 * sq.length + 0.25 * sq.filter(s => s.prof === 'agricultor' || s.prof === 'pecuarista').length;
  return b;
}

// ---------- Produção passiva (continua com o jogo fechado) ----------
export function taxas() {
  // itens por minuto, por estrutura
  const t = {};
  const mult = est => 1 + 0.5 * trabalhadores(est).length;
  const esp = (est, prof) => trabalhadores(est).filter(s => s.prof === prof).length;
  const E = S.estruturas;
  if (E.enfermaria) {
    t.enfermaria = { bandagem: 0.25 * E.enfermaria * mult('enfermaria') };
    const f = esp('enfermaria', 'farmaceutico'); if (f) t.enfermaria.remedio = 0.2 * f * E.enfermaria;
  }
  if (E.estufa) t.estufa = { verdura: 0.5 * E.estufa * mult('estufa') * (1 + esp('estufa', 'agricultor')) };
  if (E.curral) t.curral = { carne: 0.33 * E.curral * mult('curral') * (1 + esp('curral', 'pecuarista')) };
  if (E.oficina) { const f = esp('oficina', 'fabricante'); if (f) t.oficina = { municao: 0.3 * f * E.oficina, sucata: 0.3 * f * E.oficina }; }
  return t;
}
export const capPend = est => 8 * Math.max(1, S.estruturas[est]);
export function tickProducao() {
  const now = Date.now();
  const min = Math.min(60 * 24, (now - (S.last || now)) / 60000);
  S.last = now;
  if (min <= 0) return;
  const t = taxas();
  for (const est in t) {
    S.pend[est] = S.pend[est] || {};
    for (const it in t[est]) S.pend[est][it] = Math.min(capPend(est), (S.pend[est][it] || 0) + t[est][it] * min);
  }
}
export function coletar(est) {
  const p = S.pend[est] || {}; const got = {};
  for (const it in p) { const n = Math.floor(p[it]); if (n > 0) { got[it] = n; p[it] -= n; } }
  const v = addEstoque(got);
  return { got, vendido: v };
}
export { BALAS_POR_PENTE, ESTRUTURAS };
