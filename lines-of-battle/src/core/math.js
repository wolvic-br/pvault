/** Utilitários vetoriais mínimos (objetos {x, y}, sem classes para evitar GC). */
(function (LOB) {
  const TAU = Math.PI * 2;

  const V = {
    TAU,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; },
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,

    /** Menor diferença angular de a para b, em [-PI, PI]. */
    angleDiff(a, b) {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d;
    },

    /** Projeta P no segmento AB. Retorna ponto projetado e t∈[0,1]. */
    projectOnSegment(px, py, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return { x: a.x + dx * t, y: a.y + dy * t, t };
    },

    /** Comprimento total de uma polilinha. */
    polylineLength(pts) {
      let L = 0;
      for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return L;
    },
  };

  LOB.core.V = V;
})(window.LOB);
