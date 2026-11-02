/**
 * Namespace global do jogo.
 * Usamos scripts clássicos (não ES modules) para que o jogo rode abrindo o
 * index.html direto do disco (file://), sem servidor. Cada arquivo registra
 * seu conteúdo em um sub-namespace — isso mantém o acoplamento explícito e
 * facilita que uma IA localize/estenda cada parte.
 */
window.LOB = window.LOB || {
  core: {},      // engine: matemática, loop, terreno, render, input
  entities: {},  // definição de unidades e facções
  systems: {},   // regras: movimento, combate, captura, IA, reforços
  assets: {},    // ícones vetoriais (desenhados via Canvas)
  maps: {},      // definições de mapas (dados puros)
  ui: {},        // HUD em DOM
};
