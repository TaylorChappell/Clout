"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type AdminTab = "overview" | "updates" | "revenue" | "payouts" | "settings";
type AdminState = {
  updates: Array<{ id: string; date: string; title: string; summary: string; detail: string; category: string; imageUrl?: string | null; publishedAt: string }>;
  statements: Array<{ id: string; period: string; published: string; gameRevenueRobux: number; coinRevenueSol: number; advertisingRobux: number; maintenanceRobux: number; distributionsSol: number; buybacksSol: number }>;
  config: { tokenMint: string; excludedWallets: string };
  wallet: null | { publicKey: string; balanceLamports: string; balanceSol: number; balanceError: string | null; createdAt: string };
  payouts: Array<{ id: string; mint: string; snapshotSlot: number; eligibleHolderCount: number; distributableLamports: string; status: string; signaturesJson: string; error: string | null; createdAt: string; completedAt: string | null }>;
};

type PayoutPreview = {
  id: string;
  snapshotSlot: number;
  eligibleHolderCount: number;
  excludedOffCurve: number;
  excludedConfigured: number;
  walletBalanceSol: number;
  distributableSol: number;
  feeReserveSol: number;
  expiresAt: string;
  recipients: Array<{ owner: string; ownershipPercent: number; payoutWeightPercent: number; payoutSol: number }>;
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};
const emptyUpdateForm = () => ({ date: today(), title: "", summary: "", detail: "", category: "studio", imageDataUrl: "" });
const emptyRevenueForm = () => ({ periodStart: daysAgo(7), periodEnd: today(), publishedDate: today(), gameRevenueRobux: "", coinRevenueSol: "", advertisingRobux: "", maintenanceRobux: "", distributionsSol: "", buybacksSol: "" });
const shortAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-6)}`;
const sol = (value: number) => `${value.toLocaleString("en-GB", { maximumFractionDigits: 6 })} SOL`;
const PUBLIC_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const publicPath = (path: string) => `${PUBLIC_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
const BACKEND_API_URL = (import.meta.env.VITE_BACKEND_API_URL || "https://cloutstudiosserver-production.up.railway.app").replace(/\/$/, "");
let adminToken = "";

const backendAssetUrl = (value?: string | null) => {
  if (!value) return value;
  try {
    const url = new URL(value, BACKEND_API_URL);
    if (url.pathname.startsWith("/v1/public/update-images/")) return `${BACKEND_API_URL}${url.pathname}`;
    if (url.pathname.startsWith("/public/update-images/")) return `${BACKEND_API_URL}/v1${url.pathname}`;
  } catch {
    return value;
  }
  return value;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (adminToken) headers.set("Authorization", `Bearer ${adminToken}`);
  const response = await fetch(`${BACKEND_API_URL}${path}`, { ...init, headers, mode: "cors", credentials: "omit" });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status === 401) adminToken = "";
  if (!response.ok) throw new Error(payload.error || "The request failed.");
  return payload;
}

function Mark() {
  return <span className={styles.brandMark}><img src={publicPath("/clout-icon.png")} alt="" /></span>;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<AdminState | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [copied, setCopied] = useState(false);
  const [updateForm, setUpdateForm] = useState(emptyUpdateForm);
  const [updateImageName, setUpdateImageName] = useState("");
  const [revenueForm, setRevenueForm] = useState(emptyRevenueForm);
  const [settingsForm, setSettingsForm] = useState({ tokenMint: "", excludedWallets: "" });

  const notify = (text: string, tone: "good" | "bad" = "good") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const loadState = useCallback(async () => {
    if (!adminToken) {
      setAuthenticated(false);
      return;
    }
    try {
      const next = await requestJson<AdminState>("/v1/admin/state", { cache: "no-store" });
      setData({ ...next, updates: next.updates.map((update) => ({ ...update, imageUrl: backendAssetUrl(update.imageUrl) })) });
      setSettingsForm(next.config);
      setAuthenticated(true);
    } catch (error) {
      if (error instanceof Error && error.message === "Authentication required.") setAuthenticated(false);
      else { setAuthenticated(false); notify(error instanceof Error ? error.message : "Admin could not load.", "bad"); }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadState(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadState]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("login");
    try {
      const session = await requestJson<{ ok: true; sessionToken: string }>("/v1/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      adminToken = session.sessionToken;
      setPassword("");
      await loadState();
    } catch (error) { notify(error instanceof Error ? error.message : "Login failed.", "bad"); }
    finally { setBusy(""); }
  };

  const logout = async () => {
    await requestJson("/v1/admin/logout", { method: "POST", body: "{}" }).catch(() => null);
    adminToken = "";
    setAuthenticated(false);
    setData(null);
  };

  const publishUpdate = async (event: FormEvent) => {
    event.preventDefault(); setBusy("update");
    try {
      await requestJson("/v1/admin/updates", { method: "POST", body: JSON.stringify(updateForm) });
      setUpdateForm(emptyUpdateForm());
      setUpdateImageName("");
      notify("Update published."); await loadState();
    } catch (error) { notify(error instanceof Error ? error.message : "Update failed.", "bad"); }
    finally { setBusy(""); }
  };

  const selectUpdateImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(file.type)) {
      event.target.value = "";
      notify("Use a PNG, JPEG, WebP or GIF image.", "bad");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      event.target.value = "";
      notify("The update image must be 2 MB or smaller.", "bad");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setUpdateForm((current) => ({ ...current, imageDataUrl: reader.result as string }));
      setUpdateImageName(file.name);
    };
    reader.onerror = () => notify("The image could not be read.", "bad");
    reader.readAsDataURL(file);
  };

  const publishRevenue = async (event: FormEvent) => {
    event.preventDefault(); setBusy("revenue");
    try {
      await requestJson("/v1/admin/revenue", { method: "POST", body: JSON.stringify(revenueForm) });
      setRevenueForm(emptyRevenueForm());
      notify("Revenue statement published."); await loadState();
    } catch (error) { notify(error instanceof Error ? error.message : "Statement failed.", "bad"); }
    finally { setBusy(""); }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setBusy("settings");
    try {
      const saved = await requestJson<{ tokenMint: string; excludedWallets: string }>("/v1/admin/settings", { method: "POST", body: JSON.stringify(settingsForm) });
      setSettingsForm(saved); notify("Payout settings saved."); await loadState();
    } catch (error) { notify(error instanceof Error ? error.message : "Settings failed.", "bad"); }
    finally { setBusy(""); }
  };

  const generateWallet = async () => {
    setBusy("wallet");
    try { await requestJson("/v1/admin/wallet", { method: "POST", body: "{}" }); notify("Payout wallet generated."); await loadState(); }
    catch (error) { notify(error instanceof Error ? error.message : "Wallet generation failed.", "bad"); }
    finally { setBusy(""); }
  };

  const copyWallet = async () => {
    if (!data?.wallet) return;
    await navigator.clipboard.writeText(data.wallet.publicKey);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };

  const buildPreview = async () => {
    setBusy("preview"); setPreview(null); setConfirmation("");
    try {
      const result = await requestJson<{ preview: PayoutPreview }>("/v1/admin/payouts/preview", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      setPreview(result.preview); notify("Holder snapshot completed.");
    } catch (error) { notify(error instanceof Error ? error.message : "Snapshot failed.", "bad"); }
    finally { setBusy(""); }
  };

  const executePayout = async () => {
    if (!preview) return;
    setBusy("payout");
    try {
      const result = await requestJson<{ signatures: string[] }>("/v1/admin/payouts/execute", { method: "POST", body: JSON.stringify({ payoutId: preview.id, confirmation }) });
      notify(`Payout completed in ${result.signatures.length} transaction${result.signatures.length === 1 ? "" : "s"}.`);
      setPreview(null); setConfirmation(""); await loadState();
    } catch (error) { notify(error instanceof Error ? error.message : "Payout stopped.", "bad"); await loadState(); }
    finally { setBusy(""); }
  };

  const totalPublished = useMemo(() => (data?.updates.length || 0) + (data?.statements.length || 0), [data]);

  if (authenticated === null) return <main className={styles.loginPage}><div className={styles.loadingLine} /></main>;
  if (!authenticated) return (
    <main className={styles.loginPage}>
      <div className={styles.loginGlow} />
      <a className={styles.backLink} href={publicPath("/")}>Back to website</a>
      <form className={styles.loginPanel} onSubmit={login}>
        <div className={styles.loginBrand}><Mark /><span>CLOUT<small>STUDIO CONTROL</small></span></div>
        <span className={styles.eyebrow}>Restricted access</span>
        <h1>Studio administration.</h1>
        <p>Publishing, revenue reporting and holder distributions are protected behind the studio password.</p>
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
        <button type="submit" disabled={busy === "login"}>{busy === "login" ? "Checking..." : "Open admin"}<span>↗</span></button>
      </form>
      {notice && <div className={`${styles.notice} ${styles[notice.tone]}`}>{notice.text}</div>}
    </main>
  );

  return (
    <main className={styles.adminPage}>
      <aside className={styles.sidebar}>
        <a className={styles.sideBrand} href={publicPath("/")}><Mark /><span>CLOUT<small>STUDIOS</small></span></a>
        <nav>
          {(["overview", "updates", "revenue", "payouts", "settings"] as AdminTab[]).map((item, index) => <button className={tab === item ? styles.active : ""} type="button" onClick={() => setTab(item)} key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </nav>
        <div className={styles.sideFoot}><span><i /> Admin session active</span><button type="button" onClick={logout}>Sign out</button></div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}><div><span>Studio control</span><strong>{tab[0].toUpperCase() + tab.slice(1)}</strong></div><a href={publicPath("/")} target="_blank">Open website <span>↗</span></a></header>

        {tab === "overview" && <div className={styles.view}>
          <div className={styles.viewHeading}><span>Operations</span><h1>Everything behind the studio.</h1><p>Publish new information, monitor the payout wallet and keep every holder action recorded.</p></div>
          <div className={styles.summaryGrid}>
            <article><span>Published records</span><strong>{totalPublished}</strong><small>Updates and revenue statements</small></article>
            <article><span>Payout wallet</span><strong>{data?.wallet ? sol(data.wallet.balanceSol) : "Not created"}</strong><small>{data?.wallet ? shortAddress(data.wallet.publicKey) : "Generate it from Payouts"}</small></article>
            <article><span>Completed payouts</span><strong>{data?.payouts.filter((payout) => payout.status === "completed").length || 0}</strong><small>Recorded distribution runs</small></article>
          </div>
          <div className={styles.operationGrid}>
            <button type="button" onClick={() => setTab("updates")}><span>Publish</span><strong>New studio update</strong><small>Write the brief and full release notes.</small><i>↗</i></button>
            <button type="button" onClick={() => setTab("revenue")}><span>Report</span><strong>Weekly revenue</strong><small>Add game, coin and operating figures.</small><i>↗</i></button>
            <button type="button" onClick={() => setTab("payouts")}><span>Distribute</span><strong>Holder payout</strong><small>Snapshot eligible wallets and review amounts.</small><i>↗</i></button>
          </div>
          <section className={styles.activity}><div className={styles.sectionTitle}><h2>Recent payout activity</h2><span>{data?.payouts.length || 0} records</span></div>{data?.payouts.length ? data.payouts.slice(0, 5).map((payout) => <div className={styles.activityRow} key={payout.id}><span className={`${styles.statusDot} ${styles[payout.status]}`} /><div><strong>{payout.eligibleHolderCount} eligible holders</strong><small>Snapshot slot {payout.snapshotSlot.toLocaleString()}</small></div><span>{payout.status}</span><time>{new Date(payout.createdAt).toLocaleDateString("en-GB")}</time></div>) : <p className={styles.empty}>No payout runs have been created.</p>}</section>
        </div>}

        {tab === "updates" && <div className={styles.view}>
          <div className={styles.viewHeading}><span>Publishing</span><h1>Studio updates.</h1><p>Each update appears on the public website as soon as it is published.</p></div>
          <div className={styles.splitLayout}>
            <form className={styles.formPanel} onSubmit={publishUpdate}>
              <div className={styles.sectionTitle}><h2>Publish an update</h2><span>Public immediately</span></div>
              <div className={styles.twoFields}><label>Date<input type="date" value={updateForm.date} onChange={(event) => setUpdateForm({ ...updateForm, date: event.target.value })} required /></label><label>Category<select value={updateForm.category} onChange={(event) => setUpdateForm({ ...updateForm, category: event.target.value })}><option value="studio">Studio</option><option value="clout">CLOUT</option><option value="paper">Paper Trade</option><option value="reporting">Reporting</option></select></label></div>
              <label>Title<input value={updateForm.title} onChange={(event) => setUpdateForm({ ...updateForm, title: event.target.value })} maxLength={120} placeholder="What changed?" required /></label>
              <label>Brief description<textarea className={styles.shortArea} value={updateForm.summary} onChange={(event) => setUpdateForm({ ...updateForm, summary: event.target.value })} maxLength={220} placeholder="Shown on the update card" required /></label>
              <label>Full update<textarea value={updateForm.detail} onChange={(event) => setUpdateForm({ ...updateForm, detail: event.target.value })} maxLength={4000} placeholder="The complete update shown when opened" required /></label>
              <label>Update image <span className={styles.fieldHint}>Optional PNG, JPEG, WebP or GIF. Maximum 2 MB.</span><input className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectUpdateImage} /></label>
              {updateForm.imageDataUrl && <div className={styles.imageSelection}><img src={updateForm.imageDataUrl} alt="Selected update preview" /><div><strong>{updateImageName}</strong><span>Ready to publish</span></div><button type="button" onClick={() => { setUpdateForm((current) => ({ ...current, imageDataUrl: "" })); setUpdateImageName(""); }}>Remove</button></div>}
              <button className={styles.primaryAction} type="submit" disabled={busy === "update"}>{busy === "update" ? "Publishing..." : "Publish update"}<span>↗</span></button>
            </form>
            <section className={styles.recordPanel}><div className={styles.sectionTitle}><h2>Published updates</h2><span>{data?.updates.length || 0} total</span></div>{data?.updates.length ? data.updates.map((update) => <article className={styles.publishedCard} key={update.id}>{update.imageUrl && <img className={styles.publishedImage} src={update.imageUrl} alt="" />}<div><span>{update.category}</span><time>{update.date}</time></div><h3>{update.title}</h3><p>{update.summary}</p></article>) : <p className={styles.empty}>New updates will appear here.</p>}</section>
          </div>
        </div>}

        {tab === "revenue" && <div className={styles.view}>
          <div className={styles.viewHeading}><span>Reporting</span><h1>Weekly revenue.</h1><p>Enter the source figures once. The public website handles USD, SOL and Robux display modes.</p></div>
          <div className={styles.splitLayout}>
            <form className={styles.formPanel} onSubmit={publishRevenue}>
              <div className={styles.sectionTitle}><h2>Publish a statement</h2><span>Public immediately</span></div>
              <div className={styles.threeFields}><label>Period start<input type="date" value={revenueForm.periodStart} onChange={(event) => setRevenueForm({ ...revenueForm, periodStart: event.target.value })} required /></label><label>Period end<input type="date" value={revenueForm.periodEnd} onChange={(event) => setRevenueForm({ ...revenueForm, periodEnd: event.target.value })} required /></label><label>Publish date<input type="date" value={revenueForm.publishedDate} onChange={(event) => setRevenueForm({ ...revenueForm, publishedDate: event.target.value })} required /></label></div>
              <div className={styles.twoFields}><label>Game revenue, Robux<input type="number" min="0" step="1" value={revenueForm.gameRevenueRobux} onChange={(event) => setRevenueForm({ ...revenueForm, gameRevenueRobux: event.target.value })} placeholder="1240000" required /></label><label>Coin revenue, SOL<input type="number" min="0" step="0.000001" value={revenueForm.coinRevenueSol} onChange={(event) => setRevenueForm({ ...revenueForm, coinRevenueSol: event.target.value })} placeholder="42.6" required /></label><label>Advertising, Robux<input type="number" min="0" step="1" value={revenueForm.advertisingRobux} onChange={(event) => setRevenueForm({ ...revenueForm, advertisingRobux: event.target.value })} placeholder="320000" required /></label><label>Development and maintenance, Robux<input type="number" min="0" step="1" value={revenueForm.maintenanceRobux} onChange={(event) => setRevenueForm({ ...revenueForm, maintenanceRobux: event.target.value })} placeholder="280000" required /></label></div>
              <div className={styles.twoFields}><label>Holder distributions, SOL<input type="number" min="0" step="0.000001" value={revenueForm.distributionsSol} onChange={(event) => setRevenueForm({ ...revenueForm, distributionsSol: event.target.value })} placeholder="18.4" required /></label><label>Token buybacks, SOL<input type="number" min="0" step="0.000001" value={revenueForm.buybacksSol} onChange={(event) => setRevenueForm({ ...revenueForm, buybacksSol: event.target.value })} placeholder="6.25" required /></label></div>
              <button className={styles.primaryAction} type="submit" disabled={busy === "revenue"}>{busy === "revenue" ? "Publishing..." : "Publish statement"}<span>↗</span></button>
            </form>
            <section className={styles.recordPanel}><div className={styles.sectionTitle}><h2>Revenue history</h2><span>{data?.statements.length || 0} statements</span></div>{data?.statements.length ? data.statements.map((statement) => <article className={styles.statementCard} key={statement.id}><div><strong>{statement.period}</strong><small>{statement.published}</small></div><span>{statement.gameRevenueRobux.toLocaleString()} R$</span><span>{statement.coinRevenueSol.toLocaleString()} SOL</span><span>{statement.buybacksSol.toLocaleString()} SOL buybacks</span></article>) : <p className={styles.empty}>New statements will appear here.</p>}</section>
          </div>
        </div>}

        {tab === "payouts" && <div className={styles.view}>
          <div className={styles.viewHeading}><span>Distribution desk</span><h1>Holder payouts.</h1><p>Scan the live token supply, review every eligible wallet and distribute the available SOL proportionally.</p></div>
          <section className={styles.walletStrip}><div><span>Payout wallet</span>{data?.wallet ? <><strong>{data.wallet.publicKey}</strong><small>{data.wallet.balanceError || `${sol(data.wallet.balanceSol)} available`}</small></> : <><strong>No wallet generated</strong><small>The private key will be encrypted and kept server-side.</small></>}</div>{data?.wallet ? <button type="button" onClick={copyWallet}>{copied ? "Copied" : "Copy address"}</button> : <button type="button" onClick={generateWallet} disabled={busy === "wallet"}>{busy === "wallet" ? "Generating..." : "Generate wallet"}</button>}</section>
          <div className={styles.payoutFlow}>
            <section><span>01</span><div><h2>Configure</h2><p>{data?.config.tokenMint ? `Mint ${shortAddress(data.config.tokenMint)}` : "Add the CLOUT mint and exclusion list in Settings."}</p></div><button type="button" onClick={() => setTab("settings")}>Open settings</button></section>
            <section><span>02</span><div><h2>Snapshot and preview</h2><p>Find wallets holding at least 1%, remove configured and off-curve accounts, then calculate weighted payouts.</p></div><button type="button" onClick={buildPreview} disabled={!data?.wallet || !data?.config.tokenMint || busy === "preview"}>{busy === "preview" ? "Scanning..." : "Build payout preview"}</button></section>
          </div>
          {preview && <section className={styles.previewPanel}>
            <div className={styles.previewHead}><div><span>Snapshot slot {preview.snapshotSlot.toLocaleString()}</span><h2>{preview.eligibleHolderCount} eligible holders</h2><p>{sol(preview.distributableSol)} will be distributed. {sol(preview.feeReserveSol)} is reserved for transaction fees.</p></div><div><span>Expires</span><strong>{new Date(preview.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</strong></div></div>
            <div className={styles.previewStats}><div><span>Wallet balance</span><strong>{sol(preview.walletBalanceSol)}</strong></div><div><span>Configured exclusions</span><strong>{preview.excludedConfigured}</strong></div><div><span>Off-curve exclusions</span><strong>{preview.excludedOffCurve}</strong></div></div>
            <div className={styles.recipientTable}><div className={styles.tableHead}><span>Wallet</span><span>CLOUT ownership</span><span>Payout weight</span><span>SOL payout</span></div>{preview.recipients.map((recipient) => <div className={styles.tableRow} key={recipient.owner}><strong title={recipient.owner}>{shortAddress(recipient.owner)}</strong><span>{recipient.ownershipPercent.toFixed(4)}%</span><span>{recipient.payoutWeightPercent.toFixed(4)}%</span><span>{recipient.payoutSol.toFixed(6)}</span></div>)}</div>
            <div className={styles.executeBox}><div><span>Final confirmation</span><strong>This sends real SOL and cannot be reversed.</strong><p>Type PAYOUT to unlock execution. Confirm the holder list and exclusions first.</p></div><div><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type PAYOUT" autoComplete="off" /><button type="button" onClick={executePayout} disabled={confirmation !== "PAYOUT" || busy === "payout"}>{busy === "payout" ? "Sending..." : "Execute payout"}</button></div></div>
          </section>}
        </div>}

        {tab === "settings" && <div className={styles.view}>
          <div className={styles.viewHeading}><span>Configuration</span><h1>Payout settings.</h1><p>Set the CLOUT mint and exclude pool, treasury, exchange or other addresses that must never receive a holder distribution.</p></div>
          <form className={`${styles.formPanel} ${styles.settingsPanel}`} onSubmit={saveSettings}><div className={styles.sectionTitle}><h2>Token configuration</h2><span>Solana mainnet</span></div><label>CLOUT token mint<input value={settingsForm.tokenMint} onChange={(event) => setSettingsForm({ ...settingsForm, tokenMint: event.target.value })} placeholder="Solana mint address" required /></label><label>Excluded holder wallets<textarea value={settingsForm.excludedWallets} onChange={(event) => setSettingsForm({ ...settingsForm, excludedWallets: event.target.value })} placeholder="One wallet per line" /></label><div className={styles.securityNote}><strong>Review this list before every payout.</strong><p>Liquidity pools and program-owned accounts can hold more than 1% of supply. Off-curve program addresses are excluded automatically, but known treasury, exchange and pool owners should still be listed here.</p></div><button className={styles.primaryAction} type="submit" disabled={busy === "settings"}>{busy === "settings" ? "Saving..." : "Save payout settings"}<span>↗</span></button></form>
        </div>}
      </section>
      {notice && <div className={`${styles.notice} ${styles[notice.tone]}`}>{notice.text}</div>}
    </main>
  );
}
