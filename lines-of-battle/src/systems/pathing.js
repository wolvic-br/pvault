/**
 * PATHING — transforma a LINHA desenhada pelo jogador em rotas por unidade.
 * Sem A*: a rota é a própria linha (polilinha), apenas
 *   1) amostrada/simplificada,
 *   2) deslocada por unidade para manter a formação,
 *   3) cortada no primeiro ponto onde o terreno é proibido para aquele
 *      domínio (tropa entrando no mar, navio subindo na terra).
 *
 * A IA usa um grafo minúsculo de waypoints feitos à mão (Router) só para
 * contornar a costa — também sem A* em grade.
 */
(function (LOB) {
  const { V } = LOB.core;

  /** Adiciona um ponto ao traço só se estiver a >= minDist do anterior. */
  function addStrokePoint(stroke, p, minDist = 8) {
    const last = stroke[stroke.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) stroke.push({ x: p.x, y: p.y });
  }

  /** Corta a rota no primeiro trecho intransitável (amostragem a cada 4px). */
  function clipToTerrain(path, domain, terrain) {
    const out = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(d / 4));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (!terrain.passable(x, y, domain)) {
          // guarda o último ponto válido antes da costa
          const tb = (s - 1) / steps;
          if (s > 1) out.push({ x: a.x + (b.x - a.x) * tb, y: a.y + (b.y - a.y) * tb });
          return out;
        }
      }
      out.push(b);
    }
    return out;
  }

  /**
   * Gera rotas para cada unidade selecionada a partir de um traço.
   * O traço começa na unidade-âncora; cada unidade recebe o mesmo traço
   * deslocado pelo seu offset em relação à âncora (limitado a `maxSpread`),
   * preservando a formação ("linha de batalha").
   */
  function buildPaths(units, stroke, anchor, terrain, maxSpread = 60) {
    const result = new Map();
    const ax = anchor ? anchor.x : stroke[0].x, ay = anchor ? anchor.y : stroke[0].y;
    for (const u of units) {
      let ox = u.x - ax, oy = u.y - ay;
      const ol = Math.hypot(ox, oy);
      if (ol > maxSpread) { ox *= maxSpread / ol; oy *= maxSpread / ol; }
      const raw = [{ x: u.x, y: u.y }];
      for (let i = 1; i < stroke.length; i++) raw.push({ x: stroke[i].x + ox, y: stroke[i].y + oy });
      const path = clipToTerrain(raw, u.type.domain, terrain);
      if (path.length >= 2 && V.polylineLength(path) > 6) result.set(u, path);
    }
    return result;
  }

  /** Atribui uma rota. append=true (Shift) encadeia na rota atual. */
  function assignPath(u, path, append = false) {
    if (append && u.path && u.path.length) {
      u.path = u.path.concat(path.slice(1));
    } else {
      u.path = path;
      u.pathIdx = 0;
    }
    u.stuck = 0;
  }

  /**
   * Router: grafo de visibilidade entre waypoints (pré-calculado uma vez).
   * route(a, b) liga a e b aos nós visíveis e roda Dijkstra em ~10 nós.
   */
  class Router {
    constructor(terrain, nodes, domain) {
      this.terrain = terrain;
      this.domain = domain;
      this.nodes = nodes.filter((n) => terrain.passable(n.x, n.y, domain));
      this.edges = this.nodes.map((a) => this.nodes
        .map((b, j) => ({ j, d: V.dist(a, b) }))
        .filter((e) => e.d > 0 && terrain.segmentClear(a, this.nodes[e.j], domain)));
    }

    route(from, to) {
      const T = this.terrain, D = this.domain;
      if (T.segmentClear(from, to, D)) return [{ x: to.x, y: to.y }];
      const N = this.nodes.length, START = N, GOAL = N + 1;
      const dist = new Array(N + 2).fill(Infinity), prev = new Array(N + 2).fill(-1), done = new Array(N + 2).fill(false);
      const goalLinks = this.nodes.map((n) => (T.segmentClear(n, to, D) ? V.dist(n, to) : Infinity));
      dist[START] = 0;
      for (let iter = 0; iter < N + 2; iter++) {
        let u = -1;
        for (let i = 0; i < N + 2; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || dist[u] === Infinity) break;
        if (u === GOAL) break;
        done[u] = true;
        const relax = (v, w) => { if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } };
        if (u === START) {
          this.nodes.forEach((n, i) => { if (T.segmentClear(from, n, D)) relax(i, V.dist(from, n)); });
        } else {
          for (const e of this.edges[u]) relax(e.j, e.d);
          if (goalLinks[u] < Infinity) relax(GOAL, goalLinks[u]);
        }
      }
      if (dist[GOAL] === Infinity) return null;
      const out = [];
      for (let v = GOAL; v !== START; v = prev[v]) out.push(v === GOAL ? { x: to.x, y: to.y } : { ...this.nodes[v] });
      return out.reverse();
    }
  }

  LOB.systems.pathing = { addStrokePoint, clipToTerrain, buildPaths, assignPath, Router };
})(window.LOB);
