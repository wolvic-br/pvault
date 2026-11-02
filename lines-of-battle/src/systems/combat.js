/**
 * COMBATE unificado (terra + mar) — regras condicionadas ao domínio.
 *
 * Resolução SIMULTÂNEA: todo dano do tick vai para `pendingDmg` e só é
 * aplicado no fim, então a ordem de iteração não favorece ninguém.
 *
 *  - Corpo a corpo: só entre unidades do MESMO domínio, em contato.
 *    Quem está em contato fica `engaged` (preso: não anda).
 *  - À distância: peltastas e quinquerremes atingem QUALQUER domínio
 *    (dardos na praia, escorpiões contra a costa).
 *  - Abalroamento (triremes/quinquerremes): dano = ram × (vel/velMáx) ×
 *    alinhamento da proa × fator de ângulo (máximo de través, 90°).
 *  - Apoio: navio de apoio cura aliados próximos.
 *  - Modificadores (traits): falange, testudo, flanco.
 */
(function (LOB) {
  const MELEE_REACH = 3;
  const near = [];

  function dealDamage(game, att, def, amount, kind) {
    const tr = def.type.traits;
    if (kind === 'melee' && tr.phalanx && !def.moving) amount *= tr.phalanx;   // falange parada
    if (kind === 'ranged' && tr.testudo) amount *= tr.testudo;                 // testudo
    if (kind === 'melee' && def.target && def.target !== att) amount *= 1.3;   // flanco: alvo ocupado com outro
    def.pendingDmg += amount;
    def.hitFlash = 0.12;
  }

  function tryRam(game, u) {
    const t = u.type;
    for (const e of near) {
      if (e.faction === u.faction || !e.alive || e.type.domain !== 'naval') continue;
      const dx = e.x - u.x, dy = e.y - u.y, d = Math.hypot(dx, dy) || 1;
      if (d > t.radius + e.type.radius + 5) continue;
      const hx = Math.cos(u.heading), hy = Math.sin(u.heading);
      const approach = (hx * dx + hy * dy) / d;         // 1 = proa apontada para o alvo
      const speedRatio = u.speed / t.speed;
      if (approach < 0.5 || speedRatio < 0.3) continue; // sem embalo/ângulo = não é abalroamento
      const angleFactor = 0.3 + 0.7 * Math.abs(Math.sin(u.heading - e.heading)); // de través = máximo
      const dmg = t.ram * speedRatio * approach * angleFactor;
      e.pendingDmg += dmg;
      e.hitFlash = 0.25;
      // física simplificada: alvo é empurrado e perde embalo; atacante quase para
      const T = game.terrain, kx = e.x + hx * 8, ky = e.y + hy * 8;
      if (T.passable(kx, ky, 'naval')) { e.x = kx; e.y = ky; }
      e.speed *= 0.4;
      u.speed *= 0.2;
      u.ramCd = t.ramCooldown;
      game.fx({ kind: 'ram', x: (u.x + e.x) / 2, y: (u.y + e.y) / 2, ttl: 0.9, text: '-' + Math.round(dmg) });
      return;
    }
  }

  function heal(game, u, dt) {
    const t = u.type;
    for (const f of near) {
      if (f === u || f.faction !== u.faction || !f.alive || f.hp >= f.type.hp) continue;
      if (Math.hypot(f.x - u.x, f.y - u.y) > t.healRange) continue;
      f.hp = Math.min(f.type.hp, f.hp + t.heal * dt);
    }
  }

  function updateCombat(game, dt) {
    const units = game.units;
    // o "target" anterior é usado pela regra de flanco, então zeramos depois
    for (const u of units) { u.engaged = false; u._nextTarget = null; }

    for (const u of units) {
      if (!u.alive) continue;
      const t = u.type;
      u.cooldown -= dt; u.ramCd -= dt; u.hitFlash -= dt;
      game.hash.query(u.x, u.y, Math.max(t.range, t.healRange || 0, 30) + 16, near);

      // escolhe alvo: contato corpo a corpo tem prioridade sobre tiro
      let best = null, bestD = Infinity, melee = false;
      for (const e of near) {
        if (e.faction === u.faction || !e.alive) continue;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        const contact = d <= t.radius + e.type.radius + MELEE_REACH && e.type.domain === t.domain;
        if (contact) {
          if (!melee || d < bestD) { best = e; bestD = d; melee = true; }
        } else if (!melee && t.range > 0 && d <= t.range + e.type.radius && d < bestD) {
          best = e; bestD = d;
        }
      }

      if (best) {
        u._nextTarget = best;
        if (melee) {
          u.engaged = true;
          dealDamage(game, u, best, t.strength * dt, 'melee');
          if (Math.random() < dt * 4) game.fx({ kind: 'spark', x: (u.x + best.x) / 2, y: (u.y + best.y) / 2, ttl: 0.25 });
        } else if (u.cooldown <= 0) {
          u.cooldown = t.fireRate;
          dealDamage(game, u, best, t.rangedDmg, 'ranged');
          game.fx({ kind: 'shot', x: u.x, y: u.y, x2: best.x, y2: best.y, ttl: 0.3, faction: u.faction });
        }
      }
      if (t.ram && u.ramCd <= 0) tryRam(game, u);
      if (t.heal && !u.engaged) heal(game, u, dt);
    }

    // aplica dano e remove mortos
    for (const u of units) {
      u.target = u._nextTarget;
      if (u.pendingDmg > 0) { u.hp -= u.pendingDmg; u.pendingDmg = 0; }
      if (u.hp <= 0 && u.alive) {
        u.alive = false;
        game.fx({ kind: 'death', x: u.x, y: u.y, ttl: 0.8, faction: u.faction });
        game.stats[u.faction].lost++;
      }
    }
    game.units = units.filter((u) => u.alive);
  }

  LOB.systems.combat = { updateCombat, dealDamage };
})(window.LOB);
