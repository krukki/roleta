# 🥤 Roleta da Coca

Toda segunda a roleta decide quem paga a coca da semana.

## Como funciona

1. **Amigos:** cadastre a galera (nome, cor da fatia e foto).
2. **Rodada:** marque quem não vai essa semana. Quem pagou na última rodada fica **🛡️ imune**.
3. **Giros:** cada giro da roleta **salva** alguém, que sai da roleta.
4. **A grande final:** quando sobram 2, um minigame é sorteado e os dois jogam no mesmo celular. **Quem perder paga a coca.**
   - ⚡ **Duelo de Reflexo:** toque primeiro quando ficar verde. Tocou antes, queimou.
   - 👆 **Batalha de Toques:** quem tocar mais vezes em 5 segundos.
   - ⏱️ **Cronômetro 5,00:** pare o tempo o mais perto possível de 5 segundos, sem ver.
   - 🪢 **Cabo de Guerra da Lata:** cada toque puxa a lata para o seu lado.
5. **Resultado:** o pagador fica travado até a próxima segunda. Dá para compartilhar no WhatsApp e ver tudo no **Histórico**, com ranking e "patrocinador oficial do mês".

Detalhes:
- O sorteio usa `crypto.getRandomValues`. O resultado de cada giro é decidido e salvo **antes** da animação, então recarregar a página não muda nada.
- Empate no minigame gera revanche automática.
- "Anular rodada" e "Cancelar rodada" existem para erros e ficam registradas no histórico.
- Se só 2 pessoas puderem jogar, vai direto pra final. Se for só 1, ela paga direto.

## Onde ficam os dados

Tudo fica salvo **no navegador do aparelho** (localStorage). Use **Histórico → Exportar backup** para levar os dados para outro celular (**Importar backup**).

## Publicar no GitHub Pages

1. Faça o merge na branch `main`.
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. O workflow `.github/workflows/pages.yml` publica o site a cada push na `main`. O link aparece na aba **Actions** e em **Settings → Pages**.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Não tem build nem dependências: é HTML, CSS e JavaScript puro.

## Estrutura

```
index.html
css/style.css
js/random.js        sorteio justo (crypto)
js/storage.js       salvar/carregar, backup
js/ui.js            avatar, modais, toast
js/round.js         semanas, imunidade, rodada, histórico, ranking
js/wheel.js         roleta em canvas
js/audio.js         sons sintetizados (Web Audio)
js/effects.js       confete, tampinhas, bolhas, tremida
js/minigames/       minigames da final (fácil adicionar novos)
js/app.js           telas e fluxo
```

### Adicionar um minigame

Crie `js/minigames/meujogo.js`, inclua no `index.html` e registre:

```js
R.mg.register({
  key: 'meujogo', name: 'Meu Jogo', emoji: '🎯', split: true,
  how: 'Explicação que aparece antes do jogo.',
  start(container, a, b) {
    // retorne Promise<{ winner, loser, detail }> ou { tie: true }
  },
});
```
