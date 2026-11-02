/**
 * Ícones minimalistas desenhados com Canvas (sem imagens externas).
 * Terrestres: círculo na cor da facção + glifo branco.
 * Navais: casco alongado orientado pelo rumo (heading) + glifo.
 * Para uma unidade nova: adicione uma função aqui com o nome usado em `icon`.
 */
(function (LOB) {
  const GLYPH = '#fdfaf2';

  const glyphs = {
    hoplite(ctx, r) {            // aspis (escudo redondo) com ponto central
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
    },
    legionary(ctx, r) {          // scutum (escudo retangular)
      ctx.strokeRect(-r * 0.35, -r * 0.55, r * 0.7, r * 1.1);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.55); ctx.stroke();
    },
    peltast(ctx, r) {            // pelta (escudo em meia-lua)
      ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.55, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(0, r * 0.6); ctx.stroke();
    },
    praetorian(ctx, r) {         // estrela de 4 pontas (águia/elite)
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.22 : r * 0.62;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    },
    trireme(ctx, r) {            // 3 bancadas de remos
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.45, -r * 0.3); ctx.lineTo(i * r * 0.45, r * 0.3); ctx.stroke(); }
    },
    quinquereme(ctx, r) {        // 5 pontos (fileiras) + torre
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * r * 0.3, 0, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeRect(-r * 0.2, -r * 0.25, r * 0.4, r * 0.5);
    },
    support(ctx, r) {            // cruz de reparo
      ctx.fillRect(-r * 0.12, -r * 0.4, r * 0.24, r * 0.8);
      ctx.fillRect(-r * 0.4, -r * 0.12, r * 0.8, r * 0.24);
    },
  };

  /** Casco de navio apontando para +x (rotacionado pelo chamador). */
  function hull(ctx, r, ram) {
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.75, -r * 1.1, -r * 0.55);
    ctx.lineTo(-r * 1.1, r * 0.55);
    ctx.quadraticCurveTo(r * 0.6, r * 0.75, r * 1.5, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (ram) { // esporão de bronze
      ctx.beginPath(); ctx.moveTo(r * 1.45, 0); ctx.lineTo(r * 1.95, 0); ctx.stroke();
    }
  }

  /** Desenha uma unidade completa em (x, y). */
  function drawUnit(ctx, u, x, y, color) {
    const t = u.type, r = t.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = u.hitFlash > 0 ? '#fff' : 'rgba(20,16,10,0.75)';
    ctx.fillStyle = color;
    if (t.domain === 'naval') {
      ctx.save();
      ctx.rotate(u.heading);
      hull(ctx, r, !!t.ram && u.typeKey === 'trireme');
      ctx.fillStyle = GLYPH; ctx.strokeStyle = GLYPH; ctx.lineWidth = 1.3;
      if (u.typeKey !== 'support') glyphs[t.icon](ctx, r);
      ctx.restore();
      if (u.typeKey === 'support') { ctx.fillStyle = GLYPH; glyphs.support(ctx, r); } // cruz sempre "em pé"
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = GLYPH; ctx.strokeStyle = GLYPH; ctx.lineWidth = 1.3;
      glyphs[t.icon](ctx, r);
    }
    ctx.restore();
  }

  LOB.assets.icons = { glyphs, drawUnit };
})(window.LOB);
