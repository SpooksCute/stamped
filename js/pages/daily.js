// Daily trip, Layover practice rounds, and the trip archive.
(function () {
  const S = window.S;
  const RANKS = [[450, "Legendary Navigator"], [380, "Seasoned Explorer"], [300, "Frequent Flyer"], [200, "Weekend Traveler"], [100, "Day Tripper"], [0, "Stuck at Customs"]];

  function ledgerHTML(Q, mine) {
    const max = Q.answers[0].pct;
    return Q.answers.map(a => {
      const t = S.tierOf(a.pct);
      return `<div class="lrow${a.name === mine ? " mine" : ""}">
        <span class="nm">${a.name === mine ? "▶ " : ""}${S.esc(a.name)}</span>
        <span class="bar"><i class="c-${t.key}" style="width:${Math.max(2, (a.pct / max) * 100)}%"></i></span>
        <span class="pc">${S.fmtPct(a.pct)}</span>
      </div>`;
    }).join("");
  }
  S.ledgerHTML = ledgerHTML;
  S.legendHTML = () => `<div class="legend">${S.TIERS.map(t => `<span><i class="c-${t.key}"></i>${t.name}</span>`).join("")}</div>`;

  // mode: "daily" (today), "archive" (past day), "layover" (random practice)
  function startTrip(main, mode, date) {
    const key = S.keyOf(date);
    let ids;
    if (mode === "layover") {
      const skip = new Set(S.dailyIds(new Date()));
      ids = S.shuffle(S.QUESTIONS.map(q => q.id), S.rng("layover-" + Math.random())).filter(i => !skip.has(i)).slice(0, 5);
    } else ids = S.dailyIds(date);
    const saveKey = mode === "layover" ? null : "trip:" + key + (mode === "archive" ? ":archive" : "");
    const saved = saveKey ? S.store.get(saveKey) : null;
    const game = { mode, date, key, ids, results: saved?.results || [], recorded: !!saved?.recorded };
    const tripNo = S.tripNo(date);

    const headHTML = () => `<div class="page-head">
        <span>${mode === "layover" ? "<b>Layover</b> round" : `Trip <b>No. ${String(tripNo).padStart(4, "0")}</b>`} · ${S.prettyDate(date)}${mode === "archive" ? " · <b>Archive</b>" : ""}</span>
        <span class="seg">
          <button type="button" data-go="/play" aria-pressed="${mode === "daily"}">Today</button>
          <button type="button" data-go="/layover" aria-pressed="${mode === "layover"}">Layover</button>
          <button type="button" data-go="/archive" aria-pressed="${mode === "archive"}">Archive</button>
        </span>
      </div>`;
    const slotsHTML = () => {
      let h = `<div class="slots">`;
      for (let i = 0; i < 5; i++) {
        const r = game.results[i];
        if (r) h += `<div class="slot done k-${r.tier || "denied"}" style="border-color:currentColor">${r.tier ? S.tierByKey(r.tier).name : "Denied"}<b>+${r.points}</b></div>`;
        else h += `<div class="slot${i === game.results.length ? " now" : ""}">${String(i + 1).padStart(2, "0")}</div>`;
      }
      return h + `</div>`;
    };
    const persist = () => { if (saveKey) S.store.set(saveKey, { results: game.results, recorded: game.recorded }); };
    const wire = () => S.$$("[data-go]", main).forEach(b => b.addEventListener("click", () => S.go(b.dataset.go)));

    function ask() {
      const Q = S.QUESTIONS[game.ids[game.results.length]];
      main.innerHTML = `<section class="page">${headHTML()}${slotsHTML()}
        <p class="eyebrow">Destination ${game.results.length + 1} of 5</p>
        <h2 class="question">${S.esc(Q.q)}</h2>
        <p class="hint">${Q.answers.length} countries get you through. Pick the one nobody else will.</p>
        <form class="row-form" id="f" autocomplete="off">
          <div class="field"><label for="guess">Declare your country</label>
            <input type="text" id="guess" list="countries" placeholder="e.g. Liechtenstein" autocapitalize="words"></div>
          <button class="btn" type="submit">STAMP IT</button>
        </form>
        <div class="msg" id="msg" role="status"></div>
        ${S.datalistHTML()}</section>`;
      wire();
      const input = S.$("#guess", main);
      input.focus({ preventScroll: true });
      S.$("#f", main).addEventListener("submit", e => {
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) return;
        const country = S.toCountry(raw);
        if (!country) { S.$("#msg", main).textContent = `Customs doesn't recognize "${raw}". Check the spelling and try again.`; return; }
        const pct = Q.pctOf[country];
        const r = pct != null
          ? { q: Q.q, answer: country, pct, points: S.pointsOf(pct), tier: S.tierOf(pct).key }
          : { q: Q.q, answer: country, pct: 0, points: 0, tier: null };
        game.results.push(r); persist(); reveal(Q, r);
      });
    }

    function reveal(Q, r) {
      const last = game.results.length >= 5;
      main.innerHTML = `<section class="page">${headHTML()}${slotsHTML()}
        <p class="eyebrow">Destination ${game.results.length} of 5 · ${S.esc(Q.q)}</p>
        <div class="stamp-zone">${S.stampHTML({ tier: r.tier, title: r.answer, line: r.tier ? S.fmtPct(r.pct) + " of travelers" : "Not a valid entry", pts: r.points, slam: true })}</div>
        ${r.tier ? "" : `<p class="hint">${S.esc(r.answer)} doesn't get you through this one.</p>`}
        <div class="ledger-title"><h3>CUSTOMS LEDGER</h3><span>${Q.answers.length} valid entries</span></div>
        <div class="ledger">${ledgerHTML(Q, r.answer)}</div>
        ${S.legendHTML()}
        <div class="actions"><button class="btn alt" id="next" type="button">${last ? "SEE PASSPORT" : "NEXT DESTINATION"}</button></div></section>`;
      wire();
      const next = S.$("#next", main);
      next.focus({ preventScroll: true });
      next.addEventListener("click", () => (game.results.length >= 5 ? end() : ask()));
    }

    function mrz(total) {
      const pad = (s, n) => (s + "<".repeat(n)).slice(0, n);
      const codes = game.results.map(r => (r.tier ? S.tierByKey(r.tier).name.slice(0, 3).toUpperCase() : "DNY")).join("");
      return pad(`P<STP${mode === "layover" ? "LAYOVER" : "DAILY"}<<TRIP<${String(tripNo).padStart(4, "0")}`, 44) + "\n" +
        pad(`${String(total).padStart(3, "0")}<${codes}<${game.key.replace(/-/g, "")}`, 44);
    }

    function end() {
      const total = game.results.reduce((t, r) => t + r.points, 0);
      if (!game.recorded) {
        game.recorded = true; persist();
        S.results.save(mode === "daily" ? "daily" : mode, game.key, total, { picks: game.results.map(r => ({ q: r.q, a: r.answer, t: r.tier, p: r.points })) });
        S.renderHeader();
      }
      const rank = RANKS.find(([min]) => total >= min)[1];
      const squares = game.results.map(r => (r.tier ? S.tierByKey(r.tier).sq : "🟥")).join("");
      const share = `STAMPED ${mode === "layover" ? "Layover" : "Trip #" + tripNo}\n${squares} ${total}/500\n${rank}\n${location.origin}${location.pathname}`;
      main.innerHTML = `<section class="page">${headHTML()}
        <p class="eyebrow" style="margin-top:14px">${mode === "layover" ? "Layover complete" : "Trip complete"}</p>
        <div class="total"><b>${total}</b><span>/ 500 points</span></div>
        <p class="rank">${rank}</p>
        <div class="spread">${game.results.map(r => `<div>${S.stampHTML({ tier: r.tier, title: r.answer, line: r.tier ? S.fmtPct(r.pct) : "", pts: r.points, small: true })}</div>`).join("")}</div>
        <div class="ledger">${game.results.map(r => `<div class="lrow"><span class="nm">${S.esc(r.answer)}</span><span class="nm muted">${S.esc(r.q)}</span><span class="pc">+${r.points}</span></div>`).join("")}</div>
        <div class="mrz" aria-label="Passport code">${mrz(total)}</div>
        <div class="share" id="share">${S.esc(share)}</div>
        <div class="actions">
          <button class="btn" id="copy" type="button">COPY RESULT</button>
          <button class="btn ghost" type="button" data-go="/layover">PLAY A LAYOVER</button>
          <a class="btn ghost" href="#/border-run">TODAY'S BORDER RUN</a>
        </div>
        ${!S.auth.user ? `<p class="hint" style="margin-top:16px"><a href="#/account">Make a free account</a> to keep your streak on every device.</p>` : ""}
      </section>`;
      wire();
      S.$("#copy", main).addEventListener("click", e => S.copy(share, e.currentTarget, S.$("#share", main)));
    }

    (game.results.length >= 5 ? end : ask)();
  }

  S.route("/play", (main, [dateKey]) => {
    if (dateKey && dateKey !== S.todayKey()) {
      const d = S.fromKey(dateKey);
      if (isNaN(d) || d > new Date() || S.dayNum(d) < S.dayNum(S.LAUNCH)) return S.go("/archive");
      if (!S.pass.active()) { S.go("/archive"); return S.pass.wall("Replay past trips with the Pass"); }
      return startTrip(main, "archive", d);
    }
    startTrip(main, "daily", new Date());
  });

  S.route("/layover", main => {
    if (!S.pass.active() && S.pass.left("layover") <= 0) {
      main.innerHTML = `<section class="page">
        <p class="eyebrow">Layover</p><h2 class="title">You've used today's free Layovers</h2>
        <p class="lede">Free players get ${S.cfg.FREE_LAYOVERS_PER_DAY} practice trips a day. They reset at midnight.</p>
        <div class="actions"><button class="btn" type="button" data-wall="Unlimited Layovers with the Pass">GET THE PASS</button>
        <a class="btn ghost" href="#/play">BACK TO TODAY'S TRIP</a></div></section>`;
      return;
    }
    S.pass.use("layover");
    startTrip(main, "layover", new Date());
  });

  S.route("/archive", main => {
    const today = S.dayNum(new Date()), first = S.dayNum(S.LAUNCH);
    const rows = [];
    for (let n = today - 1; n >= first && rows.length < 120; n--) {
      const d = new Date(n * 86400000); const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const key = S.keyOf(local);
      const done = S.store.get("trip:" + key) || S.store.get("trip:" + key + ":archive");
      const score = done?.results?.length === 5 ? done.results.reduce((t, r) => t + r.points, 0) : null;
      rows.push({ key, date: local, no: S.tripNo(local), score });
    }
    const pass = S.pass.active();
    main.innerHTML = `<section class="page">
      <p class="eyebrow">Trip archive</p><h2 class="title">Every trip so far</h2>
      <p class="lede">${pass ? "Pick any past trip to play it." : "Pass holders can replay any trip they missed."}</p>
      ${pass ? "" : `<div class="actions" style="margin:0 0 16px">${S.pass.lockHTML("Unlock the archive")}</div>`}
      ${rows.length ? `<div class="scroll"><table class="table"><thead><tr><th>Trip</th><th>Date</th><th class="n">Your score</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>No. ${String(r.no).padStart(4, "0")}</td><td>${S.prettyDate(r.date)}</td><td class="n">${r.score ?? "—"}</td>
          <td>${pass ? `<a href="#/play/${r.key}">${r.score == null ? "Play" : "View"}</a>` : "🔒"}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="hint">Trip No. 0001 is today, so there's nothing in the archive yet. Check back tomorrow.</p>`}
      <div class="actions"><a class="btn alt" href="#/play">TODAY'S TRIP</a></div>
    </section>`;
  });
})();
