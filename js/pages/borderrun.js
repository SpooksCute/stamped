// Border Run: get from one country to another by naming countries that share a land border.
(function () {
  const S = window.S;

  // Shortest path between two countries, or null.
  S.shortestPath = (from, to) => {
    const prev = { [from]: null }, queue = [from];
    while (queue.length) {
      const c = queue.shift();
      if (c === to) break;
      for (const n of BORDERS[c]) if (!(n in prev)) { prev[n] = c; queue.push(n); }
    }
    if (!(to in prev)) return null;
    const path = []; for (let c = to; c; c = prev[c]) path.unshift(c);
    return path;
  };

  const LAND = COUNTRIES.filter(c => BORDERS[c].size > 0);
  function makePuzzle(seed) {
    const rand = S.rng(seed);
    for (let tries = 0; tries < 400; tries++) {
      const a = LAND[Math.floor(rand() * LAND.length)], b = LAND[Math.floor(rand() * LAND.length)];
      if (a === b || BORDERS[a].has(b)) continue;
      const p = S.shortestPath(a, b);
      if (p && p.length >= 5 && p.length <= 8) return { from: a, to: b, best: p };
    }
    return { from: "Portugal", to: "Poland", best: S.shortestPath("Portugal", "Poland") };
  }

  function play(main, puzzle, mode) {
    const key = S.todayKey();
    const saveKey = mode === "daily" ? "borderrun:" + key : null;
    const par = puzzle.best.length - 2;
    const st = (saveKey && S.store.get(saveKey)) || { chain: [puzzle.from], moves: 0, hints: 0, done: false, gaveUp: false, recorded: false };
    const persist = () => { if (saveKey) S.store.set(saveKey, st); };
    const last = () => st.chain[st.chain.length - 1];
    const scoreOf = () => (st.gaveUp ? 0 : Math.max(10, 100 - 15 * Math.max(0, st.moves - par)));

    function render(msg = "", ok = false) {
      const finished = st.done || st.gaveUp;
      main.innerHTML = `<section class="page">
        <div class="page-head"><span><b>Border Run</b> · ${mode === "daily" ? S.prettyDate(new Date()) : "Extra route"}</span>
          <span class="seg"><button type="button" id="newRoute" aria-pressed="false">${S.pass.active() ? "New route" : "🔒 New route"}</button></span></div>
        <h2 class="question" style="margin-top:12px">${S.esc(puzzle.from)} → ${S.esc(puzzle.to)}</h2>
        <p class="hint">Name a country that borders the last one in your route. Reach ${S.esc(puzzle.to)} in as few moves as you can. Par is <b>${par}</b> ${par === 1 ? "country" : "countries"} in between.</p>
        <div class="route">
          ${st.chain.map((c, i) => `${i ? `<span class="arrow">→</span>` : ""}<span class="node${i === 0 ? " start" : ""}${c === puzzle.to ? " end" : ""}">${S.esc(c)}</span>`).join("")}
          ${finished ? "" : `<span class="arrow">→</span><span class="node ghost">?</span><span class="arrow">⋯</span><span class="node end">${S.esc(puzzle.to)}</span>`}
        </div>
        <div class="kpis">
          <div class="kpi"><b>${st.moves}</b><span>Moves</span></div>
          <div class="kpi"><b>${par}</b><span>Par</span></div>
          <div class="kpi"><b>${st.hints}</b><span>Hints used</span></div>
        </div>
        ${finished ? endHTML() : `
        <form class="row-form" id="f" autocomplete="off">
          <div class="field"><label for="guess">Border of ${S.esc(last())}</label>
            <input type="text" id="guess" list="countries" placeholder="Next country" autocapitalize="words"></div>
          <button class="btn" type="submit">CROSS</button>
        </form>
        <div class="msg${ok ? " ok" : ""}" id="msg" role="status">${S.esc(msg)}</div>
        <div class="actions" style="margin-top:8px">
          ${st.chain.length > 1 ? `<button class="btn ghost small" type="button" id="back">BACK UP</button>` : ""}
          <button class="btn ghost small" type="button" id="hint">HINT (+2 MOVES)</button>
          <button class="btn ghost small" type="button" id="give">SHOW ROUTE</button>
        </div>`}
        ${S.datalistHTML()}
      </section>`;
      S.$("#newRoute", main).addEventListener("click", () => {
        if (!S.pass.active()) return S.pass.wall("New Border Runs anytime with the Pass");
        play(main, makePuzzle("extra-" + Math.random()), "extra");
      });
      if (finished) return wireEnd();
      const input = S.$("#guess", main);
      input.focus({ preventScroll: true });
      S.$("#f", main).addEventListener("submit", e => {
        e.preventDefault();
        const c = S.toCountry(input.value);
        if (!input.value.trim()) return;
        if (!c) return render(`Customs doesn't recognize "${input.value.trim()}".`);
        if (st.chain.includes(c)) return render(`${c} is already on your route.`);
        st.moves++;
        if (!BORDERS[last()].has(c)) { persist(); return render(`${c} doesn't share a land border with ${last()}. That cost a move.`); }
        st.chain.push(c);
        if (c === puzzle.to) st.done = true;
        persist(); render(st.done ? "" : `Crossed into ${c}.`, true);
      });
      S.$("#back", main)?.addEventListener("click", () => { st.chain.pop(); persist(); render(`Backed up to ${last()}.`); });
      S.$("#hint", main).addEventListener("click", () => {
        const p = S.shortestPath(last(), puzzle.to);
        if (!p) return render(`There's no land route from ${last()}. Back up and try another way.`);
        st.hints++; st.moves += 2;
        const next = p[1];
        if (next === puzzle.to) { st.chain.push(next); st.done = true; persist(); return render(); }
        persist(); render(`Hint: try ${next}.`, true);
      });
      S.$("#give", main).addEventListener("click", () => { st.gaveUp = true; persist(); render(); });
    }

    function endHTML() {
      const score = scoreOf(), diff = st.moves - par;
      if (!st.recorded) { st.recorded = true; persist(); S.results.save("borderrun", key, score, { from: puzzle.from, to: puzzle.to, moves: st.moves, par, gaveUp: st.gaveUp }); }
      const verdict = st.gaveUp ? "Route abandoned" : diff <= 0 ? "Right on par" : `${diff} over par`;
      const share = `STAMPED Border Run ${mode === "daily" ? S.prettyDate(new Date()) : ""}\n${puzzle.from} → ${puzzle.to}\n${st.gaveUp ? "🟥 gave up" : "🟩".repeat(Math.min(par, st.moves)) + "🟨".repeat(Math.max(0, diff))} ${st.moves} moves (par ${par})`;
      return `<div class="stamp-zone">${S.stampHTML({ tier: st.gaveUp ? null : diff <= 0 ? "legend" : diff <= 2 ? "explorer" : "tourist", title: verdict, line: `${st.moves} moves · par ${par}`, pts: score, slam: true })}</div>
        <p class="eyebrow">Shortest route</p>
        <div class="route">${puzzle.best.map((c, i) => `${i ? `<span class="arrow">→</span>` : ""}<span class="node">${S.esc(c)}</span>`).join("")}</div>
        <div class="share" id="share">${S.esc(share)}</div>
        <div class="actions"><button class="btn" id="copy" type="button">COPY RESULT</button>
          <a class="btn ghost" href="#/grid">TODAY'S GRID</a></div>`;
    }
    function wireEnd() {
      const btn = S.$("#copy", main);
      if (btn) btn.addEventListener("click", () => S.copy(S.$("#share", main).textContent, btn, S.$("#share", main)));
    }
    render();
  }

  S.route("/border-run", main => play(main, makePuzzle("borderrun-" + S.todayKey()), "daily"));
  S.makeBorderPuzzle = makePuzzle;
})();
