/**
 * INPUT (Pointer Events: mouse + toque + caneta).
 *
 *  - Pressionar SOBRE uma unidade sua e arrastar → DESENHA A LINHA de rota
 *    para a seleção (Shift: encadeia na rota atual).
 *  - Arrastar no vazio → caixa de seleção.  Clique no vazio → desseleciona.
 *  - Clique numa unidade → seleciona (Shift: adiciona/remove).
 *  - Botão direito → linha reta até o ponto clicado.
 *  - Teclado: Espaço pausa · 1/2/3 velocidade · A seleciona todos ·
 *    T só terrestres · N só navais · S para · Esc limpa · H ajuda · R reinicia.
 */
(function (LOB) {
  const { addStrokePoint } = LOB.systems.pathing;

  class Input {
    constructor(canvas, renderer, getGame, hooks = {}) {
      this.canvas = canvas;
      this.renderer = renderer;
      this.getGame = getGame;
      this.hooks = hooks;
      this.selection = new Set();
      this.mode = null;        // 'draw' | 'box' | null
      this.stroke = [];
      this.box = null;
      this.anchor = null;
      this.shift = false;

      canvas.addEventListener('pointerdown', (e) => this.down(e));
      canvas.addEventListener('pointermove', (e) => this.move(e));
      canvas.addEventListener('pointerup', (e) => this.up(e));
      canvas.addEventListener('pointercancel', () => { this.mode = null; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => this.key(e));
    }

    get game() { return this.getGame(); }

    /** Remove da seleção unidades que morreram. */
    prune() { for (const u of this.selection) if (!u.alive) this.selection.delete(u); }

    down(e) {
      const g = this.game, p = this.renderer.toWorld(e.clientX, e.clientY);
      this.shift = e.shiftKey;
      if (e.button === 2) { // ordem rápida em linha reta
        if (this.selection.size) g.commandMoveTo([...this.selection], p, e.shiftKey);
        return;
      }
      this.canvas.setPointerCapture(e.pointerId);
      const hit = g.unitAt(p.x, p.y, g.player, e.pointerType === 'touch' ? 14 : 6);
      if (hit) {
        if (e.shiftKey) { this.selection.has(hit) ? this.selection.delete(hit) : this.selection.add(hit); }
        else if (!this.selection.has(hit)) { this.selection.clear(); this.selection.add(hit); }
        this.mode = 'draw';
        this.anchor = hit;
        this.stroke = [{ x: hit.x, y: hit.y }];
      } else {
        this.mode = 'box';
        this.box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      }
    }

    move(e) {
      if (!this.mode) return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      if (this.mode === 'draw') addStrokePoint(this.stroke, p, 8);
      else if (this.mode === 'box') { this.box.x1 = p.x; this.box.y1 = p.y; }
    }

    up(e) {
      const g = this.game;
      if (this.mode === 'draw') {
        const p = this.renderer.toWorld(e.clientX, e.clientY);
        addStrokePoint(this.stroke, p, 2);
        const len = LOB.core.V.polylineLength(this.stroke);
        if (len > 14) g.commandStroke([...this.selection], this.stroke, this.anchor, this.shift);
      } else if (this.mode === 'box') {
        const b = this.box;
        const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
        if (!e.shiftKey) this.selection.clear();
        if (x1 - x0 > 4 || y1 - y0 > 4) {
          for (const u of g.units) {
            if (u.faction === g.player && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) this.selection.add(u);
          }
        }
      }
      this.mode = null; this.stroke = []; this.box = null; this.anchor = null;
    }

    key(e) {
      const g = this.game, k = e.key.toLowerCase();
      const mine = () => g.units.filter((u) => u.faction === g.player);
      if (k === ' ') { e.preventDefault(); this.hooks.togglePause && this.hooks.togglePause(); }
      else if (k === '1' || k === '2' || k === '3') this.hooks.setSpeed && this.hooks.setSpeed(Number(k));
      else if (k === 'a') { this.selection = new Set(mine()); }
      else if (k === 't') { this.selection = new Set(mine().filter((u) => u.type.domain === 'land')); }
      else if (k === 'n') { this.selection = new Set(mine().filter((u) => u.type.domain === 'naval')); }
      else if (k === 's') { for (const u of this.selection) u.path = null; }
      else if (k === 'escape') this.selection.clear();
      else if (k === 'h') this.hooks.toggleHelp && this.hooks.toggleHelp();
      else if (k === 'r') this.hooks.restart && this.hooks.restart();
    }
  }

  LOB.core.Input = Input;
})(window.LOB);
