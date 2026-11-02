/**
 * Teste headless (Node, sem navegador): carrega a engine sem DOM, valida o
 * mapa e simula partidas IA × IA. Uso:  node tests/headless.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, Math, console, performance: { now: () => 0 } };
ctx.window = ctx;
vm.createContext(ctx);
const files = [
  'core/namespace.js', 'core/math.js', 'core/spatialHash.js', 'core/terrain.js', 'core/loop.js',
  'entities/unitTypes.js', 'entities/unit.js', 'maps/aegean.js',
  'systems/pathing.js', 'systems/movement.js', 'systems/combat.js', 'systems/capture.js',
  'systems/reinforcements.js', 'systems/ai.js', 'game.js',
];
for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
const LOB = ctx.LOB;

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; };

console.log('Mapa');
const map = LOB.maps.aegean;
const game0 = new LOB.Game(map);
for (const p of game0.points) console.log(`  ${p.name.padEnd(11)} domínio=${p.domain}`);
check(game0.points.filter((p) => p.domain === 'naval').length === 3, '3 pontos navais');
check(game0.points.filter((p) => p.domain === 'land').length === 4, '4 pontos terrestres');
check(game0.units.every((u) => game0.terrain.passable(u.x, u.y, u.type.domain)), 'todas as unidades iniciais em terreno válido');
for (const f of ['rome', 'greece']) for (const d of ['land', 'naval']) {
  const s = map.spawns[f][d];
  check(game0.terrain.passable(s.x, s.y, d), `spawn ${f}/${d} válido`);
}
check(game0.routers.land.nodes.length === map.waypoints.land.length, 'waypoints terrestres válidos');
check(game0.routers.naval.nodes.length === map.waypoints.naval.length, 'waypoints navais válidos');
const r = game0.routers.land.route({ x: 100, y: 360 }, { x: 1180, y: 360 });
check(!!r, 'rota terrestre Roma → Atenas existe (via istmo): ' + (r && r.map((p) => `(${p.x|0},${p.y|0})`).join(' ')));

console.log('Linha desenhada');
const leg = game0.units.find((u) => u.typeKey === 'legionary');
const stroke = [{ x: leg.x, y: leg.y }, { x: 260, y: 360 }, { x: 400, y: 360 }]; // entra no mar
const paths = game0.commandStroke([leg], stroke, leg);
const p = paths.get(leg);
check(p && p.every((q) => game0.terrain.isLand(q.x, q.y)), 'rota cortada na costa (tropa não entra no mar)');

console.log('Abalroamento');
{
  const g = new LOB.Game(map, { aiFactions: [] });
  g.units = [];
  const a = g.spawn('trireme', 'rome', 560, 360); a.heading = 0; a.speed = a.type.speed;
  const b = g.spawn('trireme', 'greece', 582, 360); b.heading = Math.PI / 2;
  const hp0 = b.hp; g.update(1 / 30);
  const broadside = hp0 - b.hp;
  const g2 = new LOB.Game(map, { aiFactions: [] }); g2.units = [];
  const c = g2.spawn('trireme', 'rome', 560, 360); c.heading = 0; c.speed = c.type.speed * 0.5;
  const d = g2.spawn('trireme', 'greece', 582, 360); d.heading = Math.PI; // de frente
  g2.update(1 / 30);
  const headOnSlow = d.type.hp - d.hp;
  check(broadside > 50, `ram de través a toda velocidade: ${broadside.toFixed(1)} de dano`);
  check(headOnSlow < broadside / 3, `ram de frente a meia velocidade: ${headOnSlow.toFixed(1)} de dano`);
}

console.log('Simulação IA × IA');
for (let seed = 0; seed < 3; seed++) {
  const g = new LOB.Game(map, { aiFactions: ['rome', 'greece'] });
  let rams = 0;
  const fx = g.fx.bind(g);
  g.fx = (e) => { if (e.kind === 'ram') rams++; fx(e); };
  const t0 = Date.now();
  let steps = 0;
  while (!g.winner && g.time < 900) { g.update(1 / 30); steps++; }
  const ms = (Date.now() - t0) / steps;
  console.log(`  partida ${seed + 1}: ${g.winner || 'sem vencedor'} (${g.winReason || '-'}) em ${g.time.toFixed(0)}s · VP R${g.vp.rome|0}/G${g.vp.greece|0} · ` +
    `unidades ${g.units.length} · abalroamentos ${rams} · ${ms.toFixed(3)} ms/tick · donos: ${g.points.map((p) => p.owner ? p.owner[0] : '-').join('')}`);
  check(g.points.some((p) => !p.capital && p.owner), 'pontos neutros foram capturados');
  check(ms < 4, 'tick abaixo de 4 ms');
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo ok');
process.exit(failures ? 1 : 0);
