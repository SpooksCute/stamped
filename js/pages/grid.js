// Passport Grid: fill a 3×3 grid where each cell needs a country matching its row and column.
(function () {
  const S = window.S;
  const POOL = S.QUESTIONS.filter(q => q.answers.length >= 5);

  function cellAnswers(r, c) {
    const list = r.answers.filter(a => c.set.has(a.name)).map(a => ({ name: a.name, w: Math.sqrt(a.pct * c.pctOf[a.name]) }));
    const sum = list.reduce((t, x) => t + x.w, 0);
    return list.map(x => ({ name: x.name, pct: (x.w / sum) * 100 })).sort((a, b) => b.pct - a.pct);
  }

  function makeGrid(seed) {
    const rand = S.rng(seed);
    const overlap = (a, b) => { let n = 0; for (const x of a.set) if (b.set.has(x)) n++; return n; };
    for (let tries = 0; tries < 3000; tries++) {
      // Rows: three different categories, so the grid mixes kinds of clues.
      const rows = [];
      for (const q of S.shuffle(POOL, rand)) {
        if (rows.length === 3) break;
        if (!rows.some(r => r.cat === q.cat)) rows.push(q);
      }
      // Columns: anything that leaves at least 2 answers in every cell with every row.
      const cands = S.shuffle(POOL.filter(c => !rows.includes(c) && rows.every(r => overlap(r, c) >= 2)), rand);
      const cols = [];
      for (const c of cands) {
        if (cols.length === 3) break;
        const sameCat = [...rows, ...cols].filter(x => x.cat === c.cat).length;
        if (sameCat >= 2) continue;
        // skip columns that are nearly the same clue as one already chosen
        if (cols.some(x => overlap(x, c) / Math.min(x.set.size, c.set.size) > 0.7)) continue;
        cols.push(c);
      }
      if (cols.length < 3) continue;
      const cells = [];
      for (const r of rows) for (const c of cols) cells.push(cellAnswers(r, c));
      return { rows, cols, cells };
    }
    return null;
  }

  function play(main, grid, mode) {
    const key = S.todayKey();
    const saveKey = mode === "daily" ? "grid:" + key : null;
    const st = (saveKey && S.store.get(saveKey)) || { filled: Array(9).fill(null), guesses: 9, done: false, recorded: false };
    let sel = st.filled.findIndex(x => !x);
    const persist = () => { if (saveKey) S.store.set(saveKey, st); };
    const used = () => new Set(st.filled.filter(Boolean).map(f => f.name));
    const total = () => st.filled.reduce((t, f) => t + (f ? f.points : 0), 0);

    function render(msg = "") {
      if (!st.done && (st.guesses <= 0 || st.filled.every(Boolean))) st.done = true;
      const head = `<div class="page-head"><span><b>Passport Grid</b> · ${mode === "daily" ? S.prettyDate(new Date()) : "Extra grid"}</span>
        <span class="seg"><button type="button" id="newGrid" aria-pressed="false">${S.pass.active() ? "New grid" : "🔒 New grid"}</button></span></div>`;
      let cells = `<div class="ghead corner"></div>` + grid.cols.map(c => `<div class="ghead">${S.esc(S.shortLabel(c.q))}</div>`).join("");
      grid.rows.forEach((r, ri) => {
        cells += `<div class="ghead">${S.esc(S.shortLabel(r.q))}</div>`;
        for (let ci = 0; ci < 3; ci++) {
          const i = ri * 3 + ci, f = st.filled[i];
          cells += f
            ? `<div class="cell filled k-${f.tier}" style="border-color:currentColor">${S.esc(f.name)}<b>+${f.points}</b></div>`
            : `<button class="cell${i === sel && !st.done ? " sel" : ""}" type="button" data-i="${i}" ${st.done ? "disabled" : ""} aria-label="Row ${ri + 1}, column ${ci + 1}">${st.done ? "—" : "+"}</button>`;
        }
      });
      main.innerHTML = `<section class="page">${head}
        <h2 class="question" style="margin-top:12px">Fill the grid</h2>
        <p class="hint">Each cell needs a country that fits its row and its column. No repeats. Rarer picks score more. You have 9 guesses, and a wrong one still uses a guess.</p>
        <div class="grid-wrap"><div class="pgrid">${cells}</div></div>
        <div class="kpis"><div class="kpi"><b>${st.guesses}</b><span>Guesses left</span></div><div class="kpi"><b>${total()}</b><span>Points</span></div></div>
        ${st.done ? endHTML() : `
        <form class="row-form" id="f" autocomplete="off">
          <div class="field"><label for="guess">${sel >= 0 ? S.esc(S.shortLabel(grid.rows[Math.floor(sel / 3)].q) + " + " + S.shortLabel(grid.cols[sel % 3].q)) : "Pick a cell"}</label>
            <input type="text" id="guess" list="countries" placeholder="Country" autocapitalize="words"></div>
          <button class="btn" type="submit">STAMP IT</button>
        </form>
        <div class="msg" id="msg" role="status">${S.esc(msg)}</div>`}
        ${S.datalistHTML()}
      </section>`;
      S.$("#newGrid", main).addEventListener("click", () => {
        if (!S.pass.active()) return S.pass.wall("New Passport Grids anytime with the Pass");
        const g = makeGrid("extra-" + Math.random()); if (g) play(main, g, "extra");
      });
      S.$$(".cell[data-i]", main).forEach(b => b.addEventListener("click", () => { sel = +b.dataset.i; render(); }));
      if (st.done) return wireEnd();
      const input = S.$("#guess", main);
      input.focus({ preventScroll: true });
      S.$("#f", main).addEventListener("submit", e => {
        e.preventDefault();
        if (!input.value.trim()) return;
        if (sel < 0) return render("Pick a cell first.");
        const c = S.toCountry(input.value);
        if (!c) return render(`Customs doesn't recognize "${input.value.trim()}".`);
        if (used().has(c)) return render(`${c} is already on the grid.`);
        st.guesses--;
        const ans = grid.cells[sel].find(a => a.name === c);
        if (!ans) { persist(); return render(`${c} doesn't fit both. ${st.guesses} ${st.guesses === 1 ? "guess" : "guesses"} left.`); }
        st.filled[sel] = { name: c, pct: ans.pct, points: S.pointsOf(ans.pct), tier: S.tierOf(ans.pct).key };
        sel = st.filled.findIndex(x => !x);
        persist(); render();
      });
    }

    function endHTML() {
      const score = total();
      if (!st.recorded) { st.recorded = true; persist(); S.results.save("grid", key, score, { filled: st.filled.map(f => f && f.name) }); }
      const squares = [0, 1, 2].map(r => st.filled.slice(r * 3, r * 3 + 3).map(f => (f ? S.tierByKey(f.tier).sq : "⬛")).join("")).join("\n");
      const share = `STAMPED Grid ${mode === "daily" ? S.prettyDate(new Date()) : ""}\n${squares}\n${score}/900`;
      const rarest = grid.cells.map((cell, i) => {
        const r = cell[cell.length - 1];
        return `<div class="lrow"><span class="nm">${S.esc(S.shortLabel(grid.rows[Math.floor(i / 3)].q))} + ${S.esc(S.shortLabel(grid.cols[i % 3].q))}</span><span class="nm">${S.esc(r.name)}</span><span class="pc">${S.fmtPct(r.pct)}</span></div>`;
      }).join("");
      return `<div class="total"><b>${score}</b><span>/ 900 points</span></div>
        <div class="ledger-title"><h3>RAREST ANSWERS</h3><span>per cell</span></div>
        <div class="ledger">${rarest}</div>
        <div class="share" id="share">${S.esc(share)}</div>
        <div class="actions"><button class="btn" id="copy" type="button">COPY RESULT</button>
          <a class="btn ghost" href="#/sprint">CUSTOMS SPRINT</a></div>`;
    }
    function wireEnd() {
      const btn = S.$("#copy", main);
      if (btn) btn.addEventListener("click", () => S.copy(S.$("#share", main).textContent, btn, S.$("#share", main)));
    }
    render();
  }

  S.makeGrid = makeGrid;
  S.route("/grid", main => {
    const g = makeGrid("grid-" + S.todayKey());
    if (!g) { main.innerHTML = `<section class="page"><p class="lede">Today's grid couldn't be built. Try again later.</p></section>`; return; }
    play(main, g, "daily");
  });
})();
