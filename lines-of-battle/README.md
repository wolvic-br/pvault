# Lines of Battle: Greco-Roman Warfare (MVP)

Estratégia em tempo real minimalista no estilo "linhas de batalha": você **desenha linhas**
sobre o mapa e suas tropas as seguem; quem **dominar mais pontos de controle** acumula
pontos de vitória e vence. Roma (você, vermelho) contra Grécia (IA, azul), em terra e no mar.

- **Tecnologias:** HTML5, CSS3 e JavaScript puro com Canvas 2D. Zero dependências, zero build.
- **Como rodar:** abra `index.html` no navegador (funciona direto via `file://`), ou sirva a pasta:
  `python3 -m http.server` → `http://localhost:8000/lines-of-battle/`.
- **Teste headless:** `node tests/headless.test.js` (valida mapa, corte de rotas, abalroamento
  e simula 3 partidas IA × IA, medindo ms/tick).

## Controles

| Ação | Mouse / toque | Teclado |
|---|---|---|
| Desenhar rota (linha) | pressione **sobre uma unidade sua** e arraste | `Shift` encadeia na rota atual |
| Selecionar | clique, ou arraste uma caixa no vazio | `A` todos · `T` terrestres · `N` navais · `Esc` limpa |
| Linha reta até um ponto | botão direito | |
| Parar | | `S` |
| Pausa / velocidade / reiniciar / ajuda | botões no topo | `Espaço` · `1` `2` `3` · `R` · `H` |

## Regras

- **Pontos de controle:** 7 pontos (4 em terra, 3 no mar). Cada ponto controlado dá +1 ponto de
  vitória por segundo; o primeiro a chegar a **600** vence (ou aniquila o inimigo).
- **Captura:** fique dentro da área; a barra de domínio enche (mais rápido com até 3 unidades).
  Com as duas facções dentro, o ponto fica **contestado** e congela.
- **Reforços:** enquanto controlar sua capital, você recebe uma tropa a cada 18 s e um navio a cada 32 s.
- **Mar:** só navios entram no mar e só tropas andam em terra. Navios têm inércia e raio de giro.
- **Combate:** corpo a corpo só no mesmo terreno (quem está lutando fica preso no lugar);
  peltastas e quinquerremes atiram a distância e atingem os dois terrenos (a costa vira linha de frente).
  Atacar quem já está lutando com outro conta como **flanco** (+30% de dano).

| Unidade | Domínio | Vel. | Força | Vida | Alcance | Especial |
|---|---|---|---|---|---|---|
| Hoplitas (Grécia) | terra | 32 | 9 | 130 | — | **Falange:** 60% do dano corpo a corpo quando parados |
| Legionários (Roma) | terra | 38 | 10 | 115 | — | **Testudo:** 50% do dano de projéteis |
| Peltastas | terra | 52 | 4 | 70 | 90 | Dardos (9 a cada 1,2 s) |
| Pretorianos (Roma) | terra | 36 | 16 | 160 | — | Elite; capturam em dobro |
| Triremes | mar | 78 | 3 | 100 | — | **Abalroamento** (aríete 70) |
| Quinquerremes | mar | 50 | 6 | 190 | 80 | Escorpiões; aríete fraco (30) |
| Navio de apoio | mar | 58 | 1 | 80 | — | Repara aliados a 90 px (5 hp/s) |

---

## a) Estrutura de pastas e tecnologias

```
lines-of-battle/
├── index.html              # estrutura da página, HUD em DOM, ordem dos scripts
├── styles/
│   └── main.css            # estética minimalista (papiro, tinta, vermelho/azul)
├── src/
│   ├── core/               # ENGINE — não sabe nada de gregos ou romanos
│   │   ├── namespace.js    # window.LOB = { core, entities, systems, assets, maps, ui }
│   │   ├── math.js         # vetores, projeção em segmento, ângulos
│   │   ├── spatialHash.js  # vizinhança O(1) por célula
│   │   ├── terrain.js      # grade terra/mar + pré-render do mapa (offscreen)
│   │   ├── loop.js         # game loop com time-step fixo + interpolação
│   │   ├── renderer.js     # Canvas 2D em camadas
│   │   └── input.js        # Pointer Events: desenhar linhas, seleção, atalhos
│   ├── entities/           # DADOS
│   │   ├── unitTypes.js    # tabela de unidades e facções (atributos)
│   │   └── unit.js         # fábrica de unidades (objetos simples)
│   ├── systems/            # REGRAS (funções puras sobre o estado)
│   │   ├── pathing.js      # linha → rota por unidade; router de waypoints da IA
│   │   ├── movement.js     # pure pursuit, terra vetorial, mar com inércia, colisões
│   │   ├── combat.js       # corpo a corpo, tiro, abalroamento, cura, traits
│   │   ├── capture.js      # áreas circulares/retangulares e barras de domínio
│   │   ├── reinforcements.js
│   │   └── ai.js           # IA por heurística, pensa a cada 1,2 s
│   ├── assets/
│   │   └── icons.js        # ícones vetoriais desenhados no Canvas (sem imagens)
│   ├── maps/
│   │   └── aegean.js       # mapa = dados (função de altura, pontos, exércitos)
│   ├── ui/
│   │   └── hud.js          # placar, seleção, ajuda (DOM, 5 Hz)
│   ├── game.js             # estado do mundo + ordem do loop integrado (sem DOM)
│   └── main.js             # bootstrap: liga Game + Renderer + Input + HUD + Loop
└── tests/
    └── headless.test.js    # roda a engine em Node, sem navegador
```

**Por que scripts clássicos com namespace (e não ES modules)?** Para o jogo abrir com duplo
clique (`file://`), onde navegadores bloqueiam `import`. A modularidade fica explícita no
namespace `LOB.*`; migrar para ES modules é mecânico (trocar o IIFE por `export`).

**Separação chave:** `Game` (em `game.js`) e tudo em `systems/` **não tocam no DOM** — por isso
o mesmo código roda no navegador e no teste em Node.

## b) Movimentação: linhas desenhadas + vetores (sem A*)

Três etapas (`systems/pathing.js` + `systems/movement.js`):

1. **Captura do traço** — durante o arraste, só guarda pontos a ≥ 8 px do anterior (simplificação barata).
2. **Rota por unidade** — o traço é deslocado pelo offset de cada unidade em relação à âncora
   (limitado a 60 px, mantendo a formação) e **cortado no primeiro ponto proibido** para o domínio
   dela (tropa não entra no mar; navio não sobe na terra):

```js
function clipToTerrain(path, domain, terrain) {
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (!terrain.passable(x, y, domain)) {          // bateu na costa: corta aqui
        if (s > 1) { const tb = (s - 1) / steps; out.push({ x: a.x + (b.x - a.x) * tb, y: a.y + (b.y - a.y) * tb }); }
        return out;
      }
    }
    out.push(b);
  }
  return out;
}
```

3. **Seguimento com recálculo contínuo ("pure pursuit")** — a cada tick a unidade se projeta na
   polilinha (só nos próximos 4 segmentos) e mira um ponto `lookahead` px à frente. Se for empurrada
   em combate ou desviar da costa, no tick seguinte a projeção muda e ela **volta suavemente para a
   linha** — a trajetória é recalculada sem nenhum algoritmo de busca:

```js
function followPath(u) {
  const p = u.path, end = p[p.length - 1];
  if (Math.hypot(end.x - u.x, end.y - u.y) < 5) return null;        // chegou
  let bestI = u.pathIdx, bestD = Infinity, proj = p[0];
  for (let i = u.pathIdx; i < Math.min(p.length - 1, u.pathIdx + 4); i++) {
    const pr = V.projectOnSegment(u.x, u.y, p[i], p[i + 1]);
    const d = (pr.x - u.x) ** 2 + (pr.y - u.y) ** 2;
    if (d < bestD) { bestD = d; bestI = i; proj = pr; }
  }
  u.pathIdx = bestI;
  let cx = proj.x, cy = proj.y, rem = 18, i = bestI;                 // anda 18 px pela linha
  while (i < p.length - 1 && rem > 0) {
    const seg = Math.hypot(p[i + 1].x - cx, p[i + 1].y - cy);
    if (seg >= rem) { cx += (p[i + 1].x - cx) / seg * rem; cy += (p[i + 1].y - cy) / seg * rem; rem = 0; }
    else { rem -= seg; cx = p[i + 1].x; cy = p[i + 1].y; i++; }
  }
  const dx = cx - u.x, dy = cy - u.y, L = Math.hypot(dx, dy) || 1;
  return { x: dx / L, y: dy / L };                                   // direção desejada (vetor unitário)
}
```

O vetor resultante vira deslocamento: **terra** = `pos += dir × velocidade × dt`, deslizando no eixo
livre ao tocar a costa; **mar** = o rumo gira no máximo `turnRate × dt` em direção ao vetor, a
velocidade acelera/desacelera com `accel` e cai em curvas fechadas (inércia).

A IA usa o mesmo formato de rota, gerada por um grafo de ~10 waypoints feitos à mão
(`Router`, Dijkstra em um grafo de visibilidade) apenas para contornar o mar.

## c) Captura de pontos

`systems/capture.js`:

- **Áreas:** cada ponto é `{ shape: 'circle', x, y, r }` ou `{ shape: 'rect', x, y, w, h }` (centro).
  O domínio (terra/mar) é deduzido do terreno no centro — pontos no mar só podem ser tomados por navios.
- **Presença:** consulta o spatial hash no raio envolvente e testa a forma exata:

```js
function contains(p, x, y) {
  const dx = x - p.x, dy = y - p.y;
  if (p.shape === 'circle') return dx * dx + dy * dy <= p.r * p.r;
  return Math.abs(dx) <= p.w / 2 && Math.abs(dy) <= p.h / 2;
}
```

- **Barra de domínio:** um único número `dominance ∈ [-100, +100]` (Roma +, Grécia −):

```js
if (r > 0 && g === 0)      p.dominance += RATE * Math.min(r, 3) * dt;   // só Roma
else if (g > 0 && r === 0) p.dominance -= RATE * Math.min(g, 3) * dt;   // só Grécia
else if (r === 0 && g === 0) /* volta devagar para o dono (ou para 0) */;
// r > 0 && g > 0 → contestado: congela
if (p.dominance >= 100) p.owner = 'rome';
else if (p.dominance <= -100) p.owner = 'greece';
else if (p.owner === 'rome' && p.dominance <= 0) p.owner = null;        // neutraliza ao cruzar o 0
```

  `r`/`g` somam o atributo `capture` das unidades (pretorianos e quinquerremes valem 2).
- **Feedback visual** (`core/renderer.js → drawPoint`): área preenchida na cor do dono (tracejada se
  neutra); anel de progresso no círculo; **barra bipolar** sob o ponto (Roma enche para a esquerda,
  Grécia para a direita a partir do centro); contorno dourado pulsando quando contestado; onda
  expandindo quando o ponto muda de dono.

## d) Loop de combate integrado (terra + mar)

`core/loop.js` executa a lógica em passos fixos de 1/30 s; `Game.update` (em `game.js`) define a ordem:

```js
update(dt) {
  for (const u of this.units) { u.px = u.x; u.py = u.y; }   // 0. snapshot (interpolação)
  this.hash.rebuild(this.units);                             // 1. vizinhança
  for (const ai of this.ais) ai.update(dt);                  // 2. IA (throttled)
  S.movement.updateMovement(this, dt);                       // 3. terra: vetorial · mar: inércia/giro
  this.hash.rebuild(this.units);
  S.movement.resolveCollisions(this);                        // 4. separação; inimigos são sólidos
  S.combat.updateCombat(this, dt);                           // 5. melee, tiro, aríete, cura → dano
  this.hash.rebuild(this.units);
  S.capture.updateCapture(this, dt);                         // 6. barras de domínio
  for (const p of this.points) if (p.owner) this.vp[p.owner] += dt;   // 7. placar
  S.reinforcements.updateReinforcements(this, dt);
  this.checkVictory();
  /* 8. envelhece efeitos visuais */
}
```

Terra e mar compartilham o mesmo loop e os mesmos sistemas; as diferenças são **regras condicionadas
ao domínio**:

- `movement.js`: `if (u.type.domain === 'land') moveLand(...) else moveNaval(...)`.
- `combat.js`: corpo a corpo exige o mesmo domínio; tiro atravessa a linha da costa.
- **Abalroamento** (triremes e, mais fraco, quinquerremes) — dano = aríete × velocidade × ângulo:

```js
const approach    = (hx * dx + hy * dy) / d;              // 1 = proa apontada para o alvo
const speedRatio  = u.speed / t.speed;                    // embalo atual / máximo
if (approach < 0.5 || speedRatio < 0.3) continue;         // de lado ou parado não é abalroamento
const angleFactor = 0.3 + 0.7 * Math.abs(Math.sin(u.heading - e.heading)); // de través (90°) = 1
const dmg = t.ram * speedRatio * approach * angleFactor;
// alvo é empurrado e perde embalo; atacante quase para (precisa recuperar velocidade)
```

  Medido no teste: de través a toda velocidade = **70** de dano; de frente a meia velocidade = **12,6**.
- **Resolução simultânea:** todo dano vai para `pendingDmg` e só é aplicado ao fim do tick, então a
  ordem de iteração não favorece ninguém.

**Renderização** (`Renderer.render(alpha)`) desenha o estado em camadas — terreno (imagem pronta),
pontos, rotas, unidades em `lerp(prev, atual, alpha)`, barras de vida, efeitos e o traço sendo desenhado.

## e) Leveza e responsividade

**Menos cálculo por frame**
- **Time-step fixo de 30 Hz** com acumulador; o render interpola a 60/120 Hz. Lógica determinística e
  metade do custo de um loop a 60 Hz. Limite de 5 passos por frame evita a "espiral da morte".
- **Spatial hash** (células de 64 px) para combate, colisão, captura e aggro: ~O(N) em vez de O(N²).
  Arrays de consulta são reaproveitados (sem lixo para o GC).
- **Terreno em grade** (`Uint8Array`, tiles de 8 px): `passable(x, y)` é uma leitura de array.
- **Pure pursuit com janela de 4 segmentos**: o custo de seguir uma rota não cresce com o tamanho da linha.
- **IA throttled** (1,2 s) e **HUD a 5 Hz**: o que não precisa de 30 Hz não roda a 30 Hz.
- Resultado medido em Node: **~0,1 ms por tick** com ~20 unidades.

**Renderização incremental**
- O mapa (cálculo por pixel da função de altura) é desenhado **uma única vez** em um canvas offscreen e
  depois apenas copiado com `drawImage`; reiniciar a partida reaproveita a imagem.
- HUD em DOM, atualizado só quando necessário, em vez de redesenhar texto no canvas a cada frame.
- Próximos passos possíveis: segundo canvas só para os pontos de controle (redesenhar quando
  `dominance` mudar) e `OffscreenCanvas` + Web Worker para a simulação.

**Organização para expansão via IA**
- **Dados separados de regras:** nova unidade = nova entrada em `unitTypes.js` (+ ícone opcional em
  `icons.js`); novo mapa = novo arquivo em `maps/` com `heightAt`, `points`, `armies`, `spawns`, `rosters`, `waypoints`.
- **Sistemas pequenos e independentes**, cada um com um comentário de cabeçalho explicando regras e
  contratos — um agente consegue mudar o combate sem ler o renderizador.
- **Traits** (`phalanx`, `testudo`...) são lidos num único ponto (`dealDamage`): nova habilidade =
  um atributo nos dados + uma linha no combate.
- **Engine headless** + `tests/headless.test.js`: qualquer alteração pode ser validada
  automaticamente (`node tests/headless.test.js`), inclusive balanceamento via partidas IA × IA.
- `LOB.debug` expõe `game`, `loop`, `renderer` e `input` no console do navegador.

### Ideias de expansão
Escolha de facção (jogar de Grécia), fog of war, moral/fuga, terreno com colinas e florestas
(modificadores de velocidade/defesa), transporte de tropas por navios, editor de mapas e multiplayer
(a engine sem DOM e com passo fixo já é adequada para lockstep).
