// Boot: header, auth, router.
(function () {
  const S = window.S;

  S.renderHeader = () => {
    const u = S.auth.user, pass = S.pass.active();
    const streak = S.results.streak();
    S.$("#me").innerHTML = `
      ${streak ? `<span class="chip" title="Daily streak" style="cursor:default">🔥 ${streak}</span>` : ""}
      ${pass ? `<a class="chip pass" href="#/pass">PASS</a>` : `<a class="chip" href="#/pass">Get Pass</a>`}
      <a class="chip" href="#/account">${u ? S.esc(u.username) : "Sign in"}</a>`;
  };

  // Pages that hold a game in progress shouldn't restart when sign-in state changes.
  const GAME_ROUTES = ["play", "layover", "border-run", "grid", "sprint", "standing"];

  S.auth.onChange(() => {
    S.pass.applyStyle();
    S.renderHeader();
    const base = S.currentPath().split("/")[1] || "";
    if (!GAME_ROUTES.includes(base) && S.booted) S.render();
  });

  window.addEventListener("hashchange", S.render);

  (async () => {
    S.pass.applyStyle();
    S.renderHeader();
    try { await S.auth.init(); } catch (e) { console.error(e); }
    S.booted = true;
    S.render();
  })();
})();
