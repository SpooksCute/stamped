// Home: today's trip up top, then the other games and the Pass.
(function () {
  const S = window.S;

  S.route("/", main => {
    const today = new Date(), key = S.todayKey();
    const trip = S.store.get("trip:" + key);
    const tripDone = trip?.results?.length === 5;
    const tripScore = tripDone ? trip.results.reduce((t, r) => t + r.points, 0) : 0;
    const br = S.store.get("borderrun:" + key), grid = S.store.get("grid:" + key);
    const streak = S.results.streak();
    const pass = S.pass.active();
    const u = S.auth.user;

    const status = (done, label) => done ? `<span class="pill">Done today</span>` : `<span class="pill soft">${label}</span>`;
    const tile = (href, name, text, pills) => `<a class="tile" href="${href}"><h3>${name}</h3><p>${text}</p><div class="meta">${pills}</div></a>`;

    main.innerHTML = `
      <section class="hero">
        <h1>Name the country<br>nobody else will.</h1>
        <p>Stamped is a daily geography game where the rarest right answer wins. Five destinations a day. Collect stamps, keep your streak, beat your friends.</p>
      </section>

      <section class="page">
        <div class="page-head"><span>Trip <b>No. ${String(S.tripNo(today)).padStart(4, "0")}</b> · ${S.prettyDate(today)}</span>
          <span>${streak ? `Streak <b>${streak}</b>` : ""}</span></div>
        <div class="today" style="margin-top:10px">
          <div>
            <h2 class="title">${tripDone ? "Today's trip is stamped" : "Today's trip is open"}</h2>
            <p class="lede">${tripDone ? `You scored ${tripScore} of 500. A new trip opens at midnight.` : "Five questions. Answer each with a country. Common answers earn a Tourist stamp. Answers almost nobody gives earn a Legend."}</p>
            <div class="actions" style="margin-top:6px">
              <a class="btn" href="#/play">${tripDone ? "SEE MY PASSPORT" : "START TODAY'S TRIP"}</a>
              <a class="btn ghost" href="#/layover">PLAY A LAYOVER</a>
            </div>
          </div>
          <div>${S.stampHTML({ tier: tripDone ? (tripScore >= 400 ? "legend" : tripScore >= 300 ? "pioneer" : tripScore >= 200 ? "explorer" : tripScore >= 100 ? "traveler" : "tourist") : "legend", title: tripDone ? tripScore + " pts" : "Trip " + S.tripNo(today), line: S.prettyDate(today).toUpperCase(), small: true })}</div>
        </div>
      </section>

      <section class="page">
        <p class="eyebrow">More games</p>
        <h2 class="title">Four more ways to travel</h2>
        <div class="tiles" style="margin-top:12px">
          ${tile("#/border-run", "Border Run", "Get from one country to another by naming neighbors. Beat par.", status(br?.done || br?.gaveUp, "New route daily"))}
          ${tile("#/grid", "Passport Grid", "Fill a 3×3 grid where every cell needs a country that fits its row and column.", status(grid?.done, "New grid daily"))}
          ${tile("#/sprint", "Customs Sprint", "One category, 60 seconds. Name as many countries as you can.", `<span class="pill soft">${S.esc(S.pass.leftLabel("sprint"))}</span>`)}
          ${tile("#/standing", "Last Stamp Standing", "Pass the phone. Take turns naming countries until someone freezes.", `<span class="pill soft">2–6 players</span>`)}
        </div>
      </section>

      <section class="page">
        <p class="eyebrow">How scoring works</p>
        <ol class="how-list">
          <li><span><b>Every answer gets a rarity.</b> It's the share of travelers who'd give that same answer.</span></li>
          <li><span><b>Rarer answers score more.</b> Up to 100 points per stamp, from Tourist up to Legend.</span></li>
          <li><span><b>Wrong answers get denied.</b> Zero points, and you can't take it back.</span></li>
        </ol>
        ${S.legendHTML()}
      </section>

      <section class="page">
        <div class="today">
          <div>
            <p class="eyebrow">Stamped Pass</p>
            <h2 class="title">${pass ? "You have the Pass" : "Travel without limits"}</h2>
            <p class="lede">${pass ? "Every game, the full archive, detailed stats, leagues, and every passport style are unlocked." : `Unlimited Layovers, every game mode without limits, the trip archive, detailed stats, private leagues, and passport styles. ${S.esc(S.cfg.PRICE_MONTHLY)} a month or ${S.esc(S.cfg.PRICE_YEARLY)} a year.`}</p>
            <div class="actions" style="margin-top:6px">
              ${pass ? `<a class="btn alt" href="#/style">CHANGE PASSPORT STYLE</a>` : `<a class="btn" href="#/pass">SEE THE PASS</a>`}
              ${u ? "" : `<a class="btn ghost" href="#/account">MAKE A FREE ACCOUNT</a>`}
            </div>
          </div>
        </div>
      </section>`;
  });
})();
