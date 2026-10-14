// Private leagues: a weekly leaderboard of daily trip scores for a group of friends.
(function () {
  const S = window.S;

  // Monday of the current week, as a day key.
  const weekStart = () => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return S.keyOf(d); };

  S.route("/leagues", async (main, [openId]) => {
    const head = `<p class="eyebrow">Private leagues</p><h2 class="title">Beat your friends every week</h2>`;
    if (!S.auth.cloud) {
      main.innerHTML = `<section class="page">${head}
        <p class="lede">Leagues give your group its own weekly leaderboard for the daily trip. Anyone can join with a code, and starting one comes with the Pass.</p>
        <p class="hint">Leagues need the account server, which isn't connected yet. SETUP.md has the steps.</p></section>`;
      return;
    }
    if (!S.auth.user) {
      main.innerHTML = `<section class="page">${head}
        <p class="lede">Leagues give your group its own weekly leaderboard for the daily trip. Joining is free. Starting one comes with the Pass.</p>
        <div class="actions"><a class="btn" href="#/account">SIGN IN TO JOIN</a></div></section>`;
      return;
    }
    main.innerHTML = `<section class="page">${head}<p class="hint">Loading your leagues…</p></section>`;
    let mine = [];
    try { mine = await S.leagues.mine(); } catch (e) { main.innerHTML = `<section class="page">${head}<p class="msg">Couldn't load leagues: ${S.esc(e.message)}</p></section>`; return; }
    if (S.currentPath().split("/")[1] !== "leagues") return;

    const pass = S.pass.active();
    main.innerHTML = `<section class="page">${head}
      <div class="row-form" style="margin-top:6px">
        <form class="row-form" id="join" style="flex:1 1 260px">
          <div class="field"><label for="code">Join with a code</label><input type="text" id="code" placeholder="e.g. K7Q2XD" maxlength="8" autocapitalize="characters"></div>
          <button class="btn alt" type="submit">JOIN</button>
        </form>
      </div>
      <div class="msg" id="jmsg" role="status"></div>
      ${pass ? `<form class="row-form" id="create" style="margin-top:14px">
          <div class="field"><label for="lname">Start a league</label><input type="text" id="lname" placeholder="League name" maxlength="40"></div>
          <button class="btn" type="submit">CREATE</button>
        </form><div class="msg" id="cmsg" role="status"></div>`
      : `<div class="actions">${S.pass.lockHTML("Start your own league with the Pass")}</div>`}
    </section>
    ${mine.length ? mine.map(l => `<section class="page" data-league="${l.id}">
        <div class="page-head"><span><b>${S.esc(l.name)}</b></span><span>Code <b>${S.esc(l.code)}</b></span></div>
        <div class="ledger-title" style="margin-top:10px"><h3>THIS WEEK</h3><span>since ${S.prettyDate(S.fromKey(weekStart()))}</span></div>
        <div class="board"><p class="hint">Loading…</p></div>
        <div class="actions"><button class="btn ghost small" type="button" data-copy="${S.esc(l.code)}">COPY INVITE CODE</button>
          <button class="btn ghost small" type="button" data-leave="${l.id}">LEAVE</button></div>
      </section>`).join("") : `<section class="page"><p class="lede">You're not in any leagues yet. Ask a friend for their code${pass ? " or start your own" : ""}.</p></section>`}`;

    S.$("#join", main).addEventListener("submit", async e => {
      e.preventDefault();
      const m = S.$("#jmsg", main);
      try { await S.leagues.join(S.$("#code", main).value); S.toast("Joined the league."); S.render(); }
      catch (err) { m.className = "msg"; m.textContent = err.message.includes("not found") ? "No league has that code." : err.message; }
    });
    S.$("#create", main)?.addEventListener("submit", async e => {
      e.preventDefault();
      const name = S.$("#lname", main).value.trim(), m = S.$("#cmsg", main);
      if (!name) { m.textContent = "Give your league a name."; return; }
      try { const code = await S.leagues.create(name); S.toast(`League created. Invite code ${code}`); S.render(); }
      catch (err) { m.className = "msg"; m.textContent = err.message.includes("pass") ? "Starting a league needs an active Pass." : err.message; }
    });
    S.$$("[data-copy]", main).forEach(b => b.addEventListener("click", () => S.copy(`Join my Stamped league: code ${b.dataset.copy} at ${location.origin}${location.pathname}#/leagues`, b)));
    S.$$("[data-leave]", main).forEach(b => b.addEventListener("click", async () => {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "TAP AGAIN TO LEAVE"; return; }
      try { await S.leagues.leave(b.dataset.leave); S.toast("You left the league."); S.render(); } catch (err) { S.toast(err.message); }
    }));

    for (const l of mine) {
      const box = S.$(`[data-league="${l.id}"] .board`, main);
      try {
        const rows = await S.leagues.board(l.id, weekStart());
        box.innerHTML = rows.length ? `<div class="scroll"><table class="table"><thead><tr><th>#</th><th>Traveler</th><th class="n">Trips</th><th class="n">Points</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${S.esc(r.username)}${r.user_id === S.auth.user.id ? " (you)" : ""}</td><td class="n">${r.trips}</td><td class="n">${r.points}</td></tr>`).join("")}
          </tbody></table></div>` : `<p class="hint">No trips played this week yet.</p>`;
      } catch (err) { box.innerHTML = `<p class="msg">${S.esc(err.message)}</p>`; }
    }
  });
})();
