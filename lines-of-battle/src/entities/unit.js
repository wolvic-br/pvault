/**
 * Fábrica de unidades. Unidades são objetos simples (dados), e toda a lógica
 * vive nos sistemas — padrão "entidade + sistemas", fácil de serializar,
 * testar e estender.
 */
(function (LOB) {
  let nextId = 1;

  function createUnit(typeKey, faction, x, y) {
    const type = LOB.entities.UNIT_TYPES[typeKey];
    if (!type) throw new Error('Tipo de unidade desconhecido: ' + typeKey);
    return {
      id: nextId++,
      typeKey, type, faction,
      x, y, px: x, py: y,              // posição atual e do tick anterior (interpolação)
      hp: type.hp,
      heading: faction === 'rome' ? 0 : Math.PI,
      speed: 0,                        // velocidade escalar atual (navios têm inércia)
      path: null, pathIdx: 0,          // rota (polilinha) e segmento atual
      moving: false, stuck: 0,
      engaged: false,                  // em corpo a corpo → fica "preso" no lugar
      target: null,
      cooldown: 0, ramCd: 0,
      pendingDmg: 0,                   // dano acumulado no tick (resolução simultânea)
      hitFlash: 0,
      alive: true,
      aiGoal: null,
    };
  }

  LOB.entities.createUnit = createUnit;
})(window.LOB);
