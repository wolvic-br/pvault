/**
 * MOVIMENTO por vetores simples (sem A*).
 *
 * Seguimento de rota = "pure pursuit":
 *   a cada tick a unidade se projeta na polilinha (só nos próximos segmentos)
 *   e mira um ponto `lookahead` px à frente na linha. Se for empurrada em
 *   combate ou desviar da costa, a trajetória é RECALCULADA naturalmente no
 *   tick seguinte — ela volta suavemente para a linha desenhada.
 *
 * Terra: velocidade instantânea; desliza pelos eixos ao bater na costa.
 * Mar:   inércia (aceleração), taxa máxima de giro e perda de velocidade em
 *        curvas fechadas — base para a mecânica de abalroamento.
 */
(function (LOB) {
  const { V } = LOB.core;
  const near = []; // buffer reaproveitado de consultas ao spatial hash

  /** Retorna {x, y} (direção normalizada) + slow, ou null se chegou. */
  function followPath(u) {
    const p = u.path;
    const naval = u.type.domain === 'naval';
    const lookahead = naval ? 36 : 18;
    const end = p[p.length - 1];
    const dEnd = Math.hypot(end.x - u.x, end.y - u.y);
    if (dEnd < (naval ? 14 : 5)) return null;

    // 1) projeção no segmento mais próximo (janela de 4 segmentos à frente)
    let bestI = u.pathIdx, bestD = Infinity, proj = p[0];
    const last = Math.min(p.length - 1, u.pathIdx + 4);
    for (let i = u.pathIdx; i < last; i++) {
      const pr = V.projectOnSegment(u.x, u.y, p[i], p[i + 1]);
      const d = (pr.x - u.x) ** 2 + (pr.y - u.y) ** 2;
      if (d < bestD) { bestD = d; bestI = i; proj = pr; }
    }
    u.pathIdx = bestI;

    // 2) caminha `lookahead` px pela linha a partir da projeção
    let cx = proj.x, cy = proj.y, rem = lookahead, i = bestI;
    while (i < p.length - 1 && rem > 0) {
      const nx = p[i + 1].x, ny = p[i + 1].y;
      const seg = Math.hypot(nx - cx, ny - cy);
      if (seg >= rem) { cx += ((nx - cx) / seg) * rem; cy += ((ny - cy) / seg) * rem; rem = 0; }
      else { rem -= seg; cx = nx; cy = ny; i++; }
    }

    const dx = cx - u.x, dy = cy - u.y, L = Math.hypot(dx, dy) || 1;
    // navios desaceleram ao se aproximar do fim da rota
    return { x: dx / L, y: dy / L, slow: naval ? V.clamp(dEnd / 60, 0.3, 1) : 1 };
  }

  /**
   * Unidades ociosas reagem a inimigos próximos (zona de controle):
   * corpo a corpo avança; atiradores se aproximam até o alcance;
   * triremes caçam navios para abalroar (com mira adiantada).
   */
  function autoEngage(game, u) {
    const t = u.type;
    const aggro = t.ram ? 170 : t.range > 0 ? t.range + 30 : 70;
    game.hash.query(u.x, u.y, aggro, near);
    let best = null, bestD = aggro;
    for (const e of near) {
      if (e.faction === u.faction || !e.alive) continue;
      if (t.range === 0 && e.type.domain !== t.domain) continue; // corpo a corpo só no mesmo terreno
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return null;
    if (t.range > 0 && bestD < t.range * 0.85) return null; // já está no alcance: segura
    let tx = best.x, ty = best.y;
    if (t.ram && best.type.domain === 'naval') { // mira adiantada
      tx += Math.cos(best.heading) * best.speed * 0.6;
      ty += Math.sin(best.heading) * best.speed * 0.6;
    }
    const dx = tx - u.x, dy = ty - u.y, L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L, slow: 1 };
  }

  function moveLand(game, u, dir, dt) {
    if (!dir || u.engaged) { u.moving = false; return; }
    const T = game.terrain, step = u.type.speed * dt;
    const nx = u.x + dir.x * step, ny = u.y + dir.y * step;
    if (T.passable(nx, ny, 'land')) { u.x = nx; u.y = ny; }
    else if (T.passable(nx, u.y, 'land')) u.x = nx;      // desliza em X
    else if (T.passable(u.x, ny, 'land')) u.y = ny;      // desliza em Y
    else u.stuck += dt;
    u.heading = Math.atan2(dir.y, dir.x);
    u.speed = u.type.speed;
    u.moving = true;
  }

  function moveNaval(game, u, dir, dt) {
    const t = u.type, T = game.terrain;
    let targetSpeed = 0;
    if (dir) {
      const desired = Math.atan2(dir.y, dir.x);
      const diff = V.angleDiff(u.heading, desired);
      const maxTurn = t.turnRate * dt;
      u.heading += V.clamp(diff, -maxTurn, maxTurn);
      // curva fechada = perde velocidade
      targetSpeed = t.speed * (1 - 0.65 * Math.min(1, Math.abs(diff) / (Math.PI / 2))) * dir.slow;
    }
    if (u.engaged) targetSpeed = Math.min(targetSpeed, t.speed * 0.15); // abordagem: navios presos
    // inércia
    if (u.speed < targetSpeed) u.speed = Math.min(targetSpeed, u.speed + t.accel * dt);
    else u.speed = Math.max(targetSpeed, u.speed - t.accel * 1.5 * dt);

    const vx = Math.cos(u.heading) * u.speed * dt, vy = Math.sin(u.heading) * u.speed * dt;
    const nx = u.x + vx, ny = u.y + vy;
    if (T.passable(nx, ny, 'naval')) { u.x = nx; u.y = ny; }
    else { // encalhou na costa: perde quase todo o embalo e tenta deslizar
      u.speed *= 0.3;
      if (T.passable(nx, u.y, 'naval')) u.x = nx;
      else if (T.passable(u.x, ny, 'naval')) u.y = ny;
      else u.stuck += dt;
    }
    u.moving = u.speed > 3;
  }

  function updateMovement(game, dt) {
    for (const u of game.units) {
      if (!u.alive) continue;
      let dir = null;
      if (u.path) {
        dir = followPath(u);
        if (!dir) u.path = null; // chegou ao fim da linha
      }
      if (!dir) dir = autoEngage(game, u);
      if (u.type.domain === 'land') moveLand(game, u, dir, dt);
      else moveNaval(game, u, dir, dt);
      // preso há muito tempo (canto côncavo da costa): desiste da rota
      if (u.stuck > 1.5) { u.path = null; u.stuck = 0; }
    }
  }

  /**
   * Separação: empurra pares sobrepostos (mesmo domínio). Inimigos são
   * "sólidos" → formam linhas de frente em vez de se atravessarem.
   */
  function resolveCollisions(game) {
    const T = game.terrain;
    for (const u of game.units) {
      if (!u.alive) continue;
      const ru = u.type.radius;
      game.hash.query(u.x, u.y, ru * 2 + 6, near);
      for (const e of near) {
        if (e.id <= u.id || !e.alive || e.type.domain !== u.type.domain) continue;
        const minD = ru + e.type.radius;
        let dx = e.x - u.x, dy = e.y - u.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (minD - d) * (e.faction === u.faction ? 0.25 : 0.5);
        const px = (dx / d) * push, py = (dy / d) * push;
        if (T.passable(u.x - px, u.y - py, u.type.domain)) { u.x -= px; u.y -= py; }
        if (T.passable(e.x + px, e.y + py, e.type.domain)) { e.x += px; e.y += py; }
      }
    }
  }

  LOB.systems.movement = { updateMovement, resolveCollisions, followPath };
})(window.LOB);
