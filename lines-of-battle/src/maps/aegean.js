/**
 * MAPA "Mar Interior" — dados puros. Um mar central (mar Egeu estilizado)
 * separa Roma (oeste) e Grécia (leste); duas faixas de terra ao norte e ao
 * sul ligam os dois lados. O mapa é espelhado (justo para os dois lados).
 *
 * heightAt(x, y): < 0 = mar, >= 0 = terra. Qualquer função serve — para criar
 * outro mapa basta copiar este arquivo e mudar a função e os pontos.
 */
(function (LOB) {
  const W = 1280, H = 720;
  const mirror = (p) => ({ ...p, x: W - p.x });

  function heightAt(x, y) {
    const nx = (x - W / 2) / 380, ny = (y - H / 2) / 245;
    const d = Math.hypot(nx, ny);
    const a = Math.atan2(ny, Math.abs(nx)); // |nx| → simetria espelhada
    const wobble = 0.06 * Math.sin(a * 5 + 1.3) + 0.04 * Math.sin(a * 9 + 0.4) + 0.03 * Math.sin(a * 13 + 2.1);
    return d - 1 - wobble;
  }

  // Exército inicial de Roma (o da Grécia é o espelho, com tropas gregas).
  const romeLand = [
    ['legionary', 175, 320], ['legionary', 175, 360], ['legionary', 175, 400],
    ['peltast', 150, 290], ['praetorian', 140, 360],
  ];
  const greeceLandTypes = ['hoplite', 'hoplite', 'hoplite', 'peltast', 'hoplite'];
  const navy = [['trireme', 300, 320], ['trireme', 300, 400], ['quinquereme', 330, 360], ['support', 285, 360]];

  const romeArmy = [...romeLand, ...navy];
  const greeceArmy = [
    ...romeLand.map(([_, x, y], i) => [greeceLandTypes[i], W - x, y]),
    ...navy.map(([t, x, y]) => [t, W - x, y]),
  ];

  const westPoints = [
    { id: 'roma', name: 'Roma', shape: 'circle', x: 100, y: 360, r: 46, owner: 'rome', capital: 'rome' },
    { id: 'salamina', name: 'Salamina', shape: 'circle', x: 470, y: 255, r: 40 },
  ];

  LOB.maps.aegean = {
    id: 'aegean',
    name: 'Mar Interior',
    width: W, height: H, tile: 8,
    heightAt,
    points: [
      ...westPoints,
      { ...mirror(westPoints[0]), id: 'atenas', name: 'Atenas', owner: 'greece', capital: 'greece' },
      { ...mirror(westPoints[1]), id: 'accio', name: 'Áccio', y: 465 },
      { id: 'delos', name: 'Delos', shape: 'circle', x: 640, y: 360, r: 44 },
      { id: 'termopilas', name: 'Termópilas', shape: 'rect', x: 640, y: 62, w: 150, h: 56 },
      { id: 'corinto', name: 'Corinto', shape: 'rect', x: 640, y: 664, w: 150, h: 56 },
    ],
    armies: { rome: romeArmy, greece: greeceArmy },
    // pontos de surgimento de reforços
    spawns: {
      rome:   { land: { x: 120, y: 360 }, naval: { x: 300, y: 360 } },
      greece: { land: { x: W - 120, y: 360 }, naval: { x: W - 300, y: 360 } },
    },
    // ordem de recrutamento (cíclica)
    rosters: {
      rome:   { land: ['legionary', 'legionary', 'peltast', 'praetorian'], naval: ['trireme', 'quinquereme', 'trireme', 'support'] },
      greece: { land: ['hoplite', 'hoplite', 'peltast', 'hoplite', 'peltast'], naval: ['trireme', 'trireme', 'quinquereme', 'support'] },
    },
    // nós de rota (usados só pela IA para contornar o mar/costa)
    waypoints: {
      land: [
        { x: 230, y: 90 }, { x: 640, y: 62 }, { x: W - 230, y: 90 },
        { x: 230, y: 640 }, { x: 640, y: 664 }, { x: W - 230, y: 640 },
        { x: 140, y: 200 }, { x: 140, y: 520 }, { x: W - 140, y: 200 }, { x: W - 140, y: 520 },
      ],
      naval: [
        { x: 360, y: 360 }, { x: 640, y: 210 }, { x: 640, y: 510 }, { x: W - 360, y: 360 },
        { x: 470, y: 255 }, { x: 810, y: 465 }, { x: 470, y: 465 }, { x: 810, y: 255 },
      ],
    },
  };
})(window.LOB);
