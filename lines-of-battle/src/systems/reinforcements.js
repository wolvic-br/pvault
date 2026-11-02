/**
 * REFORÇOS: enquanto uma facção controla sua capital, recebe periodicamente
 * uma tropa terrestre e um navio (ordem cíclica definida no mapa).
 * Perder a capital corta os reforços — incentivo para defendê-la.
 */
(function (LOB) {
  const LAND_INTERVAL = 18, NAVAL_INTERVAL = 32, UNIT_CAP = 40;

  function createState() {
    return { land: LAND_INTERVAL, naval: NAVAL_INTERVAL, landIdx: 0, navalIdx: 0 };
  }

  function spawnNear(game, typeKey, faction, at) {
    const domain = LOB.entities.UNIT_TYPES[typeKey].domain;
    for (let tries = 0; tries < 20; tries++) {
      const x = at.x + (Math.random() - 0.5) * 50, y = at.y + (Math.random() - 0.5) * 50;
      if (game.terrain.passable(x, y, domain)) return game.spawn(typeKey, faction, x, y);
    }
    return null;
  }

  function updateReinforcements(game, dt) {
    for (const f of Object.keys(game.reinf)) {
      const s = game.reinf[f];
      const capital = game.points.find((p) => p.capital === f);
      const active = capital && capital.owner === f;
      const count = game.units.filter((u) => u.faction === f).length;
      s.land -= dt; s.naval -= dt;
      if (s.land <= 0) {
        s.land = LAND_INTERVAL;
        if (active && count < UNIT_CAP) {
          const roster = game.map.rosters[f].land;
          spawnNear(game, roster[s.landIdx++ % roster.length], f, game.map.spawns[f].land);
        }
      }
      if (s.naval <= 0) {
        s.naval = NAVAL_INTERVAL;
        if (active && count < UNIT_CAP) {
          const roster = game.map.rosters[f].naval;
          spawnNear(game, roster[s.navalIdx++ % roster.length], f, game.map.spawns[f].naval);
        }
      }
    }
  }

  LOB.systems.reinforcements = { createState, updateReinforcements, LAND_INTERVAL, NAVAL_INTERVAL };
})(window.LOB);
