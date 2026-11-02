// Dados de configuração do jogo (fácil de ajustar o balanceamento aqui)

export const ITENS = {
  tabua:      { nome: 'Tábua',        ic: '🪵', preco: 4 },
  engrenagem: { nome: 'Engrenagem',   ic: '⚙️', preco: 8 },
  fio:        { nome: 'Fio',          ic: '🔌', preco: 6 },
  ferramenta: { nome: 'Ferramenta',   ic: '🔧', preco: 12 },
  remedio:    { nome: 'Remédio',      ic: '💊', preco: 15 },
  bandagem:   { nome: 'Bandagem',     ic: '🩹', preco: 7 },
  municao:    { nome: 'Munição (pente)', ic: '📦', preco: 5 },
  sucata:     { nome: 'Sucata',       ic: '🔩', preco: 3 },
  comida:     { nome: 'Enlatado',     ic: '🥫', preco: 5 },
  combustivel:{ nome: 'Combustível',  ic: '⛽', preco: 10 },
  raro:       { nome: 'Item raro',    ic: '💎', preco: 60 },
  verdura:    { nome: 'Verdura',      ic: '🥬', preco: 4 },
  carne:      { nome: 'Carne',        ic: '🍖', preco: 9 },
};
export const BALAS_POR_PENTE = 12;
// Itens que podem ser levados na preparação
export const CONSUMIVEIS = ['tabua', 'bandagem', 'remedio', 'municao', 'engrenagem', 'fio', 'ferramenta'];
// Itens que o mercado vende (preço de compra = preço x 2,5)
export const LOJA = ['tabua', 'municao', 'bandagem'];

export const ARMAS = {
  pistola:  { nome: 'Pistola',         slot: 'pistola',    dmg: 14, cad: 0.36, alc: 8.5, disp: 0.10, proj: 1, infinita: true },
  escopeta: { nome: 'Escopeta',        slot: 'principal',  dmg: 10, cad: 0.85, alc: 6,   disp: 0.38, proj: 6 },
  fuzil:    { nome: 'Fuzil',           slot: 'principal',  dmg: 20, cad: 0.15, alc: 11,  disp: 0.08, proj: 1 },
  smg:      { nome: 'Submetralhadora', slot: 'secundaria', dmg: 9,  cad: 0.09, alc: 7.5, disp: 0.20, proj: 1 },
  cacadora: { nome: 'Rifle de caça',   slot: 'secundaria', dmg: 48, cad: 1.0,  alc: 13,  disp: 0.03, proj: 1 },
  faca:     { nome: 'Faca',            slot: 'faca',       dmg: 30, cad: 0.45, alc: 1.35 },
};
// custo para fabricar na oficina (nível mínimo da oficina)
export const FABRICAR = {
  escopeta: { nivel: 1, $: 80,  itens: { sucata: 3, ferramenta: 1 } },
  smg:      { nivel: 1, $: 100, itens: { sucata: 4, engrenagem: 2 } },
  cacadora: { nivel: 2, $: 160, itens: { sucata: 4, ferramenta: 2 } },
  fuzil:    { nivel: 2, $: 220, itens: { sucata: 6, engrenagem: 3, ferramenta: 2 } },
};
export function custoTier(t) { return { $: 60 * t, itens: { sucata: 3 * t, engrenagem: t } }; }
export function statsArma(id, tier) {
  const a = ARMAS[id];
  return { ...a, id, tier, dmg: a.dmg * (1 + 0.35 * (tier - 1)), cad: a.cad * (1 - 0.08 * (tier - 1)) };
}
export const MOCHILA_BASE = 16, MOCHILA_POR_NIVEL = 6, MOCHILA_MAX = 4;
export function custoMochila(n) { return { $: 70 * (n + 1), itens: { sucata: 2 + 2 * n, tabua: 0 } }; }

export const ESTRUTURAS = {
  oficina:    { nome: 'Oficina de Armas', ic: '🛠️', max: 3, desc: 'Fabrica e melhora armas. Fabricantes aqui produzem munição e sucata. Militares aqui melhoram sua precisão.' },
  enfermaria: { nome: 'Enfermaria',       ic: '🏥', max: 3, desc: 'Produz bandagens. Enfermeiros aqui aumentam sua vida. Farmacêuticos aqui produzem remédios.' },
  paiol:      { nome: 'Paiol',            ic: '📦', max: 3, desc: 'Aumenta a capacidade de armazenamento do abrigo.' },
  estufa:     { nome: 'Estufa',           ic: '🌱', max: 3, desc: 'Produz verduras sozinha. Agricultores aqui dobram a produção.' },
  curral:     { nome: 'Curral',           ic: '🐄', max: 3, desc: 'Produz carne sozinho. Pecuaristas aqui dobram a produção.' },
};
export const CUSTO_ESTRUTURA = {
  oficina:    [{ $: 100, itens: { tabua: 4, sucata: 3 } }, { $: 280, itens: { tabua: 6, engrenagem: 3 } }, { $: 600, itens: { ferramenta: 4, engrenagem: 5 } }],
  enfermaria: [{ $: 90,  itens: { tabua: 4 } },            { $: 240, itens: { tabua: 6, remedio: 2 } },   { $: 520, itens: { ferramenta: 3, remedio: 4 } }],
  paiol:      [{ $: 70,  itens: { tabua: 6 } },            { $: 200, itens: { tabua: 10, sucata: 4 } },   { $: 450, itens: { tabua: 12, ferramenta: 3 } }],
  estufa:     [{ $: 80,  itens: { tabua: 4, fio: 1 } },    { $: 220, itens: { tabua: 6, fio: 3 } },       { $: 480, itens: { ferramenta: 3, fio: 4 } }],
  curral:     [{ $: 140, itens: { tabua: 8 } },            { $: 300, itens: { tabua: 10, comida: 4 } },   { $: 560, itens: { ferramenta: 3, comida: 6 } }],
};
export const ESTOQUE_BASE = 60, ESTOQUE_POR_PAIOL = 50;

export const PROFISSOES = {
  enfermeiro:   { nome: 'Enfermeiro(a)', ic: '🩺', posto: 'enfermaria', base: '+20 de vida máxima', campo: '+20 de vida máxima' },
  farmaceutico: { nome: 'Farmacêutico(a)', ic: '⚗️', posto: 'enfermaria', base: 'Produz remédios', campo: 'Curas 50% mais fortes' },
  militar:      { nome: 'Militar', ic: '🎖️', posto: 'oficina', base: '-25% de dispersão dos tiros', campo: '-25% de dispersão dos tiros' },
  fabricante:   { nome: 'Fabricante', ic: '🏭', posto: 'oficina', base: 'Produz munição e sucata', campo: '+1 pente de munição a cada horda' },
  agricultor:   { nome: 'Agricultor(a)', ic: '🌾', posto: 'estufa', base: 'Estufa produz o dobro', campo: 'Saqueia 25% mais rápido' },
  pecuarista:   { nome: 'Pecuarista', ic: '🤠', posto: 'curral', base: 'Curral produz o dobro', campo: 'Saqueia 25% mais rápido' },
};
export const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Lucas', 'Marta', 'Nilo', 'Olga', 'Paulo', 'Rita', 'Sérgio', 'Tânia', 'Vítor', 'Wesley', 'Yara', 'Zeca', 'Bia', 'Caio', 'Duda', 'Edu', 'Flávia', 'Igor', 'Lia', 'Mauro', 'Neide', 'Otto', 'Pri', 'Rafa', 'Sol'];

export const DIFICULDADES = {
  facil:   { nome: 'Fácil',   mortes: 2, perdaMorte: 0,    zHp: 0.8, zDmg: 0.7, loot: 1,   $: 1,   desc: 'Até 2 mortes. Morrer não tira itens da mochila.' },
  medio:   { nome: 'Médio',   mortes: 2, perdaMorte: 0.34, zHp: 1,   zDmg: 1,   loot: 1.4, $: 1.6, desc: 'Até 2 mortes. Cada morte perde 1/3 da mochila.' },
  dificil: { nome: 'Difícil', mortes: 0, perdaMorte: 1,    zHp: 1.3, zDmg: 1.35, loot: 2,  $: 2.5, desc: 'Hardcore: 1 morte = missão perdida e mochila perdida.' },
};

export const AREAS = [
  { nome: 'Área 1 · Subúrbio', hordas: 3, zBase: 7, zInc: 4, zHp: 1, tipos: ['normal'], tam: [22, 14], entradas: 5, $: 40, resgate: 0.6, caixas: 10,
    locais: [
      { id: 'posto', nome: 'Posto de Gasolina', ic: '⛽', cores: { piso: '#4a4a44', parede: '#c9b48a', fora: '#2b3324' }, loot: { combustivel: 4, sucata: 3, ferramenta: 2, fio: 2, comida: 2, tabua: 3, municao: 1 }, deco: 'posto' },
      { id: 'delegacia', nome: 'Delegacia', ic: '🚓', cores: { piso: '#3e4552', parede: '#8898ad', fora: '#2a2f2a' }, loot: { municao: 5, ferramenta: 1, sucata: 2, bandagem: 2, tabua: 2, raro: 0.3 }, deco: 'delegacia' },
      { id: 'hospital', nome: 'Hospital', ic: '🏥', cores: { piso: '#9aa6a3', parede: '#e1e6e3', fora: '#28322a' }, loot: { remedio: 3, bandagem: 4, fio: 2, engrenagem: 1, tabua: 2, comida: 1 }, deco: 'hospital' },
      { id: 'mercado', nome: 'Supermercado', ic: '🛒', cores: { piso: '#a39878', parede: '#c45b4a', fora: '#2c3326' }, loot: { comida: 5, tabua: 3, bandagem: 1, sucata: 2, fio: 1, engrenagem: 1 }, deco: 'mercado' },
    ] },
  { nome: 'Área 2 · Centro', hordas: 4, zBase: 10, zInc: 5, zHp: 1.5, tipos: ['normal', 'normal', 'corredor'], tam: [26, 16], entradas: 6, $: 90, resgate: 0.65, caixas: 13,
    locais: [
      { id: 'escola', nome: 'Escola', ic: '🏫', cores: { piso: '#7d6a4f', parede: '#d8c27a', fora: '#29301f' }, loot: { tabua: 4, comida: 2, fio: 2, engrenagem: 2, bandagem: 2, sucata: 2 }, deco: 'escola' },
      { id: 'shopping', nome: 'Shopping', ic: '🛍️', cores: { piso: '#b9b2a6', parede: '#6c7f94', fora: '#252b28' }, loot: { raro: 1, comida: 3, fio: 2, ferramenta: 2, engrenagem: 2, sucata: 2 }, deco: 'mercado' },
      { id: 'fabrica', nome: 'Fábrica', ic: '🏭', cores: { piso: '#55524b', parede: '#8a6d55', fora: '#26291f' }, loot: { engrenagem: 4, sucata: 4, ferramenta: 3, fio: 3, combustivel: 1 }, deco: 'fabrica' },
      { id: 'metro', nome: 'Estação de Metrô', ic: '🚇', cores: { piso: '#5f6468', parede: '#3f6f7d', fora: '#1f2324' }, loot: { municao: 2, bandagem: 2, sucata: 3, fio: 3, raro: 0.5, comida: 2 }, deco: 'delegacia' },
    ] },
  { nome: 'Área 3 · Zona Vermelha', hordas: 5, zBase: 13, zInc: 6, zHp: 2.2, tipos: ['normal', 'normal', 'corredor', 'corredor', 'brutamonte'], tam: [30, 18], entradas: 7, $: 180, resgate: 0.7, caixas: 16,
    locais: [
      { id: 'basemilitar', nome: 'Base Militar', ic: '🪖', cores: { piso: '#4c5340', parede: '#6b7553', fora: '#22261b' }, loot: { municao: 6, ferramenta: 2, engrenagem: 2, raro: 0.6, bandagem: 2 }, deco: 'fabrica' },
      { id: 'laboratorio', nome: 'Laboratório', ic: '🧪', cores: { piso: '#cfd6d8', parede: '#5d8f8a', fora: '#1d2422' }, loot: { remedio: 5, raro: 1.2, fio: 3, engrenagem: 2, bandagem: 2 }, deco: 'hospital' },
      { id: 'aeroporto', nome: 'Aeroporto', ic: '✈️', cores: { piso: '#8d8f93', parede: '#3d4f6b', fora: '#202520' }, loot: { raro: 1, combustivel: 3, comida: 3, ferramenta: 2, fio: 2, sucata: 2 }, deco: 'mercado' },
      { id: 'presidio', nome: 'Presídio', ic: '⛓️', cores: { piso: '#585858', parede: '#7c7c74', fora: '#1f221d' }, loot: { municao: 4, sucata: 4, ferramenta: 2, tabua: 4, raro: 0.4 }, deco: 'delegacia' },
    ] },
];
export const ZUMBIS = {
  normal:     { hp: 40,  vel: 1.45, dmg: 10, dmgBarr: 8,  esc: 1,    cor: '#5e7d4f', roupa: ['#5b4a3a', '#3f4f63', '#6d3b3b', '#4a4a4a'] },
  corredor:   { hp: 26,  vel: 2.7,  dmg: 7,  dmgBarr: 5,  esc: 0.9,  cor: '#7f9a5a', roupa: ['#8a5a2b', '#6a6a2a'] },
  brutamonte: { hp: 170, vel: 1.0,  dmg: 24, dmgBarr: 30, esc: 1.45, cor: '#4f6a45', roupa: ['#4b2e5a', '#2e3b2e'] },
};
// Pontos para liberar a próxima área (locais diferentes extraídos)
export const LIBERAR_AREA = 2;
