/** BOOTSTRAP: cria jogo, renderer, input, HUD e liga tudo no loop fixo. */
(function (LOB) {
  const canvas = document.getElementById('battlefield');
  let game = new LOB.Game(LOB.maps.aegean, { player: 'rome', aiFactions: ['greece'] });
  const renderer = new LOB.core.Renderer(canvas, game);
  const hud = new LOB.ui.HUD();

  const loop = new LOB.core.GameLoop({
    step: 1 / 30,
    update: (dt) => game.update(dt),
    render: (alpha, frameDt) => {
      renderer.render(alpha, input);
      hud.update(frameDt, game, input, loop);
    },
  });

  const help = document.getElementById('help');
  const input = new LOB.core.Input(canvas, renderer, () => game, {
    togglePause: () => { loop.paused = !loop.paused; },
    setSpeed: (s) => { loop.timeScale = s; },
    toggleHelp: () => { help.hidden = !help.hidden; },
    restart: () => {
      const terrainCanvas = game.terrain.canvas;
      game = new LOB.Game(LOB.maps.aegean, { player: 'rome', aiFactions: ['greece'] });
      game.terrain.canvas = terrainCanvas; // reaproveita o terreno já renderizado
      renderer.setGame(game);
      input.selection.clear();
      loop.paused = false;
    },
  });

  document.getElementById('btn-help').onclick = () => { help.hidden = !help.hidden; };
  document.getElementById('btn-close-help').onclick = () => { help.hidden = true; };
  document.getElementById('btn-pause').onclick = () => { loop.paused = !loop.paused; };
  document.getElementById('btn-speed').onclick = () => { loop.timeScale = loop.timeScale >= 3 ? 1 : loop.timeScale + 1; };

  // exposto para depuração e para ferramentas/IA externas
  LOB.debug = { get game() { return game; }, loop, renderer, input };
  loop.start();
})(window.LOB);
