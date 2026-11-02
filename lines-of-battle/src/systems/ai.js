/**
 * IA simples (controla a Grécia por padrão). Pensa a cada `interval` s —
 * não a cada frame — para economizar CPU.
 * Heurística por unidade ociosa:
 *   - em combate → deixa lutar;
 *   - dentro de um ponto ainda não totalmente dominado → fica e captura;
 *   - senão escolhe o ponto do seu domínio com menor custo:
 *       distância + penalidade se já é nosso (bônus se ameaçado)
 *       + penalidade por unidades já designadas + ruído.
 * A rota é calculada pelo Router (waypoints) e vira uma "linha" igual à
 * que o jogador desenha.
 */
(function (LOB) {
  const { V } = LOB.core;

  class AIController {
    constructor(game, faction, interval = 1.2) {
      this.game = game;
      this.faction = faction;
      this.interval = interval;
      this.timer = 0.5;
      this.enemy = faction === 'rome' ? 'greece' : 'rome';
    }

    update(dt) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = this.interval;
      const g = this.game, f = this.faction;
      const { contains } = LOB.systems.capture;
      const mine = g.units.filter((u) => u.faction === f);

      const assigned = new Map();
      for (const u of mine) if (u.aiGoal && u.path) assigned.set(u.aiGoal, (assigned.get(u.aiGoal) || 0) + 1);

      for (const u of mine) {
        if (u.engaged) continue;
        if (u.path && u.aiGoal && u.aiGoal.owner !== f) continue; // missão em andamento
        const domain = u.type.domain;
        const inside = g.points.find((p) => p.domain === domain && contains(p, u.x, u.y));
        if (inside && (inside.owner !== f || Math.abs(inside.dominance) < 100 || inside.presence[this.enemy] > 0)) continue;

        let best = null, bestS = Infinity;
        for (const p of g.points) {
          if (p.domain !== domain) continue;
          let s = V.dist(u, p);
          if (p.owner === f) s += p.presence[this.enemy] > 0 ? -250 : 700;
          s += (assigned.get(p) || 0) * 140;
          s += Math.random() * 90;
          if (s < bestS) { bestS = s; best = p; }
        }
        if (!best) continue;
        // destino com leve dispersão dentro do ponto
        const spread = best.shape === 'circle' ? best.r * 0.5 : Math.min(best.w, best.h) * 0.35;
        const dest = { x: best.x + (Math.random() - 0.5) * spread, y: best.y + (Math.random() - 0.5) * spread };
        if (!g.terrain.passable(dest.x, dest.y, domain)) { dest.x = best.x; dest.y = best.y; }
        const route = g.routers[domain].route(u, dest);
        if (route) {
          LOB.systems.pathing.assignPath(u, [{ x: u.x, y: u.y }, ...route]);
          u.aiGoal = best;
          assigned.set(best, (assigned.get(best) || 0) + 1);
        }
      }
    }
  }

  LOB.systems.AIController = AIController;
})(window.LOB);
