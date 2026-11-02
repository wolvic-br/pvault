/**
 * GAME — estado do mundo + ORDEM DO LOOP INTEGRADO (terra + mar).
 * Não toca no DOM: pode rodar headless (testes em Node, servidor, IA).
 *
 * Ordem de cada tick fixo (update):
 *   0. guarda posição anterior (interpolação no render)
 *   1. reconstrói spatial hash
 *   2. IA decide (throttled)
 *   3. movimento: terra (vetorial) e mar (inércia/giro) — mesmo sistema,
 *      regras condicionadas a unit.type.domain
 *   4. hash de novo + colisões/separação
 *   5. combate: corpo a corpo, tiro, abalroamento, cura → aplica dano
 *   6. captura de pontos (barras de domínio)
 *   7. placar, reforços e vitória
 *   8. efeitos visuais envelhecem
 */
(function (LOB) {
  const { SpatialHash, Terrain } = LOB.core;
  const S = LOB.systems;

  const VP_TARGET = 600; // pontos de vitória: +1/s por ponto controlado

  class Game {
    constructor(mapDef, { player = 'rome', aiFactions = ['greece'] } = {}) {
      this.map = mapDef;
      this.terrain = new Terrain(mapDef);
      this.hash = new SpatialHash(64);
      this.units = [];
      this.effects = [];
      this.messages = [];
      this.time = 0;
      this.player = player;
      this.winner = null;
      this.vp = { rome: 0, greece: 0 };
      this.vpTarget = VP_TARGET;
      this.stats = { rome: { lost: 0 }, greece: { lost: 0 } };
      this.points = mapDef.points.map((p) => S.capture.createPoint(p, this.terrain));
      this.routers = {
        land: new S.pathing.Router(this.terrain, mapDef.waypoints.land, 'land'),
        naval: new S.pathing.Router(this.terrain, mapDef.waypoints.naval, 'naval'),
      };
      this.reinf = { rome: S.reinforcements.createState(), greece: S.reinforcements.createState() };
      this.ais = aiFactions.map((f) => new S.AIController(this, f));
      for (const f of Object.keys(mapDef.armies)) {
        for (const [type, x, y] of mapDef.armies[f]) this.spawn(type, f, x, y);
      }
    }

    spawn(typeKey, faction, x, y) {
      const u = LOB.entities.createUnit(typeKey, faction, x, y);
      this.units.push(u);
      return u;
    }

    fx(e) { e.age = 0; this.effects.push(e); }
    log(text) { this.messages.push({ text, t: this.time }); if (this.messages.length > 6) this.messages.shift(); }

    update(dt) {
      if (this.winner) return;
      this.time += dt;
      const units = this.units;

      // 0. snapshot para interpolação
      for (const u of units) { u.px = u.x; u.py = u.y; }
      // 1. vizinhança
      this.hash.rebuild(units);
      // 2. IA
      for (const ai of this.ais) ai.update(dt);
      // 3. movimento terra + mar
      S.movement.updateMovement(this, dt);
      // 4. colisões
      this.hash.rebuild(this.units);
      S.movement.resolveCollisions(this);
      // 5. combate (remove mortos de this.units)
      S.combat.updateCombat(this, dt);
      // 6. captura
      this.hash.rebuild(this.units);
      S.capture.updateCapture(this, dt);
      // 7. placar, reforços, vitória
      for (const p of this.points) if (p.owner) this.vp[p.owner] += dt;
      S.reinforcements.updateReinforcements(this, dt);
      this.checkVictory();
      // 8. efeitos
      for (const e of this.effects) e.age += dt;
      if (this.effects.length) this.effects = this.effects.filter((e) => e.age < e.ttl);
    }

    checkVictory() {
      for (const f of ['rome', 'greece']) {
        if (this.vp[f] >= this.vpTarget) return this.end(f, 'pontos de vitória');
      }
      for (const f of ['rome', 'greece']) {
        const alive = this.units.some((u) => u.faction === f);
        const holds = this.points.some((p) => p.owner === f);
        if (!alive && !holds) return this.end(f === 'rome' ? 'greece' : 'rome', 'aniquilação');
      }
    }
    end(winner, reason) {
      this.winner = winner;
      this.winReason = reason;
      this.log(`${LOB.entities.FACTIONS[winner].name} vence por ${reason}!`);
    }

    /** Ordem do jogador (ou de qualquer controlador): seguir um traço. */
    commandStroke(units, stroke, anchor, append = false) {
      const paths = S.pathing.buildPaths(units, stroke, anchor, this.terrain);
      for (const [u, path] of paths) { S.pathing.assignPath(u, path, append); u.aiGoal = null; }
      return paths;
    }

    /** Ordem rápida: linha reta até um ponto. */
    commandMoveTo(units, target, append = false) {
      const res = new Map();
      for (const u of units) {
        const path = S.pathing.clipToTerrain([{ x: u.x, y: u.y }, target], u.type.domain, this.terrain);
        if (path.length >= 2) { S.pathing.assignPath(u, path, append); res.set(u, path); }
      }
      return res;
    }

    unitAt(x, y, faction, slack = 6) {
      let best = null, bestD = Infinity;
      for (const u of this.units) {
        if (faction && u.faction !== faction) continue;
        const d = Math.hypot(u.x - x, u.y - y);
        if (d < u.type.radius + slack && d < bestD) { best = u; bestD = d; }
      }
      return best;
    }
  }

  LOB.Game = Game;
})(window.LOB);
