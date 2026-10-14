// Customs Sprint: name as many countries in a category as you can in 60 seconds.
(function () {
  const S = window.S;
  const POOL = S.QUESTIONS.filter(q => q.answers.length >= 12);
  const SECONDS = 60;

  function intro(main) {
    const pass = S.pass.active(), left = S.pass.left("sprint");
    main.innerHTML = `<section class="page">
      <p class="eyebrow">Customs Sprint</p>
      <h2 class="title">60 seconds at the border</h2>
      <p class="lede">You get one category. Name as many countries that fit as you can before the clock runs out. Every right answer scores, and rare ones score more.</p>
      <p class="hint">${S.pass.leftLabel("sprint")}</p>
      <div class="actions">
        ${pass || left > 0 ? `<button class="btn" id="go" type="button">START THE CLOCK</button>` : S.pass.lockHTML("Unlimited sprints with the Pass")}
      </div>
      ${S.results.best("sprint") ? `<p class="hint" style="margin-top:14px">Your best: <b>${S.results.best("sprint")}</b> points</p>` : ""}
    </section>`;
    S.$("#go", main)?.addEventListener("click", () => { S.pass.use("sprint"); run(main); });
  }

  function run(main) {
    const Q = POOL[Math.floor(Math.random() * POOL.length)];
    const found = [];
    let leftMs = SECONDS * 1000, ended = false;
    const t0 = performance.now();
    main.innerHTML = `<section class="page">
      <div class="page-head"><span><b>Customs Sprint</b></span><span class="timer" id="timer">${SECONDS}</span></div>
      <h2 class="question" style="margin-top:8px">${S.esc(Q.q)}</h2>
      <p class="hint">${Q.answers.length} possible. Press Enter after each one.</p>
      <form class="row-form" id="f" autocomplete="off">
        <div class="field"><label for="guess">Country</label><input type="text" id="guess" list="countries" autocapitalize="words"></div>
        <button class="btn" type="submit">STAMP</button>
      </form>
      <div class="msg" id="msg" role="status"></div>
      <div class="kpis"><div class="kpi"><b id="count">0</b><span>Found</span></div><div class="kpi"><b id="pts">0</b><span>Points</span></div></div>
      <div class="chips" id="chips"></div>
      ${S.datalistHTML()}
    </section>`;
    const input = S.$("#guess", main), msg = S.$("#msg", main), timer = S.$("#timer", main);
    input.focus({ preventScroll: true });
    const tick = setInterval(() => {
      leftMs = SECONDS * 1000 - (performance.now() - t0);
      const s = Math.max(0, Math.ceil(leftMs / 1000));
      timer.textContent = s; timer.classList.toggle("low", s <= 10);
      if (leftMs <= 0) finish();
    }, 200);
    S.cleanup = () => clearInterval(tick);
    S.$("#f", main).addEventListener("submit", e => {
      e.preventDefault();
      if (ended) return;
      const c = S.toCountry(input.value);
      input.value = "";
      if (!c) { msg.className = "msg"; msg.textContent = "Not a country on the list."; return; }
      if (found.some(f => f.name === c)) { msg.className = "msg"; msg.textContent = `${c} is already stamped.`; return; }
      const pct = Q.pctOf[c];
      if (pct == null) { msg.className = "msg"; msg.textContent = `${c} doesn't fit.`; return; }
      const f = { name: c, pct, points: S.pointsOf(pct), tier: S.tierOf(pct).key };
      found.push(f);
      msg.className = "msg ok"; msg.textContent = `${c} +${f.points}`;
      S.$("#count", main).textContent = found.length;
      S.$("#pts", main).textContent = found.reduce((t, x) => t + x.points, 0);
      S.$("#chips", main).insertAdjacentHTML("beforeend", `<span class="k-${f.tier}">${S.esc(c)}</span>`);
    });

    function finish() {
      if (ended) return; ended = true; clearInterval(tick);
      const score = found.reduce((t, x) => t + x.points, 0);
      S.results.save("sprint", S.todayKey(), score, { q: Q.q, found: found.length, of: Q.answers.length });
      const missed = Q.answers.filter(a => !found.some(f => f.name === a.name));
      const share = `STAMPED Customs Sprint\n${Q.q}\n${found.length}/${Q.answers.length} in 60s · ${score} pts`;
      main.innerHTML = `<section class="page">
        <p class="eyebrow">Time's up · ${S.esc(Q.q)}</p>
        <div class="total"><b>${score}</b><span>points · ${found.length} of ${Q.answers.length} found</span></div>
        <div class="chips">${found.map(f => `<span class="k-${f.tier}">${S.esc(f.name)}</span>`).join("") || `<span class="muted">Nothing stamped this time.</span>`}</div>
        ${missed.length ? `<div class="ledger-title" style="margin-top:18px"><h3>YOU MISSED</h3><span>${missed.length}</span></div>
        <div class="chips">${missed.map(a => `<span class="k-${S.tierOf(a.pct).key}">${S.esc(a.name)}</span>`).join("")}</div>` : ""}
        <div class="share" id="share">${S.esc(share)}</div>
        <div class="actions"><button class="btn" id="copy" type="button">COPY RESULT</button>
          <button class="btn ghost" id="again" type="button">SPRINT AGAIN</button></div>
      </section>`;
      S.$("#copy", main).addEventListener("click", e => S.copy(share, e.currentTarget, S.$("#share", main)));
      S.$("#again", main).addEventListener("click", () => {
        if (!S.pass.active() && S.pass.left("sprint") <= 0) return S.pass.wall("Unlimited sprints with the Pass");
        S.pass.use("sprint"); run(main);
      });
    }
  }

  S.route("/sprint", main => intro(main));
})();
