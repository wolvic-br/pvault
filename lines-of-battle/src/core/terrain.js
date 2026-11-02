/**
 * Terreno: rasteriza a função de altura do mapa (h<0 = mar, h>=0 = terra)
 * em uma grade de tiles para consultas O(1), e pré-renderiza o visual em um
 * canvas offscreen (desenhado UMA vez — renderização incremental).
 */
(function (LOB) {
  const LAND = 0, SEA = 1, BLOCKED = 255;

  class Terrain {
    constructor(map) {
      this.map = map;
      this.w = map.width;
      this.h = map.height;
      this.tile = map.tile;
      this.cols = Math.ceil(this.w / this.tile);
      this.rows = Math.ceil(this.h / this.tile);
      this.grid = new Uint8Array(this.cols * this.rows);
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const x = (c + 0.5) * this.tile, y = (r + 0.5) * this.tile;
          this.grid[r * this.cols + c] = map.heightAt(x, y) < 0 ? SEA : LAND;
        }
      }
      this.canvas = null; // criado sob demanda por prerender()
    }

    typeAt(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return BLOCKED;
      return this.grid[((y / this.tile) | 0) * this.cols + ((x / this.tile) | 0)];
    }
    isSea(x, y) { return this.typeAt(x, y) === SEA; }
    isLand(x, y) { return this.typeAt(x, y) === LAND; }

    /** Regra central de terreno: navios só no mar, tropas só em terra. */
    passable(x, y, domain) {
      const t = this.typeAt(x, y);
      return domain === 'naval' ? t === SEA : t === LAND;
    }

    /** Amostra o segmento AB a cada meio tile; true se todo ele é transitável. */
    segmentClear(a, b, domain) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(d / (this.tile * 0.5)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (!this.passable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, domain)) return false;
      }
      return true;
    }

    /** Desenha o mapa em um canvas offscreen com resolução `scale`× o mundo. */
    prerender(scale = 2) {
      const W = Math.ceil(this.w * scale), H = Math.ceil(this.h * scale);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(W, H);
      const d = img.data;
      const P = LOB.core.palette;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const h = this.map.heightAt(px / scale, py / scale);
          let c;
          if (h < -0.012) {          // mar: escurece com a "profundidade"
            const k = Math.min(1, -h * 3);
            c = mix(P.seaShallow, P.seaDeep, k);
          } else if (h < 0.012) {    // linha de costa
            c = P.coast;
          } else {                   // terra: leve gradiente interior
            const k = Math.min(1, h * 2.5);
            c = mix(P.landCoast, P.landInner, k);
          }
          const i = (py * W + px) * 4;
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // grade sutil de "mapa de campanha"
      ctx.strokeStyle = 'rgba(60,50,30,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 80 * scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 80 * scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      this.canvas = cv;
      return cv;
    }
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  LOB.core.palette = {
    seaShallow: [176, 200, 205],
    seaDeep: [122, 156, 170],
    coast: [92, 84, 66],
    landCoast: [232, 222, 196],
    landInner: [214, 202, 168],
  };
  LOB.core.Terrain = Terrain;
  LOB.core.TERRAIN = { LAND, SEA, BLOCKED };
})(window.LOB);
