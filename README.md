# Zona Morta (nome provisório)

Protótipo de jogo mobile, jogado na horizontal, com câmera 3D isométrica: extração em cenários fechados com hordas de zumbis, mais gestão de base (tycoon).

## Como rodar

É um site estático, sem etapa de build. Sirva a pasta com qualquer servidor estático, por exemplo:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Também dá para publicar direto na Vercel (Framework: "Other", sem comando de build).

## Estrutura

- `index.html` — página, estilos e interface
- `three.module.min.js` — Three.js r170 (motor 3D)
- `js/main.js` — tela inicial, loop do jogo e troca entre QG e expedição
- `js/engine.js` — câmera, joystick, modelos chibi, grade do mapa, caminho dos zumbis e sons
- `js/data.js` — **todos os números de balanceamento** (itens, armas, áreas, zumbis, custos, profissões)
- `js/state.js` — salvamento no navegador e produção passiva das estruturas
- `js/expedition.js` — a partida: geração do mapa, hordas, barricadas, saque, gerador, câmeras e extração
- `js/base.js` — QG: estruturas, mercado, oficina, alojamento, mesa de guerra e preparação
- `js/ui.js` — painéis

## Regras de dificuldade

- **Fácil:** até 2 mortes, sem perder itens.
- **Médio:** até 2 mortes; cada morte perde 1/3 da mochila.
- **Difícil:** 1 morte = missão perdida e mochila perdida.
