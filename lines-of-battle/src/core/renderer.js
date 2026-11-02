/**
 * RENDERIZADOR Canvas 2D.
 * Camadas:
 *  1. terreno — pré-renderizado UMA vez (canvas offscreen), só é copiado;
 *  2. pontos de controle (área + barra de domínio);
 *  3. rotas (linhas) do jogador + traço em desenho;
 *  4. unidades (posições interpoladas) + barras de vida + seleção;
 *  5. efeitos (tiros, abalroamentos, capturas).
 * O HUD é DOM e atualiza poucas vezes por segundo (ui/hud.js).
 */
(function (LOB) {
  const { FACTIONS } = LOB.entities;
  const { drawUnit } = LOB.assets.icons;
  const NEUTRAL = '#8a8170';

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.setGame(game);
      this.scale = 1; this.ox = 0; this.oy = 0; this.dpr = 1;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    setGame(game) {
      this.game = game;
      this.terrainImg = game.terrain.canvas || game.terrain.prerender(2);
    }

    /** Ajusta o canvas à janela mantendo a proporção do mundo (letterbox). */
    resize() {
      const { width: W, height: H } = this.game.map;
      const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(cw * this.dpr);
      this.canvas.height = Math.round(ch * this.dpr);
      this.scale = Math.min(cw / W, ch / H);
      this.ox = (cw - W * this.scale) / 2;
      this.oy = (ch - H * this.scale) / 2;
    }

    /** Converte coordenadas do cliente (mouse/toque) para o mundo. */
    toWorld(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    render(alpha, input) {
      const ctx = this.ctx, g = this.game;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1d1a15';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const s = this.scale * this.dpr;
      ctx.setTransform(s, 0, 0, s, this.ox * this.dpr, this.oy * this.dpr);

      ctx.drawImage(this.terrainImg, 0, 0, g.map.width, g.map.height); // camada estática
      for (const p of g.points) this.drawPoint(p);
      this.drawPaths(input);
      for (const u of g.units) {
        const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
        const sel = input && input.selection.has(u);
        if (sel) {
          ctx.strokeStyle = '#f4e9c8'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, u.type.radius + 6, 0, Math.PI * 2); ctx.stroke();
        }
        if (u.typeKey === 'support' && sel) {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(x, y, u.type.healRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        if (u.type.range > 0 && sel) {
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([2, 5]);
          ctx.beginPath(); ctx.arc(x, y, u.type.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        drawUnit(ctx, u, x, y, FACTIONS[u.faction].color);
        this.drawHp(u, x, y);
      }
      this.drawEffects();
      if (input) this.drawInputOverlay(input);
    }

    drawPoint(p) {
      const ctx = this.ctx;
      const lead = p.dominance > 0 ? 'rome' : p.dominance < 0 ? 'greece' : null;
      const col = p.owner ? FACTIONS[p.owner].color : NEUTRAL;
      const pulse = p.contested ? 0.5 + 0.5 * Math.sin(this.game.time * 10) : 0;

      // área
      ctx.beginPath();
      if (p.shape === 'circle') ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      else ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      ctx.globalAlpha = p.owner ? 0.2 : 0.1;
      ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = p.contested ? 2 + pulse * 1.5 : 1.5;
      ctx.strokeStyle = p.contested ? `rgba(240,200,80,${0.6 + pulse * 0.4})` : col;
      ctx.setLineDash(p.owner ? [] : [5, 4]);
      ctx.stroke(); ctx.setLineDash([]);

      // anel de progresso (círculo) — fração do domínio do líder
      if (p.shape === 'circle' && lead) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 4, -Math.PI / 2, -Math.PI / 2 + (Math.abs(p.dominance) / 100) * Math.PI * 2);
        ctx.strokeStyle = FACTIONS[lead].color; ctx.lineWidth = 3; ctx.stroke();
      }

      // barra de domínio bipolar: centro = neutro
      const bw = 64, bh = 5, bx = p.x - bw / 2;
      const by = p.y + (p.shape === 'circle' ? p.r : p.h / 2) + 9;
      ctx.fillStyle = 'rgba(30,25,18,0.55)'; ctx.fillRect(bx, by, bw, bh);
      if (lead) {
        const w = (Math.abs(p.dominance) / 100) * (bw / 2);
        ctx.fillStyle = FACTIONS[lead].color;
        if (p.dominance > 0) ctx.fillRect(p.x - w, by, w, bh);   // Roma cresce para a esquerda (lado dela)
        else ctx.fillRect(p.x, by, w, bh);                        // Grécia para a direita
      }
      ctx.fillStyle = '#f4e9c8'; ctx.fillRect(p.x - 0.5, by - 1, 1, bh + 2);

      // rótulo
      ctx.font = '600 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(30,25,18,0.85)';
      ctx.fillText(p.name.toUpperCase(), p.x, by + bh + 12);
      if (p.capital) { ctx.font = '9px Georgia, serif'; ctx.fillText('capital', p.x, by + bh + 22); }
    }

    drawHp(u, x, y) {
      const ratio = u.hp / u.type.hp;
      if (ratio >= 0.999) return;
      const ctx = this.ctx, r = u.type.radius + 3;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
      ctx.strokeStyle = ratio > 0.5 ? '#5f8f4e' : ratio > 0.25 ? '#c8962e' : '#c0392b';
      ctx.lineWidth = 2; ctx.stroke();
    }

    drawPaths(input) {
      const ctx = this.ctx, g = this.game;
      ctx.lineWidth = 1.5;
      for (const u of g.units) {
        if (!u.path || u.faction !== g.player) continue;
        ctx.strokeStyle = FACTIONS[u.faction].color;
        ctx.globalAlpha = input && input.selection.has(u) ? 0.85 : 0.35;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        for (let i = u.pathIdx + 1; i < u.path.length; i++) ctx.lineTo(u.path[i].x, u.path[i].y);
        ctx.stroke();
        const end = u.path[u.path.length - 1];
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }

    drawEffects() {
      const ctx = this.ctx;
      for (const e of this.game.effects) {
        const k = e.age / e.ttl, a = 1 - k;
        if (e.kind === 'shot') {
          ctx.strokeStyle = `rgba(40,30,20,${a * 0.8})`; ctx.lineWidth = 1;
          const t = Math.min(1, k * 3);
          ctx.beginPath(); ctx.moveTo(e.x + (e.x2 - e.x) * (t * 0.7), e.y + (e.y2 - e.y) * (t * 0.7));
          ctx.lineTo(e.x + (e.x2 - e.x) * t, e.y + (e.y2 - e.y) * t); ctx.stroke();
        } else if (e.kind === 'spark') {
          ctx.fillStyle = `rgba(250,235,190,${a})`;
          ctx.fillRect(e.x - 1.5, e.y - 1.5, 3, 3);
        } else if (e.kind === 'ram') {
          ctx.strokeStyle = `rgba(255,245,215,${a})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, 6 + k * 22, 0, Math.PI * 2); ctx.stroke();
          ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,250,235,${a})`; ctx.fillText(e.text, e.x, e.y - 12 - k * 16);
        } else if (e.kind === 'death') {
          ctx.strokeStyle = `rgba(40,30,20,${a * 0.7})`; ctx.lineWidth = 1.5;
          const s = 5 + k * 4;
          ctx.beginPath(); ctx.moveTo(e.x - s, e.y - s); ctx.lineTo(e.x + s, e.y + s);
          ctx.moveTo(e.x + s, e.y - s); ctx.lineTo(e.x - s, e.y + s); ctx.stroke();
        } else if (e.kind === 'capture') {
          ctx.strokeStyle = e.faction ? FACTIONS[e.faction].color : NEUTRAL;
          ctx.globalAlpha = a; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + k * 30, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    drawInputOverlay(input) {
      const ctx = this.ctx;
      if (input.mode === 'draw' && input.stroke.length > 1) {
        ctx.strokeStyle = FACTIONS[this.game.player].color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(input.stroke[0].x, input.stroke[0].y);
        for (const p of input.stroke) ctx.lineTo(p.x, p.y);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (input.mode === 'box' && input.box) {
        const b = input.box;
        ctx.strokeStyle = '#f4e9c8'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
        ctx.setLineDash([]);
      }
    }
  }

  LOB.core.Renderer = Renderer;
})(window.LOB);
