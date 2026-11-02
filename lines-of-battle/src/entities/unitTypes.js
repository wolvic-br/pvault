/**
 * TABELA DE DADOS das unidades e facções.
 * Para adicionar uma unidade nova basta criar uma entrada aqui (e, se quiser,
 * um ícone em assets/icons.js). Os sistemas leem só estes atributos:
 *
 *  domain     'land' | 'naval'   → define onde pode andar (terrain.passable)
 *  speed      px/s (navios: velocidade máxima, alcançada com aceleração)
 *  strength   dano corpo a corpo por segundo
 *  hp         pontos de vida
 *  range      alcance de ataque à distância (0 = só corpo a corpo)
 *  rangedDmg  dano por disparo / fireRate  intervalo entre disparos (s)
 *  radius     tamanho do "ponto" no mapa (colisão e captura)
 *  capture    peso na captura de pontos de controle
 *  traits     regras especiais lidas pelo combate (ver systems/combat.js)
 *  naval:     accel (px/s²), turnRate (rad/s), ram (dano base de abalroamento),
 *             ramCooldown, heal/healRange (navio de apoio)
 */
(function (LOB) {
  const FACTIONS = {
    rome:   { id: 'rome',   name: 'Roma',   color: '#a8322a', light: '#d9776b', sign: +1 },
    greece: { id: 'greece', name: 'Grécia', color: '#2b5a96', light: '#7aa0d1', sign: -1 },
  };

  const UNIT_TYPES = {
    // ---------------- TERRESTRES ----------------
    hoplite: {
      name: 'Hoplitas', origin: 'Grécia', domain: 'land', icon: 'hoplite',
      speed: 32, strength: 9, hp: 130, range: 0, radius: 9, capture: 1,
      traits: { phalanx: 0.6 }, // recebe 60% do dano corpo a corpo quando parado
      desc: 'Falange: muito resistente quando parada.',
    },
    legionary: {
      name: 'Legionários', origin: 'Roma', domain: 'land', icon: 'legionary',
      speed: 38, strength: 10, hp: 115, range: 0, radius: 9, capture: 1,
      traits: { testudo: 0.5 }, // recebe 50% do dano à distância
      desc: 'Testudo: metade do dano de projéteis.',
    },
    peltast: {
      name: 'Peltastas', origin: 'Trácia', domain: 'land', icon: 'peltast',
      speed: 52, strength: 4, hp: 70, range: 90, rangedDmg: 9, fireRate: 1.2, radius: 7, capture: 1,
      traits: { skirmisher: true },
      desc: 'Rápidos; dardos a distância (atingem navios na costa).',
    },
    praetorian: {
      name: 'Pretorianos', origin: 'Roma', domain: 'land', icon: 'praetorian',
      speed: 36, strength: 16, hp: 160, range: 0, radius: 10, capture: 2,
      traits: { elite: true },
      desc: 'Elite: dano alto, capturam em dobro.',
    },
    // ---------------- NAVAIS ----------------
    trireme: {
      name: 'Triremes', origin: 'Mediterrâneo', domain: 'naval', icon: 'trireme',
      speed: 78, accel: 38, turnRate: 2.0, strength: 3, hp: 100, range: 0, radius: 10, capture: 1,
      ram: 70, ramCooldown: 2.5,
      traits: {},
      desc: 'Abalroamento: dano por velocidade + ângulo (melhor de través).',
    },
    quinquereme: {
      name: 'Quinquerremes', origin: 'Mediterrâneo', domain: 'naval', icon: 'quinquereme',
      speed: 50, accel: 20, turnRate: 1.2, strength: 6, hp: 190, range: 80, rangedDmg: 11, fireRate: 1.6,
      radius: 13, capture: 2, ram: 30, ramCooldown: 3.5,
      traits: {},
      desc: 'Pesada: escorpiões a distância (atinge a costa), aríete fraco.',
    },
    support: {
      name: 'Navio de apoio', origin: 'Mediterrâneo', domain: 'naval', icon: 'support',
      speed: 58, accel: 30, turnRate: 1.8, strength: 1, hp: 80, range: 0, radius: 9, capture: 1,
      heal: 5, healRange: 90,
      traits: {},
      desc: 'Repara navios e tropas aliadas próximas (5 hp/s).',
    },
  };

  LOB.entities.FACTIONS = FACTIONS;
  LOB.entities.UNIT_TYPES = UNIT_TYPES;
})(window.LOB);
