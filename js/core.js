// Shared helpers used by every page. Everything hangs off window.S.
(function () {
  const S = (window.S = {});
  const CFG = window.STAMPED_CONFIG;
  S.cfg = CFG;

  // ---------- Storage (local, per browser) ----------
  S.store = {
    get(k, fallback = null) { try { const v = JSON.parse(localStorage.getItem("stamped:" + k)); return v ?? fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem("stamped:" + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem("stamped:" + k); } catch {} }
  };

  // ---------- Text ----------
  S.esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  S.norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/^the /, "").replace(/\s+/g, " ").trim();
  const LOOKUP = {};
  COUNTRIES.forEach(c => { LOOKUP[S.norm(c)] = c; });
  Object.entries(ALIASES).forEach(([k, v]) => { LOOKUP[S.norm(k)] = v; });
  S.toCountry = raw => LOOKUP[S.norm(raw || "")] || null;
  S.datalistHTML = () => `<datalist id="countries">${COUNTRIES.map(c => `<option value="${S.esc(c)}"></option>`).join("")}</datalist>`;

  // ---------- Questions ----------
  S.QUESTIONS = RAW_QUESTIONS.map(([cat, q, a], id) => {
    const pairs = a.split(",").map(s => { const m = s.trim().match(/^(.*\S)\s+([\d.]+)$/); return [m[1], parseFloat(m[2])]; });
    const sum = pairs.reduce((t, p) => t + p[1], 0);
    const answers = pairs.map(([name, w]) => ({ name, pct: (w / sum) * 100 })).sort((x, y) => y.pct - x.pct);
    const pctOf = {}; answers.forEach(x => { pctOf[x.name] = x.pct; });
    return { id, cat, q, answers, pctOf, set: new Set(answers.map(x => x.name)) };
  });
  // Short labels for grid headers: "A country that borders Germany" -> "Borders Germany"
  const LABEL_RULES = [
    [/^A country that is an? /, ""],
    [/^A country that is /, ""],
    [/^A country that has /, ""],
    [/^A country that /, ""],
    [/^A country whose name /, "Name "],
    [/^A country (where|with|in|on) /, "$1 "],
    [/^A country the /, "the "],
    [/^(A|An) /, ""]
  ];
  S.shortLabel = q => {
    let s = q;
    for (const [re, rep] of LABEL_RULES) { if (re.test(s)) { s = s.replace(re, rep); break; } }
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // ---------- Rarity ----------
  S.TIERS = [
    { key: "tourist", name: "Tourist", min: 15, sq: "⬜" },
    { key: "traveler", name: "Traveler", min: 7, sq: "🟩" },
    { key: "explorer", name: "Explorer", min: 3, sq: "🟦" },
    { key: "pioneer", name: "Pioneer", min: 1, sq: "🟪" },
    { key: "legend", name: "Legend", min: 0, sq: "🟨" }
  ];
  S.tierOf = pct => S.TIERS.find(t => pct >= t.min);
  S.tierByKey = k => S.TIERS.find(t => t.key === k);
  S.pointsOf = pct => Math.round(100 * (1 - Math.sqrt(Math.min(100, pct) / 100)));
  S.fmtPct = p => (p < 1 ? p.toFixed(1) : String(Math.round(p))) + "%";

  // ---------- Randomness ----------
  S.rng = seedStr => {
    let h = 2166136261;
    for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    if (!h) h = 1;
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000003) / 1000003; };
  };
  S.shuffle = (arr, rand) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Dates ----------
  const pad = n => String(n).padStart(2, "0");
  S.keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  S.dayNum = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  S.fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  S.today = () => new Date();
  S.todayKey = () => S.keyOf(new Date());
  S.LAUNCH = S.fromKey(CFG.LAUNCH_DATE);
  S.tripNo = d => Math.max(1, S.dayNum(d) - S.dayNum(S.LAUNCH) + 1);
  S.prettyDate = d => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  // ---------- Daily trip schedule ----------
  // Walks a shuffled deck so nothing repeats within a cycle. Each day gets 2–3 border questions.
  const cycleCache = {};
  function cycleSchedule(cycle) {
    if (cycleCache[cycle]) return cycleCache[cycle];
    const deck = S.shuffle(S.QUESTIONS.map(q => q.id), S.rng("stamped-cycle-" + cycle));
    const b = deck.filter(i => S.QUESTIONS[i].cat === "borders"), o = deck.filter(i => S.QUESTIONS[i].cat !== "borders");
    const days = [];
    for (let d = 0; ; d++) {
      const nb = d % 2 ? 2 : 3, no = 5 - nb;
      if (b.length < nb || o.length < no) break;
      days.push(S.shuffle([...b.splice(0, nb), ...o.splice(0, no)], S.rng("stamped-day-" + cycle + "-" + d)));
    }
    return (cycleCache[cycle] = days);
  }
  const CYCLE_LEN = cycleSchedule(0).length;
  S.dailyIds = d => { const n = S.dayNum(d); return cycleSchedule(Math.floor(n / CYCLE_LEN))[n % CYCLE_LEN]; };

  // ---------- UI helpers ----------
  S.$ = (sel, root = document) => root.querySelector(sel);
  S.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  S.toast = msg => {
    let t = S.$("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  };
  S.copy = (text, btn, fallbackEl) => {
    const done = () => { if (btn) btn.textContent = "Copied"; };
    const fallback = () => {
      if (fallbackEl) { const sel = getSelection(), r = document.createRange(); r.selectNodeContents(fallbackEl); sel.removeAllRanges(); sel.addRange(r); }
      if (btn) btn.textContent = "Selected. Press Ctrl+C";
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch { fallback(); }
  };

  // Stamp markup shared by games.
  S.stampHTML = ({ tier, title, line, pts, small, slam }) => {
    const t = tier ? S.tierByKey(tier) : null;
    return `<div class="stamp ${t ? "t-" + t.key : "t-denied"}${slam ? " slam" : ""}${small ? " small" : ""}">
      <div class="s-tier">${t ? t.name.toUpperCase() : "ENTRY DENIED"}</div>
      <div class="s-title">${S.esc(title)}</div>
      ${line ? `<div class="s-line">${S.esc(line)}</div>` : ""}
      ${pts != null ? `<div class="s-pts">+${pts}</div>` : ""}
    </div>`;
  };

  // ---------- Router ----------
  S.routes = {};
  S.route = (path, render) => { S.routes[path] = render; };
  S.go = path => { if (location.hash !== "#" + path) location.hash = path; else S.render(); };
  S.currentPath = () => (location.hash.replace(/^#/, "") || "/");
  S.render = () => {
    const path = S.currentPath();
    const [base, ...rest] = path.split("/").filter(Boolean);
    const key = "/" + (base || "");
    const view = S.routes[key] || S.routes["/"];
    if (S.cleanup) { try { S.cleanup(); } catch {} S.cleanup = null; }
    const main = S.$("#main");
    main.innerHTML = "";
    S.$$(".nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + key || (key === "/" && a.getAttribute("href") === "#/")));
    view(main, rest);
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
})();
