(() => {
  'use strict';

  const API_URL = 'https://cloutstudiosserver-production.up.railway.app';
  const HOLDER_KEY = 'clout_holder_session';
  const GAME_URL = '';
  const GROUP_URL = '';

  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
  const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

  let holder = readSession();
  let dashboard = null;
  let publicContent = null;
  let statements = [];
  let statementIndex = 0;
  let statementCurrency = 'usd';
  let connecting = false;

  function readSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOLDER_KEY) || 'null');
      return parsed?.sessionToken && parsed?.walletAddress ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveSession(payload) {
    holder = {
      sessionToken: payload.sessionToken || holder?.sessionToken,
      walletAddress: payload.walletAddress || payload.wallet || holder?.walletAddress,
      expiresAt: payload.expiresAt || holder?.expiresAt,
      profile: payload.profile || holder?.profile || null,
    };
    localStorage.setItem(HOLDER_KEY, JSON.stringify(holder));
    return holder;
  }

  function clearSession() {
    localStorage.removeItem(HOLDER_KEY);
    holder = null;
    dashboard = null;
  }

  function phantom() {
    const provider = window.phantom?.solana || window.solana;
    return provider?.isPhantom ? provider : null;
  }

  function shortWallet(value) {
    return value ? `${value.slice(0, 4)}...${value.slice(-4)}` : '';
  }

  function formatDate(value) {
    if (!value) return 'Pending';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    })[char]);
  }

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  }

  function apiErrorMessage(status, payload, path) {
    const serverMessage = payload?.error || payload?.message;
    if (status === 404 && path.startsWith('/v1/public/holder/')) {
      return `The CLOUT website loaded correctly, but the Railway backend does not currently expose ${path}. Deploy the holder-auth backend before connecting.`;
    }
    if (status === 401) return 'Your CLOUT holder session has expired. Connect your wallet again.';
    if (serverMessage && serverMessage !== 'Not Found') return serverMessage;
    if (status >= 500) return 'The CLOUT backend is temporarily unavailable.';
    return `CLOUT API request failed (${status}).`;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch {
      throw new ApiError('Could not reach the CLOUT backend. Check Railway and the FRONTEND_ORIGIN CORS setting.', 0, null);
    }
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json')
      ? await response.json().catch(() => null)
      : { message: await response.text().catch(() => '') };
    if (!response.ok) throw new ApiError(apiErrorMessage(response.status, payload, path), response.status, payload);
    return payload;
  }

  function bearer(token) {
    return { Authorization: `Bearer ${token}` };
  }

  function showNotice(message, kind = 'error', target = 'global-notice') {
    const root = $(target);
    if (!root) return;
    if (!message) {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;
    root.innerHTML = `<div class="notice ${kind === 'success' ? 'success' : ''}"><span>${escapeHtml(message)}</span><button type="button" aria-label="Close">×</button></div>`;
    root.querySelector('button').onclick = () => showNotice('', kind, target);
  }

  function updateAuthUi() {
    const root = $('header-auth');
    if (!root) return;
    if (holder) {
      root.innerHTML = `
        <button class="btn btn-line" id="wallet-pill" type="button">${escapeHtml(shortWallet(holder.walletAddress))}</button>
        <button class="btn btn-solid" id="open-dashboard" type="button"><span class="mini-mark">C</span> Open Dashboard</button>`;
      $('wallet-pill').onclick = openDashboard;
      $('open-dashboard').onclick = openDashboard;
      document.querySelectorAll('.wallet-action').forEach((button) => { button.textContent = 'Open Dashboard'; });
    } else {
      root.innerHTML = `<button class="btn btn-solid" id="connect-wallet-top" type="button" ${connecting ? 'disabled' : ''}><span class="mini-mark">C</span> ${connecting ? 'Connecting' : 'Connect Wallet'}</button>`;
      $('connect-wallet-top').onclick = connectWallet;
      document.querySelectorAll('.wallet-action').forEach((button) => { button.textContent = 'Connect Wallet'; });
    }
  }

  async function connectWallet() {
    if (connecting) return;
    connecting = true;
    updateAuthUi();
    showNotice('');
    try {
      const provider = phantom();
      if (!provider) throw new Error('Phantom wallet is not installed or enabled.');

      const connection = await provider.connect();
      const publicKey = connection?.publicKey || provider.publicKey;
      if (!publicKey) throw new Error('Phantom did not return a wallet address.');
      const walletAddress = publicKey.toString();

      const challenge = await api('/v1/public/holder/challenge', {
        method: 'POST',
        body: JSON.stringify({ walletAddress }),
      });
      if (!challenge?.challengeId || !challenge?.message) throw new Error('The backend returned an invalid wallet challenge.');

      const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), 'utf8');
      if (!signed?.signature) throw new Error('Phantom did not return a signature.');

      const verified = await api('/v1/public/holder/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          walletAddress,
          signature: Array.from(signed.signature),
        }),
      });
      if (!verified?.sessionToken) throw new Error('The backend verified the wallet but did not create a holder session.');

      saveSession(verified);
      updateAuthUi();
      await openDashboard();
    } catch (error) {
      showNotice(error?.message || 'Wallet authentication failed.');
    } finally {
      connecting = false;
      updateAuthUi();
    }
  }

  async function restoreSession() {
    if (!holder?.sessionToken) return;
    try {
      const restored = await api('/v1/public/holder/session', { headers: bearer(holder.sessionToken) });
      saveSession({ ...restored, sessionToken: holder.sessionToken });
      updateAuthUi();
      if (location.hash === '#dashboard') await openDashboard();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        updateAuthUi();
      } else {
        showNotice(error.message);
      }
    }
  }

  async function logout() {
    try {
      if (holder?.sessionToken) {
        await api('/v1/public/holder/logout', { method: 'POST', headers: bearer(holder.sessionToken) });
      }
    } catch { /* local logout still proceeds */ }
    clearSession();
    updateAuthUi();
    closeDashboard();
  }

  async function openDashboard() {
    if (!holder) return connectWallet();
    $('public-site').hidden = true;
    $('holder-dashboard').hidden = false;
    $('dashboard-wallet').textContent = holder.walletAddress;
    location.hash = 'dashboard';
    await loadDashboard();
  }

  function closeDashboard() {
    $('holder-dashboard').hidden = true;
    $('public-site').hidden = false;
    if (location.hash === '#dashboard') history.replaceState(null, '', `${location.pathname}${location.search}#top`);
  }

  async function loadDashboard() {
    if (!holder?.sessionToken) return;
    showNotice('', 'error', 'dashboard-notice');
    try {
      dashboard = await api('/v1/public/holder/dashboard', { headers: bearer(holder.sessionToken) });
      renderDashboard();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        updateAuthUi();
        closeDashboard();
        showNotice('Your holder session expired. Connect your wallet again.');
      } else {
        showNotice(error.message, 'error', 'dashboard-notice');
      }
    }
  }

  function renderDashboard() {
    const holdings = dashboard?.holdings || {};
    const payouts = dashboard?.payouts || {};
    const profile = dashboard?.profile || holder?.profile || {};

    $('metric-balance').textContent = money.format(Number(holdings.balance || 0));
    $('metric-ownership').textContent = `${money.format(Number(holdings.ownershipPercent || 0))}%`;
    $('metric-eligibility').textContent = holdings.eligible ? 'Qualified' : 'Not qualified';
    $('metric-eligibility').style.color = holdings.eligible ? 'var(--green)' : '';
    $('metric-sol').textContent = `${money.format(Number(payouts.totalSol || 0))} SOL`;
    $('metric-robux').textContent = `${integer.format(Number(payouts.totalRobux || 0))} R$`;

    document.querySelectorAll('[data-payout-preference]').forEach((button) => {
      button.classList.toggle('active', (profile.payoutPreference || 'sol') === button.dataset.payoutPreference);
    });

    const roblox = $('roblox-status');
    if (profile.robloxUsername) {
      roblox.innerHTML = `<strong>@${escapeHtml(profile.robloxUsername)}</strong><span>${profile.robloxGroupMember ? 'CLOUT group membership verified.' : 'Roblox account linked. Group membership is not currently verified.'}</span>`;
    } else {
      roblox.innerHTML = `<strong>No Roblox account linked</strong><span>Robux payouts require a verified account in the CLOUT group.</span>${GROUP_URL ? `<a class="arrow-link" href="${escapeHtml(GROUP_URL)}" target="_blank" rel="noreferrer">Join CLOUT group ↗</a>` : ''}`;
    }

    const history = payouts.history || [];
    $('payout-history').innerHTML = history.length
      ? `<div class="history-row history-head"><span>Date</span><span>Asset</span><span>Amount</span><span>Transaction</span></div>${history.map((entry) => `
          <div class="history-row">
            <span>${escapeHtml(formatDate(entry.completedAt || entry.createdAt))}</span>
            <span>${escapeHtml((entry.asset || 'SOL').toUpperCase())}</span>
            <strong>${money.format(Number(entry.amountSol || 0))} SOL</strong>
            <span>${escapeHtml(shortWallet(entry.signature || 'Confirmed'))}</span>
          </div>`).join('')}`
      : '<div class="empty-row">No confirmed payouts recorded yet.</div>';
  }

  async function setPreference(preference) {
    if (!holder?.sessionToken) return;
    try {
      const result = await api('/v1/public/holder/preferences', {
        method: 'PATCH',
        headers: bearer(holder.sessionToken),
        body: JSON.stringify({ payoutPreference: preference }),
      });
      dashboard = { ...(dashboard || {}), profile: result.profile };
      saveSession({ ...holder, profile: result.profile });
      renderDashboard();
      showNotice('Payout preference saved.', 'success', 'dashboard-notice');
    } catch (error) {
      showNotice(error.message, 'error', 'dashboard-notice');
    }
  }

  async function loadPublicContent() {
    try {
      publicContent = await api('/v1/public/content');
      renderUpdates(publicContent?.updates || []);
      statements = [...(publicContent?.statements || [])];
      if (statements.length > 1) {
        statements.sort((a, b) => new Date(b.publishedAt || b.published || b.periodEnd || 0) - new Date(a.publishedAt || a.published || a.periodEnd || 0));
      }
      renderStatement();
    } catch {
      $('updates-grid').innerHTML = '<div class="section-loading">No published updates available.</div>';
      $('statement-container').innerHTML = '<div class="section-loading">No weekly statements available.</div>';
    }
  }

  function renderUpdates(updates) {
    const root = $('updates-grid');
    const visible = updates.slice(0, 6);
    if (!visible.length) {
      root.innerHTML = '<div class="section-loading">No updates have been published yet.</div>';
      return;
    }
    root.innerHTML = visible.map((item, index) => `
      <button type="button" class="update-card ${index === 0 ? 'featured' : ''}" data-update-index="${index}">
        <div class="update-meta"><span>${escapeHtml(item.category || 'studio')}</span><time>${escapeHtml(item.date || formatDate(item.publishedAt))}</time></div>
        <h3>${escapeHtml(item.title || 'Studio update')}</h3>
        <p>${escapeHtml(item.summary || '')}</p>
        <span class="update-read">Read update ↗</span>
      </button>`).join('');
    root.querySelectorAll('[data-update-index]').forEach((button) => {
      button.onclick = () => openUpdate(visible[Number(button.dataset.updateIndex)]);
    });
  }

  function openUpdate(item) {
    $('modal-category').textContent = item.category || 'UPDATE';
    $('modal-title').textContent = item.title || 'Studio update';
    $('modal-date').textContent = item.date || formatDate(item.publishedAt);
    $('modal-detail').textContent = item.detail || item.summary || '';
    $('update-modal').hidden = false;
  }

  function closeUpdate() {
    $('update-modal').hidden = true;
  }

  function pickNumber(obj, keys) {
    for (const key of keys) {
      const value = Number(obj?.[key]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  function formatStatementValue(metric, value, statement) {
    if (statementCurrency === 'sol') {
      if (metric.includes('robux')) {
        const rate = pickNumber(statement, ['robuxPerSol', 'robux_per_sol']);
        return rate ? `${money.format(value / rate)} SOL` : `${money.format(value)} SOL`;
      }
      return `${money.format(value)} SOL`;
    }
    if (statementCurrency === 'robux') {
      if (metric.includes('sol')) {
        const rate = pickNumber(statement, ['robuxPerSol', 'robux_per_sol']);
        return rate ? `${integer.format(value * rate)} R$` : `${integer.format(value)} R$`;
      }
      return `${integer.format(value)} R$`;
    }
    const usdPerSol = pickNumber(statement, ['usdPerSol', 'solUsd', 'sol_usd']);
    const usdPerRobux = pickNumber(statement, ['usdPerRobux', 'robuxUsd', 'robux_usd']);
    if (metric.includes('sol')) return usdPerSol ? `$${money.format(value * usdPerSol)}` : `${money.format(value)} SOL`;
    if (metric.includes('robux')) return usdPerRobux ? `$${money.format(value * usdPerRobux)}` : `${integer.format(value)} R$`;
    return `$${money.format(value)}`;
  }

  function renderStatement() {
    const root = $('statement-container');
    const s = statements[statementIndex];
    if (!s) {
      root.innerHTML = '<div class="section-loading">No weekly statements have been published yet.</div>';
      return;
    }

    const metrics = [
      ['gameRevenueRobux', 'Game revenue', pickNumber(s, ['gameRevenueRobux', 'game_revenue_robux'])],
      ['coinRevenueSol', 'Coin revenue', pickNumber(s, ['coinRevenueSol', 'coin_revenue_sol'])],
      ['operatingCosts', 'Operating costs', pickNumber(s, ['operatingCostsUsd', 'operatingCosts', 'operating_costs'])],
      ['studioReserves', 'Studio reserves', pickNumber(s, ['studioReservesUsd', 'studioReserves', 'studio_reserves'])],
      ['buybacksSol', 'Buybacks', pickNumber(s, ['buybacksSol', 'buybacks_sol'])],
      ['distributionsSol', 'Holder distributions', pickNumber(s, ['distributionsSol', 'holderDistributionsSol', 'distributions_sol'])],
    ];

    root.innerHTML = `
      <div class="statement-head">
        <button type="button" id="statement-older" ${statementIndex >= statements.length - 1 ? 'disabled' : ''}>←</button>
        <div class="statement-period"><strong>${escapeHtml(s.period || s.label || 'Weekly statement')}</strong><span>Published ${escapeHtml(s.published || formatDate(s.publishedAt))}</span></div>
        <button type="button" id="statement-newer" ${statementIndex <= 0 ? 'disabled' : ''}>→</button>
      </div>
      <div class="statement-grid">
        ${metrics.map(([key, label, value], index) => `<div class="statement-metric ${index === 5 ? 'highlight' : ''}"><span>${label}</span><strong>${escapeHtml(formatStatementValue(key.toLowerCase(), value, s))}</strong></div>`).join('')}
      </div>`;
    $('statement-older').onclick = () => { statementIndex += 1; renderStatement(); };
    $('statement-newer').onclick = () => { statementIndex = Math.max(0, statementIndex - 1); renderStatement(); };
  }

  function setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('visible');
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  function setupEvents() {
    document.querySelectorAll('.wallet-action').forEach((button) => {
      button.onclick = () => holder ? openDashboard() : connectWallet();
    });
    $('dashboard-back').onclick = closeDashboard;
    $('dashboard-home').onclick = closeDashboard;
    $('holder-logout').onclick = logout;
    $('dashboard-refresh').onclick = loadDashboard;
    $('modal-dismiss').onclick = closeUpdate;
    $('modal-x').onclick = closeUpdate;

    document.querySelectorAll('[data-payout-preference]').forEach((button) => {
      button.onclick = () => setPreference(button.dataset.payoutPreference);
    });

    document.querySelectorAll('[data-currency]').forEach((button) => {
      button.onclick = () => {
        statementCurrency = button.dataset.currency;
        document.querySelectorAll('[data-currency]').forEach((b) => b.classList.toggle('active', b === button));
        renderStatement();
      };
    });

    window.addEventListener('hashchange', () => {
      if (location.hash === '#dashboard' && holder) openDashboard();
      if (location.hash !== '#dashboard' && !$('holder-dashboard').hidden) closeDashboard();
    });

    const provider = phantom();
    if (provider?.on) {
      provider.on('accountChanged', (publicKey) => {
        const newWallet = publicKey?.toString() || null;
        if (holder?.walletAddress && newWallet !== holder.walletAddress) {
          showNotice('Phantom changed accounts. Your CLOUT login has not been switched. Connect again to authenticate the new wallet.');
        }
      });
    }
  }

  function configureLinks() {
    const game = $('clout-game-link');
    if (GAME_URL) game.href = GAME_URL;
    else {
      game.removeAttribute('target');
      game.href = '#';
      game.onclick = (event) => event.preventDefault();
      game.classList.add('disabled-link');
      game.textContent = 'Game link not configured';
    }
  }

  updateAuthUi();
  configureLinks();
  setupEvents();
  setupScrollReveal();
  loadPublicContent();
  restoreSession();
  if (location.hash === '#dashboard' && holder) openDashboard();
})();
