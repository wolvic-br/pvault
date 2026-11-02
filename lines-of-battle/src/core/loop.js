/**
 * Game loop com TIME-STEP FIXO (acumulador).
 * - A lógica roda sempre em passos de `step` segundos (padrão 1/30 s),
 *   independente do FPS: simulação determinística e barata.
 * - A renderização roda no ritmo do requestAnimationFrame e recebe `alpha`
 *   (fração do próximo passo) para interpolar posições — movimento suave
 *   a 60/120 Hz com lógica a 30 Hz.
 */
(function (LOB) {
  class GameLoop {
    constructor({ update, render, step = 1 / 30, maxSteps = 5 }) {
      this.update = update;
      this.render = render;
      this.step = step;
      this.maxSteps = maxSteps; // evita "espiral da morte" em abas lentas
      this.timeScale = 1;
      this.paused = false;
      this.acc = 0;
      this.last = 0;
      this.running = false;
      this._frame = this._frame.bind(this);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._frame);
    }
    stop() { this.running = false; }

    _frame(now) {
      if (!this.running) return;
      const elapsed = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.acc += elapsed * this.timeScale;
      let n = 0;
      while (this.acc >= this.step && n < this.maxSteps) {
        this.update(this.step);
        this.acc -= this.step;
        n++;
      }
      if (n === this.maxSteps) this.acc = 0; // descarta atraso excessivo
      this.render(this.paused ? 1 : this.acc / this.step, elapsed);
      requestAnimationFrame(this._frame);
    }
  }
  LOB.core.GameLoop = GameLoop;
})(window.LOB);
