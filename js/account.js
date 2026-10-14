// Accounts, saved results, and leagues.
// With Supabase keys in config.js, accounts are real (email + password, stored by Supabase).
// Without them, the site runs in test mode: a local profile on this device, no password.
(function () {
  const S = window.S, CFG = S.cfg;
  const cloud = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = cloud ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const A = (S.auth = { cloud, sb, user: null, listeners: [] });

  A.onChange = fn => A.listeners.push(fn);
  const emit = () => A.listeners.forEach(fn => { try { fn(A.user); } catch (e) { console.error(e); } });

  async function loadProfile(sessionUser) {
    if (!sessionUser) { A.user = null; return; }
    const { data, error } = await sb.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle();
    if (error) console.error(error);
    A.user = {
      id: sessionUser.id, email: sessionUser.email,
      username: data?.username || sessionUser.user_metadata?.username || sessionUser.email.split("@")[0],
      is_pass: !!data?.is_pass, pass_until: data?.pass_until || null,
      cover: data?.cover || "navy", ink: data?.ink || "classic"
    };
    await S.results.pull();
  }

  A.init = async () => {
    if (cloud) {
      const { data } = await sb.auth.getSession();
      await loadProfile(data.session?.user);
      sb.auth.onAuthStateChange((_evt, session) => { loadProfile(session?.user).then(emit); });
    } else {
      const local = S.store.get("localProfile");
      A.user = local ? { ...local, local: true } : null;
    }
    emit();
  };

  A.signUp = async ({ email, password, username }) => {
    if (!cloud) {
      const p = { id: "local", username: username || "Traveler", cover: "navy", ink: "classic" };
      S.store.set("localProfile", p); A.user = { ...p, local: true }; emit(); return { ok: true };
    }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) return { ok: false, error: error.message };
    if (!data.session) return { ok: true, confirm: true };
    return { ok: true };
  };

  A.signIn = async ({ email, password }) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  };

  A.resetPassword = async email => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#/account" });
    return error ? { ok: false, error: error.message } : { ok: true };
  };

  A.signOut = async () => {
    if (cloud) await sb.auth.signOut();
    else { S.store.del("localProfile"); A.user = null; emit(); }
  };

  A.update = async fields => {
    if (!A.user) return { ok: false, error: "Not signed in." };
    if (cloud) {
      const { error } = await sb.from("profiles").update(fields).eq("id", A.user.id);
      if (error) return { ok: false, error: error.message.includes("duplicate") ? "That username is taken." : error.message };
    } else {
      S.store.set("localProfile", { ...S.store.get("localProfile"), ...fields });
    }
    Object.assign(A.user, fields); emit();
    return { ok: true };
  };

  // ---------- Results ----------
  // Every finished game is kept on this device. Signed-in players also save to the cloud.
  const R = (S.results = {});
  R.all = () => S.store.get("results", []);
  R.save = async (mode, dayKey, score, detail) => {
    const list = R.all();
    const i = list.findIndex(r => r.mode === mode && r.day === dayKey && mode === "daily");
    const row = { mode, day: dayKey, score, detail, at: Date.now() };
    if (i >= 0) list[i] = row; else list.push(row);
    S.store.set("results", list.slice(-2000));
    if (cloud && A.user) {
      // Daily trips keep one row per day; other modes get a row per run.
      const run_id = mode === "daily" ? "daily" : String(row.at);
      const rowOut = { user_id: A.user.id, mode, day_key: dayKey, run_id, score, detail, played_at: new Date().toISOString() };
      const { error } = await sb.from("results").upsert(rowOut, { onConflict: "user_id,mode,day_key,run_id" });
      if (error) console.error(error);
    }
  };
  R.pull = async () => {
    if (!cloud || !A.user) return;
    const { data, error } = await sb.from("results").select("mode,day_key,score,detail,played_at").eq("user_id", A.user.id).order("played_at", { ascending: true }).limit(2000);
    if (error) { console.error(error); return; }
    const local = R.all();
    const seen = new Set(local.map(r => r.mode + "|" + r.day + "|" + r.at));
    data.forEach(r => {
      const at = Date.parse(r.played_at);
      if (r.mode === "daily" && local.some(x => x.mode === "daily" && x.day === r.day_key)) return;
      if (!seen.has(r.mode + "|" + r.day_key + "|" + at)) local.push({ mode: r.mode, day: r.day_key, score: r.score, detail: r.detail, at });
    });
    local.sort((a, b) => a.at - b.at);
    S.store.set("results", local.slice(-2000));
  };

  // Streak counts consecutive days with a finished daily trip.
  R.streak = () => {
    const days = new Set(R.all().filter(r => r.mode === "daily").map(r => r.day));
    let n = 0, d = new Date();
    if (!days.has(S.keyOf(d))) d.setDate(d.getDate() - 1);
    while (days.has(S.keyOf(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  R.best = mode => R.all().filter(r => r.mode === mode).reduce((m, r) => Math.max(m, r.score), 0);

  // ---------- Leagues (cloud only) ----------
  const L = (S.leagues = {});
  L.mine = async () => {
    const { data, error } = await sb.from("league_members").select("league_id, leagues(id,name,code,owner_id)").eq("user_id", A.user.id);
    if (error) throw error;
    return data.map(r => r.leagues).filter(Boolean);
  };
  L.create = async name => {
    const { data, error } = await sb.rpc("create_league", { league_name: name });
    if (error) throw error;
    return data;
  };
  L.join = async code => {
    const { data, error } = await sb.rpc("join_league", { join_code: code.trim().toUpperCase() });
    if (error) throw error;
    return data;
  };
  L.leave = async leagueId => {
    const { error } = await sb.from("league_members").delete().eq("league_id", leagueId).eq("user_id", A.user.id);
    if (error) throw error;
  };
  L.board = async (leagueId, sinceKey) => {
    const { data, error } = await sb.rpc("league_board", { lid: leagueId, since_key: sinceKey });
    if (error) throw error;
    return data;
  };
})();
