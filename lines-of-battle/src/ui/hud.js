/**
 * HUD em DOM (fora do canvas). Atualizado ~5×/s, não a cada frame:
 * texto/DOM é caro e não precisa de 60 Hz.
 */
(function (LOB) {
  const { FACTIONS, UNIT_TYPES } = LOB.entities;
  const $ = (id) => document.getElementById(id);

  class HUD {
    constructor() {
      this.el = {
        vpRome: $('vp-rome'), vpGreece: $('vp-greece'),
        barRome: $('bar-rome'), barGreece: $('bar-greece'),
        ptsRome: $('pts-rome'), ptsGreece: $('pts-greece'),
        clock: $('clock'), reinf: $('reinf'), sel: $('selection'),
        log: $('log'), overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'),
        paused: $('paused'), speed: $('speed'), legend: $('legend'),
      };
      this.timer = 0;
      this.buildLegend();
    }

    buildLegend() {
      const rows = Object.entries(UNIT_TYPES).map(([k, t]) =>
        `<tr><td><canvas data-icon="${k}" width="30" height="30"></canvas></td>
         <td><b>${t.name}</b><small>${t.domain === 'naval' ? 'naval' : 'terrestre'} · vel ${t.speed} · força ${t.strength}${t.range ? ' · alcance ' + t.range : ''}${t.ram ? ' · aríete ' + t.ram : ''}</small><em>${t.desc}</em></td></tr>`);
      this.el.legend.innerHTML = `<table>${rows.join('')}</table>`;
      this.el.legend.querySelectorAll('canvas').forEach((cv) => {
        const ctx = cv.getContext('2d');
        const k = cv.dataset.icon;
        const fake = { type: UNIT_TYPES[k], typeKey: k, heading: -Math.PI / 4, hitFlash: 0 };
        LOB.assets.icons.drawUnit(ctx, fake, 15, 15, UNIT_TYPES[k].origin === 'Grécia' ? FACTIONS.greece.color : FACTIONS.rome.color);
      });
    }

    update(dt, game, input, loop) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = 0.2;
      const e = this.el;
      const pct = (f) => Math.min(100, (game.vp[f] / game.vpTarget) * 100);
      e.vpRome.textContent = Math.floor(game.vp.rome);
      e.vpGreece.textContent = Math.floor(game.vp.greece);
      e.barRome.style.width = pct('rome') + '%';
      e.barGreece.style.width = pct('greece') + '%';
      const held = (f) => game.points.filter((p) => p.owner === f).length;
      e.ptsRome.textContent = `${held('rome')} pontos · ${game.units.filter((u) => u.faction === 'rome').length} unidades`;
      e.ptsGreece.textContent = `${held('greece')} pontos · ${game.units.filter((u) => u.faction === 'greece').length} unidades`;
      const t = Math.floor(game.time);
      e.clock.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

      const r = game.reinf[game.player];
      const cap = game.points.find((p) => p.capital === game.player);
      e.reinf.textContent = cap && cap.owner === game.player
        ? `Reforços: tropa em ${Math.ceil(r.land)}s · navio em ${Math.ceil(r.naval)}s`
        : 'Reforços suspensos — retome sua capital!';

      // seleção
      input.prune();
      if (input.selection.size === 0) {
        e.sel.innerHTML = '<span class="muted">Nenhuma unidade selecionada — arraste para selecionar.</span>';
      } else {
        const counts = {};
        let hp = 0, max = 0;
        for (const u of input.selection) { counts[u.typeKey] = (counts[u.typeKey] || 0) + 1; hp += u.hp; max += u.type.hp; }
        e.sel.innerHTML = Object.entries(counts).map(([k, n]) => `<span class="chip">${n}× ${UNIT_TYPES[k].name}</span>`).join('') +
          `<span class="muted"> vida ${Math.round((hp / max) * 100)}%</span>`;
      }

      e.log.innerHTML = game.messages.slice(-4).map((m) => `<div>${m.text}</div>`).join('');
      e.paused.hidden = !loop.paused;
      e.speed.textContent = `${loop.timeScale}×`;

      if (game.winner) {
        e.overlay.hidden = false;
        const won = game.winner === game.player;
        e.overlayTitle.textContent = won ? 'Vitória!' : 'Derrota';
        e.overlayTitle.style.color = FACTIONS[game.winner].color;
        e.overlayText.textContent = `${FACTIONS[game.winner].name} venceu por ${game.winReason} em ${e.clock.textContent}. Pressione R para jogar de novo.`;
      } else e.overlay.hidden = true;
    }
  }

  LOB.ui.HUD = HUD;
})(window.LOB);
