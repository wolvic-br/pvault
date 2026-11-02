/**
 * Spatial hash uniforme: divide o mundo em células de tamanho fixo.
 * Consultas de vizinhança custam O(unidades nas células próximas) em vez de
 * O(N) — com N unidades, o combate cai de O(N²) para ~O(N).
 * Reconstruído a cada tick (barato: só pushes em arrays).
 */
(function (LOB) {
  class SpatialHash {
    constructor(cellSize = 64) {
      this.cell = cellSize;
      this.buckets = new Map();
    }
    _key(cx, cy) { return (cx + 1024) * 4096 + (cy + 1024); }

    clear() { this.buckets.clear(); }

    insert(obj) {
      const k = this._key(Math.floor(obj.x / this.cell), Math.floor(obj.y / this.cell));
      let b = this.buckets.get(k);
      if (!b) { b = []; this.buckets.set(k, b); }
      b.push(obj);
    }

    rebuild(list) {
      this.clear();
      for (let i = 0; i < list.length; i++) if (list[i].alive) this.insert(list[i]);
    }

    /**
     * Retorna em `out` (array reaproveitado, sem alocação) os objetos das
     * células que tocam o quadrado de raio r. O filtro fino por distância
     * fica a cargo de quem chama.
     */
    query(x, y, r, out) {
      out.length = 0;
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const b = this.buckets.get(this._key(cx, cy));
          if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
      }
      return out;
    }
  }

  LOB.core.SpatialHash = SpatialHash;
})(window.LOB);
