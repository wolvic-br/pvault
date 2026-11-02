/**
 * CAPTURA DE PONTOS DE CONTROLE.
 *
 * Áreas: 'circle' (x, y, r) ou 'rect' (x, y = centro, w, h).
 * Barra de domínio: `dominance` ∈ [-100, +100]; o sinal indica a facção
 * (Roma +, Grécia −, ver FACTIONS[].sign).
 *  - Só uma facção presente → a barra anda para o lado dela
 *    (RATE × soma dos pesos de captura, limitado a 3).
 *  - As duas presentes → CONTESTADO: a barra congela.
 *  - Ninguém presente → a barra se recupera para o dono (ou volta a 0).
 *  - Dono muda ao chegar a ±100; volta a neutro ao cruzar o 0.
 * O domínio (terra/mar) do ponto é deduzido do terreno no centro.
 */
(function (LOB) {
  const RATE = 9;       // % por segundo por unidade
  const MAX_STACK = 3;  // mais de 3 unidades não acelera
  const near = [];

  function createPoint(def, terrain) {
    const F = LOB.entities.FACTIONS;
    return {
      ...def,
      domain: terrain.isSea(def.x, def.y) ? 'naval' : 'land',
      owner: def.owner || null,
      dominance: def.owner ? F[def.owner].sign * 100 : 0,
      presence: { rome: 0, greece: 0 },
      contested: false,
      bound: def.shape === 'circle' ? def.r : Math.hypot(def.w, def.h) / 2,
    };
  }

  function contains(p, x, y) {
    const dx = x - p.x, dy = y - p.y;
    if (p.shape === 'circle') return dx * dx + dy * dy <= p.r * p.r;
    return Math.abs(dx) <= p.w / 2 && Math.abs(dy) <= p.h / 2;
  }

  function updateCapture(game, dt) {
    const F = LOB.entities.FACTIONS;
    for (const p of game.points) {
      // 1) detecção de presença via spatial hash + teste de forma
      p.presence.rome = 0; p.presence.greece = 0;
      game.hash.query(p.x, p.y, p.bound + 14, near);
      for (const u of near) if (u.alive && contains(p, u.x, u.y)) p.presence[u.faction] += u.type.capture;

      const r = p.presence.rome, g = p.presence.greece;
      p.contested = r > 0 && g > 0;

      // 2) acumula a barra de domínio
      if (r > 0 && g === 0) p.dominance += RATE * Math.min(r, MAX_STACK) * dt;
      else if (g > 0 && r === 0) p.dominance -= RATE * Math.min(g, MAX_STACK) * dt;
      else if (r === 0 && g === 0) {
        const target = p.owner ? F[p.owner].sign * 100 : 0;
        const step = RATE * 0.5 * dt, diff = target - p.dominance;
        p.dominance += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      }
      p.dominance = Math.max(-100, Math.min(100, p.dominance));

      // 3) troca de dono
      const prev = p.owner;
      if (p.dominance >= 100) p.owner = 'rome';
      else if (p.dominance <= -100) p.owner = 'greece';
      else if (p.owner === 'rome' && p.dominance <= 0) p.owner = null;
      else if (p.owner === 'greece' && p.dominance >= 0) p.owner = null;
      if (prev !== p.owner) {
        game.fx({ kind: 'capture', x: p.x, y: p.y, ttl: 1.2, faction: p.owner, r: p.bound });
        game.log(p.owner ? `${F[p.owner].name} conquistou ${p.name}` : `${p.name} está neutro`);
      }
    }
  }

  LOB.systems.capture = { createPoint, contains, updateCapture, RATE };
})(window.LOB);
