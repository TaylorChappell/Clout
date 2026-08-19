(() => {
  "use strict";

  const API_URL = "https://cloutstudiosserver-production.up.railway.app";
  const HOLDER_STORAGE_KEY = "clout_holder_session";
  const CLOUT_GAME_URL = "";
  const CLOUT_GROUP_URL = "";
  const CLOUT_TOKEN_CA = "";

  const state = {
    holder: readSavedHolderSession(),
    connecting: false,
    authError: "",
    content: { updates: [], statements: [] },
    contentLoading: true,
    dashboard: null,
    dashboardLoading: false,
    dashboardError: "",
    preferenceBusy: false,
    backendVersion: null,
    statementIndex: 0,
  };

  const app = document.getElementById("app");
  const money = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });
  const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

  class ApiError extends Error {
    constructor(message, status, payload = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.payload = payload;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortWallet(value) {
    if (!value) return "";
    return `${String(value).slice(0, 4)}...${String(value).slice(-4)}`;
  }

  function formatDate(value) {
    if (!value) return "Pending";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function coinMark(small = false) {
    return `<span class="${small ? "coin-mark coin-mark-small" : "coin-mark"}">C</span>`;
  }

  function icon(name) {
    const icons = {
      arrow: "→", back: "←", wallet: "◈", refresh: "↻", logout: "↪", check: "✓",
      shield: "◆", game: "▣", dollar: "$", external: "↗", copy: "⧉", close: "×"
    };
    return `<span aria-hidden="true">${icons[name] || "•"}</span>`;
  }

  function humanizeApiFailure(status, payload, path) {
    const backendMessage = payload?.error || payload?.message;
    if (status === 404 && path.startsWith("/v1/public/holder/")) {
      return "The CLOUT holder login API is not available on the deployed backend. Railway is still serving a backend without the holder auth routes.";
    }
    if (backendMessage && backendMessage !== "Not Found") return backendMessage;
    if (status === 401) return "Your CLOUT login has expired. Connect your wallet again.";
    if (status === 403) return "This request was rejected by the CLOUT backend.";
    if (status === 429) return "Too many requests. Try again shortly.";
    if (status >= 500) return "The CLOUT backend is temporarily unavailable.";
    return `CLOUT API request failed (${status}).`;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch (error) {
      throw new ApiError("Could not reach the CLOUT backend. Check the Railway service and frontend CORS origin.", 0, { cause: String(error) });
    }
    const contentType = response.headers.get("content-type") || "";
    let payload = null;
    if (contentType.includes("application/json")) payload = await response.json().catch(() => null);
    else {
      const text = await response.text().catch(() => "");
      payload = text ? { message: text } : null;
    }
    if (!response.ok) throw new ApiError(humanizeApiFailure(response.status, payload, path), response.status, payload);
    return payload;
  }

  const authHeaders = (token) => token ? { Authorization: `Bearer ${token}` } : {};
  const getPublicContent = () => api("/v1/public/content");
  const getBackendVersion = () => api("/v1/public/version");
  const createHolderChallenge = (walletAddress) => api("/v1/public/holder/challenge", { method: "POST", body: JSON.stringify({ walletAddress }) });
  const verifyHolderChallenge = (payload) => api("/v1/public/holder/verify", { method: "POST", body: JSON.stringify(payload) });
  const getHolderSession = (token) => api("/v1/public/holder/session", { headers: authHeaders(token) });
  const getHolderDashboard = (token) => api("/v1/public/holder/dashboard", { headers: authHeaders(token) });
  const updateHolderPreferences = (token, payoutPreference) => api("/v1/public/holder/preferences", { method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ payoutPreference }) });
  const logoutHolder = (token) => api("/v1/public/holder/logout", { method: "POST", headers: authHeaders(token) });

  function phantomProvider() {
    const provider = window.phantom?.solana || window.solana;
    return provider?.isPhantom ? provider : null;
  }

  function readSavedHolderSession() {
    try {
      const raw = localStorage.getItem(HOLDER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionToken || !parsed?.walletAddress) return null;
      return parsed;
    } catch { return null; }
  }

  function saveHolderSession(session) {
    const saved = { sessionToken: session.sessionToken, walletAddress: session.walletAddress, expiresAt: session.expiresAt, profile: session.profile || null };
    localStorage.setItem(HOLDER_STORAGE_KEY, JSON.stringify(saved));
    return saved;
  }

  function clearSavedHolderSession() { localStorage.removeItem(HOLDER_STORAGE_KEY); }

  async function restoreHolderLogin() {
    const saved = readSavedHolderSession();
    if (!saved) return null;
    try {
      const session = await getHolderSession(saved.sessionToken);
      return saveHolderSession({ ...saved, walletAddress: session.walletAddress, expiresAt: session.expiresAt, profile: session.profile });
    } catch (error) {
      if (error?.status === 401) { clearSavedHolderSession(); return null; }
      throw error;
    }
  }

  async function connectAndAuthenticateHolder() {
    const provider = phantomProvider();
    if (!provider) throw new Error("Phantom is not installed. Install or enable Phantom, then try again.");
    const connected = await provider.connect();
    const publicKey = connected?.publicKey || provider.publicKey;
    if (!publicKey) throw new Error("Phantom connected without returning a public key.");
    const walletAddress = publicKey.toString();

    const challenge = await createHolderChallenge(walletAddress);
    if (!challenge?.challengeId || !challenge?.message) throw new Error("The CLOUT backend returned an invalid wallet challenge.");

    const encodedMessage = new TextEncoder().encode(challenge.message);
    const signed = await provider.signMessage(encodedMessage, "utf8");
    if (!signed?.signature) throw new Error("Phantom did not return a message signature.");

    const verified = await verifyHolderChallenge({
      challengeId: challenge.challengeId,
      walletAddress,
      signature: Array.from(signed.signature),
    });
    if (!verified?.sessionToken || !verified?.walletAddress) throw new Error("The CLOUT backend did not create a holder session.");
    return saveHolderSession(verified);
  }

  function notice(message, kind = "error") {
    if (!message) return "";
    return `<div class="notice notice-${kind}" role="status"><span>${escapeHtml(message)}</span><button type="button" data-action="close-notice" aria-label="Close message">${icon("close")}</button></div>`;
  }

  function headerHtml() {
    const h = state.holder;
    const actions = h
      ? `<button class="button button-muted wallet-pill" data-action="dashboard">${icon("wallet")}${escapeHtml(shortWallet(h.walletAddress))}</button><button class="button button-primary" data-action="dashboard">Open Dashboard</button>`
      : `<button class="button button-primary" data-action="connect" ${state.connecting ? "disabled" : ""}>${coinMark(true)}${state.connecting ? "Connecting" : "Connect Wallet"}</button>`;
    return `<header class="site-header">
      <a class="brand" href="#top" aria-label="CLOUT Studios home">${coinMark(true)}<span>CLOUT</span></a>
      <nav class="desktop-nav" aria-label="Main navigation"><a href="#games">Our Games</a><a href="#updates">Updates</a><a href="#statements">Statements</a><a href="#holders">Holders</a></nav>
      <div class="header-actions">${actions}</div>
    </header>`;
  }

  function heroHtml() {
    return `<section class="hero" id="top"><div class="hero-glow" aria-hidden="true"></div><div class="hero-copy">
      <div class="eyebrow"><span></span>CLOUT STUDIOS</div>
      <h1>Market-driven games.<br><em>One transparent studio.</em></h1>
      <p>CLOUT builds Roblox experiences around markets, competition and player-driven systems, with published reporting for the community that backs the studio.</p>
      <div class="hero-actions"><a class="button button-primary button-large" href="#games">Explore our games ${icon("arrow")}</a>
      ${state.holder ? `<button class="button button-ghost button-large" data-action="dashboard">Open holder dashboard</button>` : `<button class="button button-ghost button-large" data-action="connect" ${state.connecting ? "disabled" : ""}>Connect holder wallet</button>`}</div>
    </div><div class="hero-orbit" aria-hidden="true"><div class="orbit-line orbit-one"></div><div class="orbit-line orbit-two"></div><div class="hero-coin">${coinMark()}</div><span class="orbit-label orbit-label-one">ROBLOX</span><span class="orbit-label orbit-label-two">SOLANA</span><span class="orbit-label orbit-label-three">CLOUT</span></div></section>`;
  }

  function gamesHtml() {
    return `<section class="section" id="games"><div class="section-heading"><div><span class="kicker">OUR GAMES</span><h2>Built around markets, not menus.</h2></div><p>Each title has its own economy and progression. CLOUT Studios reporting sits above them at the studio level.</p></div>
      <div class="games-grid"><article class="game-card game-card-featured"><div class="game-art clout-art"><div class="art-grid"></div>${coinMark()}<div class="ticker-strip">CLOUT / ROBUX / MARKET / TRADE / COMPETE</div></div><div class="game-body"><div class="game-meta"><span>LIVE</span><span>ROBLOX</span></div><h3>CLOUT</h3><p>Trade, compete and build your portfolio inside a Roblox market simulator.</p>${CLOUT_GAME_URL ? `<a class="text-link" href="${escapeHtml(CLOUT_GAME_URL)}" target="_blank" rel="noreferrer">Play on Roblox ${icon("external")}</a>` : `<span class="text-link text-link-disabled">Game link not configured</span>`}</div></article>
      <article class="game-card"><div class="game-art paper-art"><div class="paper-bars"><i></i><i></i><i></i><i></i><i></i></div><span class="paper-word">PAPER</span></div><div class="game-body"><div class="game-meta"><span class="muted-tag">COMING SOON</span><span>ROBLOX</span></div><h3>Paper Trade</h3><p>Paper trading for prediction markets and stocks, built as a competitive Roblox experience.</p><span class="text-link text-link-disabled">In development</span></div></article></div></section>`;
  }

  function updatesHtml() {
    const updates = state.content.updates || [];
    if (state.contentLoading) return `<section class="section" id="updates"><div class="section-heading compact-heading"><div><span class="kicker">UPDATES</span><h2>What changed.</h2></div></div><div class="loading-row">Loading published updates</div></section>`;
    if (!updates.length) return `<section class="section" id="updates"><div class="section-heading compact-heading"><div><span class="kicker">UPDATES</span><h2>What changed.</h2></div></div><div class="empty-state">No updates have been published yet.</div></section>`;
    const cards = updates.slice(0,6).map((item, index) => `<button type="button" class="update-card ${index === 0 ? "update-card-featured" : ""}" data-update-index="${index}"><div class="update-topline"><span>${escapeHtml(item.category || "studio")}</span><time>${escapeHtml(item.date || formatDate(item.publishedAt))}</time></div>${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl.startsWith("http") ? item.imageUrl : `${API_URL}${item.imageUrl.replace("/api/backend", "/v1")}`)}" alt="">` : ""}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><span class="read-more">Read update ${icon("arrow")}</span></button>`).join("");
    return `<section class="section" id="updates"><div class="section-heading compact-heading"><div><span class="kicker">UPDATES</span><h2>What changed.</h2></div></div><div class="updates-grid">${cards}</div></section>`;
  }

  function statementsHtml() {
    const ordered = [...(state.content.statements || [])].reverse();
    const s = ordered[state.statementIndex] || null;
    if (state.contentLoading) return `<section class="section statement-section" id="statements"><div class="section-heading"><div><span class="kicker">WEEKLY STATEMENTS</span><h2>Studio reporting, published.</h2></div><p>Revenue, operating costs, buybacks and holder distributions are recorded period by period.</p></div><div class="loading-row">Loading statements</div></section>`;
    if (!s) return `<section class="section statement-section" id="statements"><div class="section-heading"><div><span class="kicker">WEEKLY STATEMENTS</span><h2>Studio reporting, published.</h2></div><p>Revenue, operating costs, buybacks and holder distributions are recorded period by period.</p></div><div class="empty-state">No weekly statements have been published yet.</div></section>`;
    return `<section class="section statement-section" id="statements"><div class="section-heading"><div><span class="kicker">WEEKLY STATEMENTS</span><h2>Studio reporting, published.</h2></div><p>Revenue, operating costs, buybacks and holder distributions are recorded period by period.</p></div><div class="statement-shell"><div class="statement-nav"><button type="button" data-action="statement-older" ${state.statementIndex >= ordered.length - 1 ? "disabled" : ""}>←</button><div><strong>${escapeHtml(s.period)}</strong><span>${escapeHtml(s.published)}</span></div><button type="button" data-action="statement-newer" ${state.statementIndex <= 0 ? "disabled" : ""}>→</button></div><div class="statement-metrics"><div><span>Game revenue</span><strong>${integer.format(s.gameRevenueRobux || 0)} R$</strong></div><div><span>Coin revenue</span><strong>${money.format(s.coinRevenueSol || 0)} SOL</strong></div><div><span>Advertising</span><strong>${integer.format(s.advertisingRobux || 0)} R$</strong></div><div><span>Maintenance</span><strong>${integer.format(s.maintenanceRobux || 0)} R$</strong></div><div><span>Buybacks</span><strong>${money.format(s.buybacksSol || 0)} SOL</strong></div><div class="metric-accent"><span>Holder distributions</span><strong>${money.format(s.distributionsSol || 0)} SOL</strong></div></div></div></section>`;
  }

  function holderSectionHtml() {
    return `<section class="section holder-section" id="holders"><div class="holder-number">1%</div><div class="holder-copy"><span class="kicker">HOLDER ACCESS</span><h2>Hold enough to qualify. Track everything in one place.</h2><p>Wallets holding at least 1% of the published CLOUT supply at the relevant snapshot can qualify for that distribution period. Eligibility and payout records are calculated from the official token and the studio's published distribution data.</p><div class="holder-points"><span>${icon("shield")} Wallet ownership verified by signed message</span><span>${icon("dollar")} Choose SOL or Robux payout preference</span><span>${icon("game")} Roblox account profile stored against your holder wallet</span></div>${state.holder ? `<button class="button button-primary button-large" data-action="dashboard">Open Dashboard ${icon("arrow")}</button>` : `<button class="button button-primary button-large" data-action="connect" ${state.connecting ? "disabled" : ""}>Connect Holder Wallet ${icon("arrow")}</button>`}</div></section>`;
  }

  function footerHtml() {
    return `<footer class="site-footer"><div class="footer-brand">${coinMark(true)}<strong>CLOUT Studios</strong></div><div class="footer-links">${CLOUT_GROUP_URL ? `<a href="${escapeHtml(CLOUT_GROUP_URL)}" target="_blank" rel="noreferrer">Roblox Group</a>` : ""}<a href="#statements">Statements</a><a href="#holders">Holder access</a></div>${CLOUT_TOKEN_CA ? `<div class="footer-ca"><span>CA ${escapeHtml(shortWallet(CLOUT_TOKEN_CA))}</span><button class="copy-button" data-copy="${escapeHtml(CLOUT_TOKEN_CA)}">${icon("copy")} Copy</button></div>` : ""}<span class="copyright">© ${new Date().getFullYear()} CLOUT Studios</span></footer>`;
  }

  function siteHtml() {
    return `<div class="site-shell">${headerHtml()}${state.authError ? `<div class="global-notice">${notice(state.authError)}</div>` : ""}${state.backendVersion && state.backendVersion.holderAuth !== true ? `<div class="global-notice">${notice("The deployed CLOUT backend reports that holder authentication is not enabled.")}</div>` : ""}${heroHtml()}${gamesHtml()}${updatesHtml()}${statementsHtml()}${holderSectionHtml()}${footerHtml()}</div>`;
  }

  function dashboardHtml() {
    const holder = state.holder;
    const data = state.dashboard;
    const holdings = data?.holdings;
    const payouts = data?.payouts;
    const profile = data?.profile || holder?.profile || {};
    const history = payouts?.history || [];
    return `<main class="dashboard-page"><header class="dashboard-header"><a class="brand" href="#top">${coinMark(true)}<span>CLOUT</span></a><div class="dashboard-header-actions"><button class="button button-muted" data-action="back-site">${icon("back")} Back to site</button><button class="button button-muted" data-action="logout">${icon("logout")} Log out</button></div></header><section class="dashboard-content"><div class="dashboard-title-row"><div><span class="kicker">HOLDER DASHBOARD</span><h1>My CLOUT</h1><div class="wallet-address-row">${icon("wallet")}<span>${escapeHtml(holder.walletAddress)}</span><button class="copy-button" data-copy="${escapeHtml(holder.walletAddress)}">${icon("copy")} Copy wallet</button></div></div><button class="button button-muted" data-action="refresh-dashboard" ${state.dashboardLoading ? "disabled" : ""}>${icon("refresh")} Refresh</button></div>${state.dashboardError ? notice(state.dashboardError) : ""}${state.dashboardLoading && !data ? `<div class="dashboard-loader">Loading your holder data</div>` : ""}
      <div class="dashboard-metrics"><article class="dashboard-metric dashboard-metric-main"><span>CLOUT held</span><strong>${holdings ? money.format(holdings.balance || 0) : "..."}</strong><small>${escapeHtml(holdings?.error || "Live token balance")}</small></article><article class="dashboard-metric"><span>Ownership</span><strong>${holdings ? `${money.format(holdings.ownershipPercent || 0)}%` : "..."}</strong><small>Published supply</small></article><article class="dashboard-metric"><span>Eligibility</span><strong class="${holdings?.eligible ? "positive" : ""}">${holdings ? (holdings.eligible ? "Qualified" : "Not qualified") : "..."}</strong><small>1% snapshot threshold</small></article><article class="dashboard-metric"><span>Total SOL paid</span><strong>${payouts ? `${money.format(payouts.totalSol || 0)} SOL` : "..."}</strong><small>${payouts ? `${payouts.payoutCount || 0} confirmed payouts` : "Confirmed distributions"}</small></article><article class="dashboard-metric"><span>Total Robux paid</span><strong>${payouts ? `${integer.format(payouts.totalRobux || 0)} R$` : "..."}</strong><small>Recorded distributions</small></article></div>
      <div class="dashboard-grid"><article class="dashboard-panel"><div class="panel-heading"><div><span class="kicker">PAYOUT METHOD</span><h2>Where should distributions go?</h2></div></div><p class="panel-copy">Your choice is saved against this wallet on the CLOUT backend.</p><div class="preference-grid">${["sol","robux"].map(v => { const active = (profile?.payoutPreference || "sol") === v; const title = v === "sol" ? "SOL" : "Robux"; const copy = v === "sol" ? "Receive eligible holder distributions in SOL." : "Receive eligible distributions through the CLOUT Roblox payout flow."; return `<button type="button" class="preference-card ${active ? "active" : ""}" data-preference="${v}" ${state.preferenceBusy ? "disabled" : ""}><div><strong>${title}</strong>${active ? icon("check") : ""}</div><span>${copy}</span></button>`; }).join("")}</div></article><article class="dashboard-panel"><div class="panel-heading"><div><span class="kicker">ROBLOX ACCOUNT</span><h2>Holder identity</h2></div></div>${profile?.robloxUsername ? `<div class="roblox-linked"><div>${icon("game")}<div><strong>@${escapeHtml(profile.robloxUsername)}</strong><span>${profile.robloxGroupMember ? "CLOUT group member" : "Group membership not confirmed"}</span></div></div>${profile.robloxGroupMember ? `<span class="status-chip">${icon("check")} Verified</span>` : ""}</div>` : `<div class="roblox-empty">${icon("game")}<div><strong>No Roblox account linked yet</strong><span>The backend profile is ready for Roblox identity verification, but the current backend package does not yet expose the username verification endpoint.</span></div></div>`}</article></div>
      <article class="dashboard-panel payout-panel"><div class="panel-heading"><div><span class="kicker">PAYOUT HISTORY</span><h2>Confirmed distributions</h2></div></div>${history.length ? `<div class="payout-table"><div class="payout-row payout-head"><span>Date</span><span>Asset</span><span>Amount</span><span>Transaction</span></div>${history.map(item => `<div class="payout-row"><span>${escapeHtml(formatDate(item.completedAt))}</span><span>${escapeHtml(String(item.asset || "sol").toUpperCase())}</span><strong>${money.format(item.amountSol || 0)} SOL</strong><span>${item.signature ? escapeHtml(shortWallet(item.signature)) : "Confirmed"}</span></div>`).join("")}</div>` : `<div class="empty-state compact-empty">No confirmed payouts recorded for this wallet yet.</div>`}</article></section></main>`;
  }

  function render() {
    const dashboardView = location.hash === "#dashboard" && state.holder;
    app.innerHTML = dashboardView ? dashboardHtml() : siteHtml();
    bindEvents();
  }

  async function loadDashboard() {
    if (!state.holder?.sessionToken) return;
    state.dashboardLoading = true; state.dashboardError = ""; render();
    try {
      const result = await getHolderDashboard(state.holder.sessionToken);
      state.dashboard = result;
      state.holder = { ...state.holder, profile: result.profile };
      saveHolderSession(state.holder);
    } catch (error) {
      if (error?.status === 401) {
        clearSavedHolderSession(); state.holder = null; state.dashboard = null; location.hash = "#top"; state.authError = "Your holder session expired. Connect your wallet again.";
      } else state.dashboardError = error instanceof Error ? error.message : "Could not load holder dashboard.";
    } finally { state.dashboardLoading = false; render(); }
  }

  async function connect() {
    if (state.connecting) return;
    state.connecting = true; state.authError = ""; render();
    try {
      const authenticated = await connectAndAuthenticateHolder();
      state.holder = authenticated; state.dashboard = null; location.hash = "#dashboard"; await loadDashboard();
    } catch (error) {
      state.authError = error instanceof Error ? error.message : "Wallet login failed.";
    } finally { state.connecting = false; render(); }
  }

  async function logout() {
    const token = state.holder?.sessionToken;
    try { if (token) await logoutHolder(token); } catch (_) {}
    clearSavedHolderSession(); state.holder = null; state.dashboard = null; state.dashboardError = ""; location.hash = "#top"; render();
  }

  async function setPreference(value) {
    if (!state.holder?.sessionToken || state.preferenceBusy) return;
    state.preferenceBusy = true; state.dashboardError = ""; render();
    try {
      const result = await updateHolderPreferences(state.holder.sessionToken, value);
      if (state.dashboard) state.dashboard = { ...state.dashboard, profile: result.profile };
      state.holder = { ...state.holder, profile: result.profile }; saveHolderSession(state.holder);
    } catch (error) { state.dashboardError = error instanceof Error ? error.message : "Could not save payout preference."; }
    finally { state.preferenceBusy = false; render(); }
  }

  function bindEvents() {
    document.querySelectorAll('[data-action="connect"]').forEach(el => el.addEventListener("click", connect));
    document.querySelectorAll('[data-action="dashboard"]').forEach(el => el.addEventListener("click", () => { location.hash = "#dashboard"; render(); if (!state.dashboard) loadDashboard(); }));
    document.querySelectorAll('[data-action="back-site"]').forEach(el => el.addEventListener("click", () => { location.hash = "#top"; render(); }));
    document.querySelectorAll('[data-action="logout"]').forEach(el => el.addEventListener("click", logout));
    document.querySelectorAll('[data-action="refresh-dashboard"]').forEach(el => el.addEventListener("click", loadDashboard));
    document.querySelectorAll('[data-action="close-notice"]').forEach(el => el.addEventListener("click", () => { state.authError = ""; state.dashboardError = ""; render(); }));
    document.querySelectorAll('[data-preference]').forEach(el => el.addEventListener("click", () => setPreference(el.dataset.preference)));
    document.querySelectorAll('[data-copy]').forEach(el => el.addEventListener("click", async () => { try { await navigator.clipboard.writeText(el.dataset.copy); const old = el.innerHTML; el.textContent = "✓ Copied"; setTimeout(() => { el.innerHTML = old; }, 1200); } catch (_) {} }));
    document.querySelectorAll('[data-action="statement-older"]').forEach(el => el.addEventListener("click", () => { state.statementIndex++; render(); document.getElementById("statements")?.scrollIntoView(); }));
    document.querySelectorAll('[data-action="statement-newer"]').forEach(el => el.addEventListener("click", () => { state.statementIndex = Math.max(0, state.statementIndex - 1); render(); document.getElementById("statements")?.scrollIntoView(); }));
    document.querySelectorAll('[data-update-index]').forEach(el => el.addEventListener("click", () => openUpdateModal(Number(el.dataset.updateIndex))));
  }

  function openUpdateModal(index) {
    const item = (state.content.updates || [])[index];
    if (!item) return;
    const wrapper = document.createElement("div");
    wrapper.className = "modal-backdrop";
    wrapper.innerHTML = `<article class="update-modal"><button class="modal-close" type="button">×</button><span class="kicker">${escapeHtml(item.category || "UPDATE")}</span><h2>${escapeHtml(item.title)}</h2><p class="modal-date">${escapeHtml(item.date || formatDate(item.publishedAt))}</p><div class="modal-copy">${escapeHtml(item.detail || item.summary)}</div></article>`;
    wrapper.addEventListener("click", e => { if (e.target === wrapper) wrapper.remove(); });
    wrapper.querySelector(".modal-close").addEventListener("click", () => wrapper.remove());
    document.body.appendChild(wrapper);
  }

  window.addEventListener("hashchange", () => { render(); if (location.hash === "#dashboard" && state.holder && !state.dashboard) loadDashboard(); });

  const provider = phantomProvider();
  if (provider?.on) {
    provider.on("accountChanged", (publicKey) => {
      const newAddress = publicKey ? publicKey.toString() : null;
      if (state.holder?.walletAddress && (!newAddress || newAddress !== state.holder.walletAddress)) {
        state.authError = "Phantom changed accounts. Your CLOUT login was not changed automatically. Connect the new wallet to authenticate it.";
        render();
      }
    });
  }

  render();

  Promise.allSettled([
    getPublicContent().then(result => { state.content = { updates: result?.updates || [], statements: result?.statements || [] }; }).catch(() => {}).finally(() => { state.contentLoading = false; render(); }),
    getBackendVersion().then(result => { state.backendVersion = result; render(); }).catch(() => {}),
    state.holder?.sessionToken ? restoreHolderLogin().then(restored => { state.holder = restored; if (!restored) state.dashboard = null; render(); if (restored && location.hash === "#dashboard") loadDashboard(); }).catch(error => { state.authError = error instanceof Error ? error.message : "Could not restore holder login."; render(); }) : Promise.resolve(),
  ]);
})();
