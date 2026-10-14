// Last Stamp Standing: pass-and-play. Players take turns naming countries in a category.
// A wrong answer, a repeat, or running out of time knocks you out.
(function () {
  const S = window.S;
  const POOL = S.QUESTIONS.filter(q => q.answers.length >= 15);
  const TURN = 15;

  function setup(main) {
    const saved = S.store.get("standingPlayers", ["Player 1", "Player 2"]);
    const pass = S.pass.active(), left = S.pass.left("standing");
    main.innerHTML = `<section class="page">
      <p class="eyebrow">Last Stamp Standing</p>
      <h2 class="title">Pass the phone. Don't freeze.</h2>
      <p class="lede">Everyone gets the same category. Take turns naming a country that fits. Repeat one, miss, or run out the ${TURN}-second clock and you're out. Last traveler standing wins.</p>
      <p class="label">Players (2 to 6)</p>
      <div class="players" id="plist">${saved.map((n, i) => playerRow(n, i)).join("")}</div>
      <div class="actions" style="margin-top:6px">
        <button class="btn ghost small" type="button" id="add">ADD PLAYER</button>
      </div>
      <p class="hint" style="margin-top:14px">${S.pass.leftLabel("standing")}</p>
      <div class="actions">${pass || left > 0 ? `<button class="btn" id="go" type="button">START GAME</button>` : S.pass.lockHTML("Unlimited games with the Pass")}</div>
      <div class="msg" id="msg" role="status"></div>
    </section>`;
    const list = S.$("#plist", main);
    const names = () => S.$$("input", list).map(i => i.value.trim()).filter(Boolean);
    S.$("#add", main).addEventListener("click", () => {
      const n = S.$$("input", list).length;
      if (n >= 6) return;
      list.insertAdjacentHTML("beforeend", playerRow("Player " + (n + 1), n));
    });
    list.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b && S.$$(".player", list).length > 2) b.closest(".player").remove(); });
    S.$("#go", main)?.addEventListener("click", () => {
      const ps = names();
      if (ps.length < 2) { S.$("#msg", main).textContent = "Add at least two players."; return; }
      S.store.set("standingPlayers", ps);
      S.pass.use("standing");
      game(main, ps);
    });
  }
  const playerRow = (n, i) => `<div class="player"><input type="text" aria-label="Player ${i + 1} name" value="${S.esc(n)}" maxlength="20"><button class="btn ghost small" type="button" data-rm aria-label="Remove player">✕</button></div>`;

  function game(main, names) {
    const Q = POOL[Math.floor(Math.random() * POOL.length)];
    const players = names.map(n => ({ name: n, out: false, count: 0 }));
    const usedList = [];
    let turn = 0, tick = null, deadline = 0, over = false, log = "";

    const alive = () => players.filter(p => !p.out);
    const nextTurn = () => { do { turn = (turn + 1) % players.length; } while (players[turn].out); };

    function knock(reason) {
      players[turn].out = true;
      log = `${players[turn].name} is out: ${reason}`;
      if (alive().length <= 1) return finish();
      nextTurn(); render();
    }

    function render() {
      clearInterval(tick);
      const p = players[turn];
      main.innerHTML = `<section class="page">
        <div class="page-head"><span><b>Last Stamp Standing</b></span><span class="timer" id="timer">${TURN}</span></div>
        <h2 class="question" style="margin-top:8px">${S.esc(Q.q)}</h2>
        <p class="hint">${usedList.length} of ${Q.answers.length} used.</p>
        <div class="players">${players.map((x, i) => `<div class="player${x.out ? " out" : ""}${i === turn ? " turn" : ""}"><span>${S.esc(x.name)}</span><span class="pill soft">${x.count}</span></div>`).join("")}</div>
        <form class="row-form" id="f" autocomplete="off">
          <div class="field"><label for="guess">${S.esc(p.name)}, your turn</label><input type="text" id="guess" list="countries" autocapitalize="words"></div>
          <button class="btn" type="submit">STAMP</button>
        </form>
        <div class="msg${log.includes(" out:") ? "" : " ok"}" id="msg" role="status">${S.esc(log)}</div>
        <div class="chips">${usedList.map(u => `<span class="k-${S.tierOf(Q.pctOf[u]).key}">${S.esc(u)}</span>`).join("")}</div>
        ${S.datalistHTML()}
      </section>`;
      const input = S.$("#guess", main), timer = S.$("#timer", main);
      input.focus({ preventScroll: true });
      deadline = performance.now() + TURN * 1000;
      tick = setInterval(() => {
        const s = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        timer.textContent = s; timer.classList.toggle("low", s <= 5);
        if (s <= 0 && !over) knock("ran out of time");
      }, 200);
      S.cleanup = () => clearInterval(tick);
      S.$("#f", main).addEventListener("submit", e => {
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) return;
        const c = S.toCountry(raw);
        if (!c) { S.$("#msg", main).className = "msg"; S.$("#msg", main).textContent = `"${raw}" isn't a country on the list. Try again.`; input.value = ""; return; }
        if (usedList.includes(c)) return knock(`${c} was already used`);
        if (Q.pctOf[c] == null) return knock(`${c} doesn't fit`);
        usedList.push(c); players[turn].count++;
        log = `${players[turn].name} stamped ${c}.`;
        if (usedList.length === Q.answers.length) return finish(true);
        nextTurn(); render();
      });
    }

    function finish(exhausted) {
      over = true; clearInterval(tick);
      const winners = alive();
      const title = exhausted ? "Every country used" : `${winners[0].name} wins`;
      const share = `STAMPED Last Stamp Standing\n${Q.q}\n🏆 ${winners.map(w => w.name).join(", ")} · ${usedList.length} countries stamped`;
      S.results.save("standing", S.todayKey(), usedList.length, { q: Q.q, players: players.length });
      const missed = Q.answers.filter(a => !usedList.includes(a.name));
      main.innerHTML = `<section class="page">
        <p class="eyebrow">${S.esc(Q.q)}</p>
        <div class="stamp-zone">${S.stampHTML({ tier: "legend", title, line: `${usedList.length} countries stamped`, slam: true })}</div>
        <p class="hint">${S.esc(log)}</p>
        <div class="players">${players.map(x => `<div class="player${x.out ? " out" : ""}"><span>${S.esc(x.name)}</span><span class="pill soft">${x.count}</span></div>`).join("")}</div>
        ${missed.length ? `<div class="ledger-title" style="margin-top:14px"><h3>NOBODY SAID</h3><span>${missed.length}</span></div>
        <div class="chips">${missed.map(a => `<span class="k-${S.tierOf(a.pct).key}">${S.esc(a.name)}</span>`).join("")}</div>` : ""}
        <div class="share" id="share">${S.esc(share)}</div>
        <div class="actions"><button class="btn" id="again" type="button">REMATCH</button>
          <button class="btn ghost" id="copy" type="button">COPY RESULT</button>
          <button class="btn ghost" id="edit" type="button">CHANGE PLAYERS</button></div>
      </section>`;
      S.$("#copy", main).addEventListener("click", e => S.copy(share, e.currentTarget, S.$("#share", main)));
      S.$("#edit", main).addEventListener("click", () => setup(main));
      S.$("#again", main).addEventListener("click", () => {
        if (!S.pass.active() && S.pass.left("standing") <= 0) return S.pass.wall("Unlimited games with the Pass");
        S.pass.use("standing"); game(main, names);
      });
    }
    render();
  }

  S.route("/standing", main => setup(main));
})();
