// Account (sign up, sign in, profile), the Pass page, and passport style.
(function () {
  const S = window.S, CFG = S.cfg;

  S.route("/account", (main, [tab]) => {
    const A = S.auth, u = A.user;
    if (u) return profile(main, u);
    const mode = tab === "signin" ? "signin" : tab === "reset" ? "reset" : "signup";

    if (!A.cloud) {
      main.innerHTML = `<section class="page">
        <p class="eyebrow">Account · test mode</p>
        <h2 class="title">Make your passport</h2>
        <p class="lede">The account server isn't connected yet, so this makes a profile saved on this device only. Once Supabase is set up, this page switches to real accounts with email and password.</p>
        <form id="f" class="row-form" autocomplete="off">
          <div class="field"><label for="uname">Traveler name</label><input type="text" id="uname" maxlength="20" placeholder="e.g. Kostandin" required></div>
          <button class="btn" type="submit">CREATE PROFILE</button>
        </form><div class="msg" id="msg" role="status"></div></section>`;
      S.$("#f", main).addEventListener("submit", async e => {
        e.preventDefault();
        await A.signUp({ username: S.$("#uname", main).value.trim() || "Traveler" });
        S.toast("Profile created."); S.go("/");
      });
      return;
    }

    const tabs = `<span class="seg">
        <button type="button" data-tab="" aria-pressed="${mode === "signup"}">Sign up</button>
        <button type="button" data-tab="signin" aria-pressed="${mode === "signin"}">Sign in</button></span>`;
    const forms = {
      signup: `<h2 class="title">Make your passport</h2>
        <p class="lede">Free. Keeps your streak, stats, and stamps on every device, and lets you join leagues.</p>
        <form id="f" class="grid-form">
          <div class="field"><label for="uname">Traveler name</label><input type="text" id="uname" maxlength="20" required autocomplete="nickname"></div>
          <div class="field"><label for="email">Email</label><input type="email" id="email" required autocomplete="email"></div>
          <div class="field"><label for="pw">Password</label><input type="password" id="pw" minlength="8" required autocomplete="new-password"></div>
          <p class="hint" style="margin:0">At least 8 characters.</p>
          <div class="actions" style="margin-top:4px"><button class="btn" type="submit">CREATE ACCOUNT</button></div>
        </form>`,
      signin: `<h2 class="title">Welcome back</h2>
        <form id="f" class="grid-form">
          <div class="field"><label for="email">Email</label><input type="email" id="email" required autocomplete="email"></div>
          <div class="field"><label for="pw">Password</label><input type="password" id="pw" required autocomplete="current-password"></div>
          <div class="actions" style="margin-top:4px"><button class="btn" type="submit">SIGN IN</button>
            <a class="btn ghost small" href="#/account/reset">FORGOT PASSWORD</a></div>
        </form>`,
      reset: `<h2 class="title">Reset your password</h2>
        <p class="lede">We'll email you a link to set a new one.</p>
        <form id="f" class="grid-form">
          <div class="field"><label for="email">Email</label><input type="email" id="email" required autocomplete="email"></div>
          <div class="actions" style="margin-top:4px"><button class="btn" type="submit">SEND LINK</button></div>
        </form>`
    };
    main.innerHTML = `<section class="page"><div class="page-head"><span><b>Account</b></span>${tabs}</div>${forms[mode]}<div class="msg" id="msg" role="status"></div></section>`;
    S.$$("[data-tab]", main).forEach(b => b.addEventListener("click", () => S.go("/account" + (b.dataset.tab ? "/" + b.dataset.tab : ""))));
    const msg = S.$("#msg", main);
    S.$("#f", main).addEventListener("submit", async e => {
      e.preventDefault();
      const btn = S.$("button[type=submit]", main); btn.disabled = true; msg.className = "msg"; msg.textContent = "";
      const email = S.$("#email", main).value.trim();
      let res;
      if (mode === "signup") res = await A.signUp({ email, password: S.$("#pw", main).value, username: S.$("#uname", main).value.trim() });
      else if (mode === "signin") res = await A.signIn({ email, password: S.$("#pw", main).value });
      else res = await A.resetPassword(email);
      btn.disabled = false;
      if (!res.ok) { msg.textContent = res.error; return; }
      if (mode === "reset") { msg.className = "msg ok"; msg.textContent = "Check your email for the reset link."; return; }
      if (res.confirm) { msg.className = "msg ok"; msg.textContent = "Almost done. Check your email to confirm your account, then sign in."; return; }
      S.toast(mode === "signup" ? "Welcome aboard." : "Signed in."); S.go("/");
    });
  });

  function profile(main, u) {
    const pass = S.pass.active();
    main.innerHTML = `<section class="page">
      <div class="page-head"><span><b>Account</b>${u.local ? " · test mode" : ""}</span>${pass ? `<span class="pill gold">Pass holder</span>` : ""}</div>
      <h2 class="title">${S.esc(u.username)}</h2>
      ${u.email ? `<p class="hint">${S.esc(u.email)}</p>` : ""}
      <form id="f" class="row-form">
        <div class="field"><label for="uname">Traveler name</label><input type="text" id="uname" maxlength="20" value="${S.esc(u.username)}"></div>
        <button class="btn alt" type="submit">SAVE</button>
      </form>
      <div class="msg" id="msg" role="status"></div>
      <div class="actions">
        <a class="btn ghost" href="#/stats">MY STATS</a>
        <a class="btn ghost" href="#/style">PASSPORT STYLE</a>
        ${pass && CFG.STRIPE_PORTAL_LINK && !S.store.get("testPass") ? `<a class="btn ghost" href="${S.esc(CFG.STRIPE_PORTAL_LINK)}">MANAGE SUBSCRIPTION</a>` : ""}
        ${pass ? "" : `<a class="btn" href="#/pass">GET THE PASS</a>`}
        <button class="btn ghost" type="button" id="out">SIGN OUT</button>
      </div>
    </section>`;
    S.$("#f", main).addEventListener("submit", async e => {
      e.preventDefault();
      const name = S.$("#uname", main).value.trim(), msg = S.$("#msg", main);
      if (name.length < 2) { msg.textContent = "Names need at least 2 characters."; return; }
      const res = await S.auth.update({ username: name });
      msg.className = res.ok ? "msg ok" : "msg"; msg.textContent = res.ok ? "Saved." : res.error;
    });
    S.$("#out", main).addEventListener("click", async () => { await S.auth.signOut(); S.toast("Signed out."); S.go("/"); });
  }

  // ---------- Pass page ----------
  S.route("/pass", main => {
    const pass = S.pass.active();
    const params = new URLSearchParams(location.search);
    main.innerHTML = `<section class="page">
      <p class="eyebrow">Stamped Pass</p>
      <h2 class="title">${pass ? "Your Pass is active" : "Travel without limits"}</h2>
      ${params.get("checkout") === "success" ? `<p class="msg ok">Payment received. Your Pass turns on within a minute. Refresh if it hasn't yet.</p>` : ""}
      <p class="lede">${pass ? "Everything below is unlocked." : `${S.esc(CFG.PRICE_MONTHLY)} a month or ${S.esc(CFG.PRICE_YEARLY)} a year. Cancel anytime.`}</p>
      <div class="ledger">${S.pass.PERKS.map(([t, d]) => `<div class="lrow" style="grid-template-columns:minmax(0,12rem) minmax(0,1fr)"><span class="nm"><b>${t}</b></span><span>${d}</span></div>`).join("")}</div>
      <p class="hint" style="margin-top:14px">Always free: the daily trip, today's Border Run, today's Passport Grid, ${CFG.FREE_LAYOVERS_PER_DAY} Layovers a day, one Sprint and one Last Stamp Standing game a day, and joining leagues.</p>
      <div class="actions">${pass ? `<a class="btn alt" href="#/style">PICK A COVER</a>` : `<button class="btn" type="button" data-wall="">GET THE PASS</button>`}</div>
    </section>`;
  });

  // ---------- Passport style ----------
  S.route("/style", main => {
    const pass = S.pass.active(), cur = S.pass.style();
    const coverColors = { navy: ["#16244a", "#1f3266"], burgundy: ["#4a1622", "#6a2232"], forest: ["#143a2a", "#1f5640"], onyx: ["#121214", "#2a2a30"], teal: ["#0d3d48", "#145a68"] };
    const inkColors = { classic: ["#66788a", "#1c8556", "#1f55c2", "#8737c6", "#b5780a"], sepia: ["#7a6650", "#6b5a2e", "#8a4a22", "#6e2f1f", "#a8620e"], neon: ["#5a6b80", "#00a86b", "#0077ff", "#d100d1", "#ff6a00"], foil: ["#8a7a4a", "#9c8226", "#b08a1a", "#c09010", "#d4a106"] };
    main.innerHTML = `<section class="page">
      <p class="eyebrow">Passport style</p>
      <h2 class="title">Make it yours</h2>
      <p class="lede">${pass ? "Pick a cover and a stamp ink." : "Navy and Classic ink are free. The rest come with the Pass."}</p>
      <p class="label">Cover</p>
      <div class="swatches">${S.pass.COVERS.map(c => `<button class="swatch" type="button" data-cover="${c.key}" aria-pressed="${cur.cover === c.key}">
        <span class="sw" style="background:linear-gradient(135deg, ${coverColors[c.key][1]}, ${coverColors[c.key][0]})"></span>
        <span><b>${c.name}</b><br><small>${c.free ? "Free" : pass ? "Pass" : "🔒 Pass"}</small></span></button>`).join("")}</div>
      <p class="label">Stamp ink</p>
      <div class="swatches">${S.pass.INKS.map(c => `<button class="swatch" type="button" data-ink="${c.key}" aria-pressed="${cur.ink === c.key}">
        <span class="sw inks">${inkColors[c.key].map(col => `<i style="background:${col}"></i>`).join("")}</span>
        <span><b>${c.name}</b><br><small>${c.free ? "Free" : pass ? "Pass" : "🔒 Pass"}</small></span></button>`).join("")}</div>
      <div class="stamp-zone">${S.stampHTML({ tier: "legend", title: "Liechtenstein", line: "0.4% of travelers", pts: 94, small: true })}</div>
    </section>`;
    const pick = async (field, key, free) => {
      if (!free && !pass) return S.pass.wall("Passport covers and inks come with the Pass");
      await S.pass.setStyle({ [field]: key });
      S.render();
    };
    S.$$("[data-cover]", main).forEach(b => b.addEventListener("click", () => pick("cover", b.dataset.cover, S.pass.COVERS.find(c => c.key === b.dataset.cover).free)));
    S.$$("[data-ink]", main).forEach(b => b.addEventListener("click", () => pick("ink", b.dataset.ink, S.pass.INKS.find(c => c.key === b.dataset.ink).free)));
  });
})();
