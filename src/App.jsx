import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  getBackendVersion,
  getHolderDashboard,
  getPublicContent,
  updateHolderPreferences,
} from "./api";
import {
  clearSavedHolderSession,
  connectAndAuthenticateHolder,
  readSavedHolderSession,
  restoreHolderLogin,
  signOutHolder,
  watchPhantomAccountChanges,
} from "./holderAuth";
import { API_URL, CLOUT_GAME_URL, CLOUT_GROUP_URL, CLOUT_TOKEN_CA } from "./config";

const money = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

function shortWallet(value) {
  if (!value) return "";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatDate(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      className="copy-button"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1300);
      }}
    >
      {copied ? <Check size={15} /> : <Clipboard size={15} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CoinMark({ small = false }) {
  return <span className={small ? "coin-mark coin-mark-small" : "coin-mark"}>C</span>;
}

function Notice({ children, kind = "error", onClose }) {
  return (
    <div className={`notice notice-${kind}`} role="status">
      <span>{children}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close message">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

function Header({ holder, busy, onConnect, onDashboard }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="CLOUT Studios home">
        <CoinMark small />
        <span>CLOUT</span>
      </a>
      <nav className="desktop-nav" aria-label="Main navigation">
        <a href="#games">Our Games</a>
        <a href="#updates">Updates</a>
        <a href="#statements">Statements</a>
        <a href="#holders">Holders</a>
      </nav>
      <div className="header-actions">
        {holder ? (
          <>
            <button className="button button-muted wallet-pill" type="button" onClick={onDashboard}>
              <Wallet size={16} />
              {shortWallet(holder.walletAddress)}
            </button>
            <button className="button button-primary" type="button" onClick={onDashboard}>
              Open Dashboard
            </button>
          </>
        ) : (
          <button className="button button-primary" type="button" onClick={onConnect} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <CoinMark small />}
            {busy ? "Connecting" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({ holder, busy, onConnect, onDashboard }) {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-copy">
        <div className="eyebrow"><span /> CLOUT STUDIOS</div>
        <h1>Market-driven games.<br /><em>One transparent studio.</em></h1>
        <p>
          CLOUT builds Roblox experiences around markets, competition and player-driven systems,
          with published reporting for the community that backs the studio.
        </p>
        <div className="hero-actions">
          <a className="button button-primary button-large" href="#games">
            Explore our games <ArrowRight size={18} />
          </a>
          {holder ? (
            <button className="button button-ghost button-large" type="button" onClick={onDashboard}>
              Open holder dashboard
            </button>
          ) : (
            <button className="button button-ghost button-large" type="button" onClick={onConnect} disabled={busy}>
              Connect holder wallet
            </button>
          )}
        </div>
      </div>
      <div className="hero-orbit" aria-hidden="true">
        <div className="orbit-line orbit-one" />
        <div className="orbit-line orbit-two" />
        <div className="hero-coin"><CoinMark /></div>
        <span className="orbit-label orbit-label-one">ROBLOX</span>
        <span className="orbit-label orbit-label-two">SOLANA</span>
        <span className="orbit-label orbit-label-three">CLOUT</span>
      </div>
    </section>
  );
}

function Games() {
  return (
    <section className="section" id="games">
      <div className="section-heading">
        <div>
          <span className="kicker">OUR GAMES</span>
          <h2>Built around markets, not menus.</h2>
        </div>
        <p>Each title has its own economy and progression. CLOUT Studios reporting sits above them at the studio level.</p>
      </div>
      <div className="games-grid">
        <article className="game-card game-card-featured">
          <div className="game-art clout-art">
            <div className="art-grid" />
            <CoinMark />
            <div className="ticker-strip">CLOUT / ROBUX / MARKET / TRADE / COMPETE</div>
          </div>
          <div className="game-body">
            <div className="game-meta"><span>LIVE</span><span>ROBLOX</span></div>
            <h3>CLOUT</h3>
            <p>Trade, compete and build your portfolio inside a Roblox market simulator.</p>
            {CLOUT_GAME_URL ? (
              <a className="text-link" href={CLOUT_GAME_URL} target="_blank" rel="noreferrer">
                Play on Roblox <ExternalLink size={15} />
              </a>
            ) : (
              <span className="text-link text-link-disabled">Game link configurable in .env</span>
            )}
          </div>
        </article>
        <article className="game-card">
          <div className="game-art paper-art">
            <div className="paper-bars"><i /><i /><i /><i /><i /></div>
            <span className="paper-word">PAPER</span>
          </div>
          <div className="game-body">
            <div className="game-meta"><span className="muted-tag">COMING SOON</span><span>ROBLOX</span></div>
            <h3>Paper Trade</h3>
            <p>Paper trading for prediction markets and stocks, built as a competitive Roblox experience.</p>
            <span className="text-link text-link-disabled">In development</span>
          </div>
        </article>
      </div>
    </section>
  );
}

function Updates({ updates, loading }) {
  const [selected, setSelected] = useState(null);
  const visible = updates.slice(0, 6);
  return (
    <section className="section" id="updates">
      <div className="section-heading compact-heading">
        <div>
          <span className="kicker">UPDATES</span>
          <h2>What changed.</h2>
        </div>
      </div>
      {loading ? (
        <div className="loading-row"><LoaderCircle className="spin" size={18} /> Loading published updates</div>
      ) : visible.length ? (
        <div className="updates-grid">
          {visible.map((item, index) => (
            <button
              type="button"
              className={`update-card ${index === 0 ? "update-card-featured" : ""}`}
              key={item.id || `${item.title}-${index}`}
              onClick={() => setSelected(item)}
            >
              <div className="update-topline">
                <span>{item.category || "studio"}</span>
                <time>{item.date || formatDate(item.publishedAt)}</time>
              </div>
              {item.imageUrl ? (
                <img src={item.imageUrl.startsWith("http") ? item.imageUrl : `${API_URL}${item.imageUrl.replace("/api/backend", "/v1")}`} alt="" />
              ) : null}
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <span className="read-more">Read update <ArrowRight size={14} /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">No updates have been published yet.</div>
      )}
      {selected ? (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <article className="update-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="kicker">{selected.category || "UPDATE"}</span>
            <h2>{selected.title}</h2>
            <p className="modal-date">{selected.date || formatDate(selected.publishedAt)}</p>
            <div className="modal-copy">{selected.detail || selected.summary}</div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function Statements({ statements, loading }) {
  const ordered = useMemo(() => [...statements].reverse(), [statements]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [statements.length]);
  const statement = ordered[index];

  return (
    <section className="section statement-section" id="statements">
      <div className="section-heading">
        <div>
          <span className="kicker">WEEKLY STATEMENTS</span>
          <h2>Studio reporting, published.</h2>
        </div>
        <p>Revenue, operating costs, buybacks and holder distributions are recorded period by period.</p>
      </div>
      {loading ? (
        <div className="loading-row"><LoaderCircle className="spin" size={18} /> Loading statements</div>
      ) : statement ? (
        <div className="statement-shell">
          <div className="statement-nav">
            <button type="button" disabled={index >= ordered.length - 1} onClick={() => setIndex((value) => Math.min(value + 1, ordered.length - 1))}><ChevronLeft size={18} /></button>
            <div>
              <strong>{statement.period}</strong>
              <span>{statement.published}</span>
            </div>
            <button type="button" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(value - 1, 0))}><ChevronRight size={18} /></button>
          </div>
          <div className="statement-metrics">
            <div><span>Game revenue</span><strong>{integer.format(statement.gameRevenueRobux || 0)} R$</strong></div>
            <div><span>Coin revenue</span><strong>{money.format(statement.coinRevenueSol || 0)} SOL</strong></div>
            <div><span>Advertising</span><strong>{integer.format(statement.advertisingRobux || 0)} R$</strong></div>
            <div><span>Maintenance</span><strong>{integer.format(statement.maintenanceRobux || 0)} R$</strong></div>
            <div><span>Buybacks</span><strong>{money.format(statement.buybacksSol || 0)} SOL</strong></div>
            <div className="metric-accent"><span>Holder distributions</span><strong>{money.format(statement.distributionsSol || 0)} SOL</strong></div>
          </div>
        </div>
      ) : (
        <div className="empty-state">No weekly statements have been published yet.</div>
      )}
    </section>
  );
}

function HolderSection({ holder, busy, onConnect, onDashboard }) {
  return (
    <section className="section holder-section" id="holders">
      <div className="holder-number">1%</div>
      <div className="holder-copy">
        <span className="kicker">HOLDER ACCESS</span>
        <h2>Hold enough to qualify. Track everything in one place.</h2>
        <p>
          Wallets holding at least 1% of the published CLOUT supply at the relevant snapshot can qualify for that distribution period.
          Eligibility and payout records are calculated from the official token and the studio's published distribution data.
        </p>
        <div className="holder-points">
          <span><ShieldCheck size={17} /> Wallet ownership verified by signed message</span>
          <span><CircleDollarSign size={17} /> Choose SOL or Robux payout preference</span>
          <span><Gamepad2 size={17} /> Roblox account profile stored against your holder wallet</span>
        </div>
        {holder ? (
          <button className="button button-primary button-large" type="button" onClick={onDashboard}>Open Dashboard <ArrowRight size={18} /></button>
        ) : (
          <button className="button button-primary button-large" type="button" onClick={onConnect} disabled={busy}>Connect Holder Wallet <ArrowRight size={18} /></button>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand"><CoinMark small /><strong>CLOUT Studios</strong></div>
      <div className="footer-links">
        {CLOUT_GROUP_URL ? <a href={CLOUT_GROUP_URL} target="_blank" rel="noreferrer">Roblox Group</a> : null}
        <a href="#statements">Statements</a>
        <a href="#holders">Holder access</a>
      </div>
      {CLOUT_TOKEN_CA ? (
        <div className="footer-ca"><span>CA {shortWallet(CLOUT_TOKEN_CA)}</span><CopyButton value={CLOUT_TOKEN_CA} /></div>
      ) : null}
      <span className="copyright">© {new Date().getFullYear()} CLOUT Studios</span>
    </footer>
  );
}

function Dashboard({ holder, data, loading, error, onRefresh, onLogout, onPreference, preferenceBusy }) {
  const holdings = data?.holdings;
  const payouts = data?.payouts;
  const profile = data?.profile || holder?.profile || {};

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="brand" href="#top"><CoinMark small /><span>CLOUT</span></a>
        <div className="dashboard-header-actions">
          <button className="button button-muted" type="button" onClick={() => { window.location.hash = "top"; }}><ChevronLeft size={17} /> Back to site</button>
          <button className="button button-muted" type="button" onClick={onLogout}><LogOut size={17} /> Log out</button>
        </div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-title-row">
          <div>
            <span className="kicker">HOLDER DASHBOARD</span>
            <h1>My CLOUT</h1>
            <div className="wallet-address-row"><Wallet size={17} /><span>{holder.walletAddress}</span><CopyButton value={holder.walletAddress} label="Copy wallet" /></div>
          </div>
          <button className="button button-muted" type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh</button>
        </div>

        {error ? <Notice>{error}</Notice> : null}
        {loading && !data ? <div className="dashboard-loader"><LoaderCircle className="spin" size={24} /> Loading your holder data</div> : null}

        <div className="dashboard-metrics">
          <article className="dashboard-metric dashboard-metric-main">
            <span>CLOUT held</span>
            <strong>{holdings ? money.format(holdings.balance || 0) : "..."}</strong>
            <small>{holdings?.error || "Live token balance"}</small>
          </article>
          <article className="dashboard-metric">
            <span>Ownership</span>
            <strong>{holdings ? `${money.format(holdings.ownershipPercent || 0)}%` : "..."}</strong>
            <small>Published supply</small>
          </article>
          <article className="dashboard-metric">
            <span>Eligibility</span>
            <strong className={holdings?.eligible ? "positive" : ""}>{holdings ? (holdings.eligible ? "Qualified" : "Not qualified") : "..."}</strong>
            <small>1% snapshot threshold</small>
          </article>
          <article className="dashboard-metric">
            <span>Total SOL paid</span>
            <strong>{payouts ? `${money.format(payouts.totalSol || 0)} SOL` : "..."}</strong>
            <small>{payouts ? `${payouts.payoutCount || 0} confirmed payouts` : "Confirmed distributions"}</small>
          </article>
          <article className="dashboard-metric">
            <span>Total Robux paid</span>
            <strong>{payouts ? `${integer.format(payouts.totalRobux || 0)} R$` : "..."}</strong>
            <small>Recorded distributions</small>
          </article>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><span className="kicker">PAYOUT METHOD</span><h2>Where should distributions go?</h2></div>
            </div>
            <p className="panel-copy">Your choice is saved against this wallet on the CLOUT backend.</p>
            <div className="preference-grid">
              {[
                { value: "sol", title: "SOL", copy: "Receive eligible holder distributions in SOL." },
                { value: "robux", title: "Robux", copy: "Receive eligible distributions through the CLOUT Roblox payout flow." },
              ].map((item) => {
                const active = (profile?.payoutPreference || "sol") === item.value;
                return (
                  <button key={item.value} type="button" className={`preference-card ${active ? "active" : ""}`} disabled={preferenceBusy} onClick={() => onPreference(item.value)}>
                    <div><strong>{item.title}</strong>{active ? <Check size={18} /> : null}</div>
                    <span>{item.copy}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><span className="kicker">ROBLOX ACCOUNT</span><h2>Holder identity</h2></div>
            </div>
            {profile?.robloxUsername ? (
              <div className="roblox-linked">
                <div><Gamepad2 size={21} /><div><strong>@{profile.robloxUsername}</strong><span>{profile.robloxGroupMember ? "CLOUT group member" : "Group membership not confirmed"}</span></div></div>
                {profile.robloxGroupMember ? <span className="status-chip"><Check size={14} /> Verified</span> : null}
              </div>
            ) : (
              <div className="roblox-empty">
                <Gamepad2 size={24} />
                <div><strong>No Roblox account linked yet</strong><span>The backend profile is ready for Roblox identity verification, but the current backend package does not yet expose the username verification endpoint.</span></div>
              </div>
            )}
          </article>
        </div>

        <article className="dashboard-panel payout-panel">
          <div className="panel-heading">
            <div><span className="kicker">PAYOUT HISTORY</span><h2>Confirmed distributions</h2></div>
          </div>
          {payouts?.history?.length ? (
            <div className="payout-table">
              <div className="payout-row payout-head"><span>Date</span><span>Asset</span><span>Amount</span><span>Transaction</span></div>
              {payouts.history.map((item) => (
                <div className="payout-row" key={`${item.payoutId}-${item.signature || item.completedAt}`}>
                  <span>{formatDate(item.completedAt)}</span>
                  <span>{String(item.asset || "sol").toUpperCase()}</span>
                  <strong>{money.format(item.amountSol || 0)} SOL</strong>
                  <span>{item.signature ? shortWallet(item.signature) : "Confirmed"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">No confirmed payouts recorded for this wallet yet.</div>
          )}
        </article>
      </section>
    </main>
  );
}

export default function App() {
  const [holder, setHolder] = useState(() => readSavedHolderSession());
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [content, setContent] = useState({ updates: [], statements: [] });
  const [contentLoading, setContentLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [backendVersion, setBackendVersion] = useState(null);
  const [view, setView] = useState(() => (window.location.hash === "#dashboard" ? "dashboard" : "site"));

  const loadDashboard = useCallback(async (activeHolder = holder) => {
    if (!activeHolder?.sessionToken) return;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const result = await getHolderDashboard(activeHolder.sessionToken);
      setDashboard(result);
      setHolder((current) => current ? { ...current, profile: result.profile } : current);
    } catch (error) {
      if (error?.status === 401) {
        clearSavedHolderSession();
        setHolder(null);
        setDashboard(null);
        setView("site");
        window.location.hash = "top";
        setAuthError("Your holder session expired. Connect your wallet again.");
      } else {
        setDashboardError(error instanceof Error ? error.message : "Could not load holder dashboard.");
      }
    } finally {
      setDashboardLoading(false);
    }
  }, [holder]);

  useEffect(() => {
    const handleHash = () => setView(window.location.hash === "#dashboard" ? "dashboard" : "site");
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    let live = true;
    getPublicContent()
      .then((result) => {
        if (!live) return;
        setContent({ updates: result?.updates || [], statements: result?.statements || [] });
      })
      .catch(() => {})
      .finally(() => { if (live) setContentLoading(false); });

    getBackendVersion().then((result) => { if (live) setBackendVersion(result); }).catch(() => {});

    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    const saved = readSavedHolderSession();
    if (!saved?.sessionToken) return () => { live = false; };

    restoreHolderLogin()
      .then((restored) => {
        if (!live) return;
        setHolder(restored);
        if (restored && window.location.hash === "#dashboard") loadDashboard(restored);
      })
      .catch((error) => {
        if (!live) return;
        setAuthError(error instanceof Error ? error.message : "Could not restore holder login.");
      });

    return () => { live = false; };
  }, []); // restore once on initial page load

  useEffect(() => {
    return watchPhantomAccountChanges((newAddress) => {
      if (!holder?.walletAddress) return;
      if (!newAddress || newAddress !== holder.walletAddress) {
        setAuthError("Phantom changed accounts. Your CLOUT login was not changed automatically. Connect the new wallet to authenticate it.");
      }
    });
  }, [holder?.walletAddress]);

  useEffect(() => {
    if (view === "dashboard" && holder?.sessionToken && !dashboard && !dashboardLoading) {
      loadDashboard(holder);
    }
  }, [view, holder, dashboard, dashboardLoading, loadDashboard]);

  const connect = async () => {
    setConnecting(true);
    setAuthError("");
    try {
      const authenticated = await connectAndAuthenticateHolder();
      setHolder(authenticated);
      setDashboard(null);
      window.location.hash = "dashboard";
      setView("dashboard");
      await loadDashboard(authenticated);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Wallet login failed.");
    } finally {
      setConnecting(false);
    }
  };

  const openDashboard = () => {
    window.location.hash = "dashboard";
    setView("dashboard");
  };

  const logout = async () => {
    const token = holder?.sessionToken;
    setDashboardLoading(true);
    try {
      await signOutHolder(token);
    } finally {
      setHolder(null);
      setDashboard(null);
      setDashboardLoading(false);
      window.location.hash = "top";
      setView("site");
    }
  };

  const setPreference = async (value) => {
    if (!holder?.sessionToken) return;
    setPreferenceBusy(true);
    setDashboardError("");
    try {
      const result = await updateHolderPreferences(holder.sessionToken, value);
      setDashboard((current) => current ? { ...current, profile: result.profile } : current);
      setHolder((current) => current ? { ...current, profile: result.profile } : current);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not save payout preference.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  if (view === "dashboard" && holder) {
    return (
      <Dashboard
        holder={holder}
        data={dashboard}
        loading={dashboardLoading}
        error={dashboardError}
        onRefresh={() => loadDashboard(holder)}
        onLogout={logout}
        onPreference={setPreference}
        preferenceBusy={preferenceBusy}
      />
    );
  }

  return (
    <div className="site-shell">
      <Header holder={holder} busy={connecting} onConnect={connect} onDashboard={openDashboard} />
      {authError ? <div className="global-notice"><Notice onClose={() => setAuthError("")}>{authError}</Notice></div> : null}
      {backendVersion && backendVersion.holderAuth !== true ? (
        <div className="global-notice"><Notice>The deployed CLOUT backend reports that holder authentication is not enabled.</Notice></div>
      ) : null}
      <Hero holder={holder} busy={connecting} onConnect={connect} onDashboard={openDashboard} />
      <Games />
      <Updates updates={content.updates} loading={contentLoading} />
      <Statements statements={content.statements} loading={contentLoading} />
      <HolderSection holder={holder} busy={connecting} onConnect={connect} onDashboard={openDashboard} />
      <Footer />
    </div>
  );
}
