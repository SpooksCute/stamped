// Stats: basics for everyone, the detailed breakdown with the Pass.
(function () {
  const S = window.S;

  function historyChart(rows) {
    // Last 30 daily trips as a line with points. Scale 0–500.
    const W = 640, H = 200, L = 36, R = 12, T = 12, B = 28;
    const pts = rows.slice(-30);
    if (pts.length < 2) return `<p class="hint">Play a couple more daily trips to see your history.</p>`;
    const x = i => L + (i / (pts.length - 1)) * (W - L - R);
    const y = v => T + (1 - v / 500) * (H - T - B);
    const line = pts.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.score).toFixed(1)}`).join(" ");
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    const grid = [0, 100, 200, 300, 400, 500].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v}</text>`).join("");
    const lastP = pts[pts.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score history for the last ${pts.length} daily trips">
      ${grid}
      <path d="${area}" fill="var(--explorer)" opacity=".12"/>
      <path d="${line}" fill="none" stroke="var(--explorer)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.score)}" r="${i === pts.length - 1 ? 5 : 3}" fill="var(--explorer)"><title>${r.day}: ${r.score}</title></circle>`).join("")}
      <text x="${x(pts.length - 1)}" y="${y(lastP.score) - 10}" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)" font-family="var(--mono)">${lastP.score}</text>
      <text x="${L}" y="${H - 8}" font-size="11" fill="var(--muted)" font-family="var(--mono)">${pts[0].day}</text>
      <text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${lastP.day}</text>
    </svg>`;
  }

  S.route("/stats", main => {
    const all = S.results.all();
    const daily = all.filter(r => r.mode === "daily").sort((a, b) => a.day.localeCompare(b.day));
    const played = daily.length;
    const avg = played ? Math.round(daily.reduce((t, r) => t + r.score, 0) / played) : 0;
    const pass = S.pass.active();
    const picks = daily.flatMap(r => r.detail?.picks || []);
    const tierCounts = {}; S.TIERS.forEach(t => { tierCounts[t.key] = 0; }); let denied = 0;
    picks.forEach(p => { if (p.t) tierCounts[p.t]++; else denied++; });
    const maxCount = Math.max(1, ...Object.values(tierCounts), denied);
    const best = picks.filter(p => p.t).sort((a, b) => b.p - a.p).slice(0, 8);
    const modeBest = m => S.results.best(m) || "—";

    main.innerHTML = `<section class="page">
      <p class="eyebrow">Your stats</p>
      <h2 class="title">${S.auth.user ? S.esc(S.auth.user.username) + "'s passport" : "Your passport"}</h2>
      <div class="kpis">
        <div class="kpi"><b>${played}</b><span>Trips</span></div>
        <div class="kpi"><b>${S.results.streak()}</b><span>Streak</span></div>
        <div class="kpi"><b>${S.results.best("daily") || "—"}</b><span>Best trip</span></div>
        <div class="kpi"><b>${played ? avg : "—"}</b><span>Average</span></div>
      </div>
      ${!S.auth.user ? `<p class="hint">These stats live on this device. <a href="#/account">Make an account</a> to keep them everywhere.</p>` : ""}
    </section>

    <section class="page">
      <p class="eyebrow">Detailed stats</p>
      ${pass ? `
        <div class="ledger-title"><h3>SCORE HISTORY</h3><span>last 30 trips</span></div>
        ${historyChart(daily)}
        <div class="ledger-title" style="margin-top:18px"><h3>STAMPS BY TIER</h3><span>${picks.length} stamps</span></div>
        <div class="ledger">
          ${S.TIERS.slice().reverse().map(t => `<div class="lrow"><span class="nm">${t.name}</span><span class="bar"><i class="c-${t.key}" style="width:${(tierCounts[t.key] / maxCount) * 100}%"></i></span><span class="pc">${tierCounts[t.key]}</span></div>`).join("")}
          <div class="lrow"><span class="nm">Denied</span><span class="bar"><i class="c-denied" style="width:${(denied / maxCount) * 100}%"></i></span><span class="pc">${denied}</span></div>
        </div>
        <div class="ledger-title" style="margin-top:18px"><h3>RAREST STAMPS</h3><span>all time</span></div>
        ${best.length ? `<div class="spread">${best.map(p => `<div>${S.stampHTML({ tier: p.t, title: p.a, line: S.shortLabel(p.q), pts: p.p, small: true })}</div>`).join("")}</div>` : `<p class="hint">Finish a trip to start your collection.</p>`}
        <div class="ledger-title" style="margin-top:18px"><h3>OTHER GAMES</h3><span>best scores</span></div>
        <div class="kpis">
          <div class="kpi"><b>${modeBest("borderrun")}</b><span>Border Run</span></div>
          <div class="kpi"><b>${modeBest("grid")}</b><span>Grid</span></div>
          <div class="kpi"><b>${modeBest("sprint")}</b><span>Sprint</span></div>
          <div class="kpi"><b>${all.filter(r => r.mode === "standing").length}</b><span>Standing games</span></div>
        </div>` : `
        <h2 class="title">See how rare you really are</h2>
        <p class="lede">Pass holders get a score history chart, a breakdown of every stamp by tier, their rarest stamps of all time, and best scores in every game.</p>
        <div class="actions">${S.pass.lockHTML("Unlock detailed stats")}</div>`}
    </section>`;
  });
})();
