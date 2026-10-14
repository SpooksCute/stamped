// The Stamped Pass: who has it, what free players can do, the upgrade screen, and cosmetics.
(function () {
  const S = window.S, CFG = S.cfg;
  const P = (S.pass = {});

  P.active = () => {
    if (CFG.TEST_MODE && S.store.get("testPass")) return true;
    const u = S.auth.user;
    if (!u || u.local) return false;
    if (!u.is_pass) return false;
    return !u.pass_until || Date.parse(u.pass_until) > Date.now();
  };

  // ---------- Daily play limits for free players ----------
  const LIMITS = { layover: CFG.FREE_LAYOVERS_PER_DAY, sprint: CFG.FREE_PLAYS_PER_MODE_PER_DAY, standing: CFG.FREE_PLAYS_PER_MODE_PER_DAY };
  const countsKey = () => "plays:" + S.todayKey();
  P.used = mode => (S.store.get(countsKey(), {})[mode] || 0);
  P.left = mode => (P.active() ? Infinity : Math.max(0, (LIMITS[mode] ?? 0) - P.used(mode)));
  P.use = mode => { const c = S.store.get(countsKey(), {}); c[mode] = (c[mode] || 0) + 1; S.store.set(countsKey(), c); };
  P.leftLabel = mode => (P.active() ? "Unlimited with Pass" : `${P.left(mode)} free ${P.left(mode) === 1 ? "play" : "plays"} left today`);

  // ---------- Cosmetics ----------
  P.COVERS = [
    { key: "navy", name: "Navy", free: true },
    { key: "burgundy", name: "Burgundy" },
    { key: "forest", name: "Forest" },
    { key: "onyx", name: "Onyx" },
    { key: "teal", name: "Lagoon" }
  ];
  P.INKS = [
    { key: "classic", name: "Classic", free: true },
    { key: "sepia", name: "Sepia" },
    { key: "neon", name: "Neon" },
    { key: "foil", name: "Gold foil" }
  ];
  P.style = () => {
    const u = S.auth.user;
    const local = S.store.get("style", { cover: "navy", ink: "classic" });
    let cover = u ? u.cover || local.cover : local.cover, ink = u ? u.ink || local.ink : local.ink;
    if (!P.active()) {
      if (!P.COVERS.find(c => c.key === cover)?.free) cover = "navy";
      if (!P.INKS.find(c => c.key === ink)?.free) ink = "classic";
    }
    return { cover, ink };
  };
  P.applyStyle = () => {
    const { cover, ink } = P.style();
    document.documentElement.dataset.cover = cover;
    document.documentElement.dataset.ink = ink;
  };
  P.setStyle = async fields => {
    S.store.set("style", { ...S.store.get("style", { cover: "navy", ink: "classic" }), ...fields });
    if (S.auth.user) await S.auth.update(fields);
    P.applyStyle();
  };

  // ---------- Upgrade screen ----------
  P.PERKS = [
    ["Unlimited Layovers", `Free players get ${CFG.FREE_LAYOVERS_PER_DAY} practice trips a day.`],
    ["Every game, no limits", "New Border Runs and Passport Grids on demand, plus unlimited Customs Sprints and Last Stamp Standing games."],
    ["The trip archive", "Play every daily trip you missed, back to Trip No. 0001."],
    ["Detailed stats", "Tier breakdown, average rarity, best stamps, and your score history."],
    ["Private leagues", "Start a league for your friends with a weekly leaderboard. Members join free."],
    ["Passport covers and inks", "Four extra covers and three stamp inks."]
  ];

  P.wall = reason => {
    const u = S.auth.user;
    const linksReady = !!(CFG.STRIPE_MONTHLY_LINK || CFG.STRIPE_YEARLY_LINK);
    const needsAccount = linksReady && (!u || u.local);
    const buy = (link, label, price, note) => link
      ? `<a class="btn ${note ? "" : "ghost"} buy" data-link="${S.esc(link)}" href="#" role="button">${label} · ${price}${note ? ` <small>${note}</small>` : ""}</a>` : "";
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal pass-modal" role="dialog" aria-modal="true" aria-labelledby="passTitle">
        <button class="x" type="button" aria-label="Close">×</button>
        <div class="pass-card">
          <div class="pass-eyebrow">Stamped Pass</div>
          <h2 id="passTitle">${reason ? S.esc(reason) : "Travel without limits"}</h2>
          <ul class="perks">${P.PERKS.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ul>
          <p class="free-note">The daily trip, today's Border Run, and today's Passport Grid stay free for everyone.</p>
          <div class="pass-actions">
            ${needsAccount ? `<a class="btn" href="#/account" data-close>Make a free account to subscribe</a>` : ""}
            ${!needsAccount ? buy(CFG.STRIPE_YEARLY_LINK, "Yearly", CFG.PRICE_YEARLY, "best value") + buy(CFG.STRIPE_MONTHLY_LINK, "Monthly", CFG.PRICE_MONTHLY) : ""}
            ${!linksReady ? `<p class="muted">Payments aren't connected yet. SETUP.md explains how to add Stripe.</p>` : ""}
            ${CFG.TEST_MODE ? `<button class="btn ghost" type="button" id="testPass">${S.store.get("testPass") ? "Turn off test Pass" : "Try the Pass (test mode)"}</button>` : ""}
          </div>
        </div>
      </div>`;
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    S.$(".x", overlay).addEventListener("click", close);
    S.$$("[data-close]", overlay).forEach(a => a.addEventListener("click", close));
    S.$$(".buy", overlay).forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const url = new URL(a.dataset.link);
      if (u && !u.local) { url.searchParams.set("client_reference_id", u.id); if (u.email) url.searchParams.set("prefilled_email", u.email); }
      location.href = url.toString();
    }));
    S.$("#testPass", overlay)?.addEventListener("click", () => {
      S.store.set("testPass", !S.store.get("testPass"));
      close(); P.applyStyle(); S.renderHeader(); S.render();
      S.toast(P.active() ? "Test Pass on. Paid features unlocked on this device." : "Test Pass off.");
    });
    S.$(".x", overlay).focus();
  };

  // A small inline lock used on Pass-only buttons and panels.
  P.lockHTML = text => `<button class="lock" type="button" data-wall="${S.esc(text)}"><span aria-hidden="true">🔒</span> ${S.esc(text)}</button>`;
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-wall]");
    if (b) { e.preventDefault(); P.wall(b.dataset.wall); }
  });
})();
