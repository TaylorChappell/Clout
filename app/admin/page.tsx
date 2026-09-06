"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type AdminTab = "overview" | "updates" | "revenue";
type Update = { id: string; date: string; title: string; summary: string; detail: string; category: string; imageUrl?: string | null; publishedAt: string };
type Statement = { id: string; period: string; published: string; gameRevenueRobux: number; coinRevenueEth: number; advertisingRobux: number; maintenanceRobux: number; distributionsEth: number; buybacksEth: number };
type AdminState = { updates: Update[]; statements: Statement[] };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); };
const emptyUpdate = () => ({ date: today(), title: "", summary: "", detail: "", category: "studio", imageDataUrl: "" });
const emptyRevenue = () => ({ periodStart: daysAgo(7), periodEnd: today(), publishedDate: today(), gameRevenueRobux: "", coinRevenueEth: "", advertisingRobux: "", maintenanceRobux: "", distributionsEth: "", buybacksEth: "" });
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const publicPath = (path: string) => `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
const API_URL = (import.meta.env.VITE_BACKEND_API_URL || "https://cloutstudiosserver-production.up.railway.app").replace(/\/$/, "");
let adminToken = "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (adminToken) headers.set("Authorization", `Bearer ${adminToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, mode: "cors", credentials: "omit" });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The request failed.");
  return payload;
}

const assetUrl = (value?: string | null) => {
  if (!value) return value;
  const id = value.split("/").at(-1);
  return id && value.includes("update-images") ? `${API_URL}/v1/public/update-images/${id}` : value;
};

function Mark() { return <span className={styles.brandMark}><img src={publicPath("/clout-icon.png")} alt="" /></span>; }

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<AdminState>({ updates: [], statements: [] });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [updateForm, setUpdateForm] = useState(emptyUpdate);
  const [imageName, setImageName] = useState("");
  const [revenueForm, setRevenueForm] = useState(emptyRevenue);

  const notify = (text: string, tone: "good" | "bad" = "good") => { setNotice({ text, tone }); window.setTimeout(() => setNotice(null), 4200); };
  const loadState = useCallback(async () => {
    if (!adminToken) { setAuthenticated(false); return; }
    try {
      const next = await api<AdminState>("/v1/admin/state", { cache: "no-store" });
      setData({ ...next, updates: next.updates.map((update) => ({ ...update, imageUrl: assetUrl(update.imageUrl) })) });
      setAuthenticated(true);
    } catch (error) { setAuthenticated(false); notify(error instanceof Error ? error.message : "Admin could not load.", "bad"); }
  }, []);

  useEffect(() => { const timeout = window.setTimeout(() => void loadState(), 0); return () => window.clearTimeout(timeout); }, [loadState]);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy("login");
    try { const result = await api<{ sessionToken: string }>("/v1/admin/login", { method: "POST", body: JSON.stringify({ password }) }); adminToken = result.sessionToken; setPassword(""); await loadState(); }
    catch (error) { notify(error instanceof Error ? error.message : "Login failed.", "bad"); }
    finally { setBusy(""); }
  };
  const logout = async () => { await api("/v1/admin/logout", { method: "POST", body: "{}" }).catch(() => null); adminToken = ""; setAuthenticated(false); };

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(file.type) || file.size > 2 * 1024 * 1024) { notify("Use a PNG, JPEG, WebP or GIF up to 2 MB.", "bad"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { setUpdateForm((current) => ({ ...current, imageDataUrl: reader.result as string })); setImageName(file.name); } };
    reader.readAsDataURL(file);
  };

  const publishUpdate = async (event: FormEvent) => {
    event.preventDefault(); setBusy("update");
    try { await api("/v1/admin/updates", { method: "POST", body: JSON.stringify(updateForm) }); setUpdateForm(emptyUpdate()); setImageName(""); notify("Update published."); await loadState(); }
    catch (error) { notify(error instanceof Error ? error.message : "Update failed.", "bad"); }
    finally { setBusy(""); }
  };

  const publishRevenue = async (event: FormEvent) => {
    event.preventDefault(); setBusy("revenue");
    try { await api("/v1/admin/revenue", { method: "POST", body: JSON.stringify(revenueForm) }); setRevenueForm(emptyRevenue()); notify("Revenue statement published."); await loadState(); }
    catch (error) { notify(error instanceof Error ? error.message : "Statement failed.", "bad"); }
    finally { setBusy(""); }
  };

  if (authenticated === null) return <main className={styles.loginPage}><div className={styles.loadingLine} /></main>;
  if (!authenticated) return <main className={styles.loginPage}><div className={styles.loginGlow} /><a className={styles.backLink} href={publicPath("/")}>Back to website</a><form className={styles.loginPanel} onSubmit={login}><div className={styles.loginBrand}><Mark /><span>CLOUT<small>STUDIO CONTROL</small></span></div><span className={styles.eyebrow}>Restricted access</span><h1>Studio administration.</h1><p>Publish updates and Ethereum-based weekly reporting.</p><label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required /><button type="submit" disabled={busy === "login"}>{busy === "login" ? "Checking..." : "Open admin"}<span>↗</span></button></form>{notice && <div className={`${styles.notice} ${styles[notice.tone]}`}>{notice.text}</div>}</main>;

  return <main className={styles.adminPage}>
    <aside className={styles.sidebar}><a className={styles.sideBrand} href={publicPath("/")}><Mark /><span>CLOUT<small>STUDIOS</small></span></a><nav>{(["overview", "updates", "revenue"] as AdminTab[]).map((item, index) => <button className={tab === item ? styles.active : ""} type="button" onClick={() => setTab(item)} key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav><div className={styles.sideFoot}><span><i /> Admin session active</span><button type="button" onClick={logout}>Sign out</button></div></aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}><div><span>Studio control</span><strong>{tab[0].toUpperCase() + tab.slice(1)}</strong></div><a href={publicPath("/")} target="_blank">Open website <span>↗</span></a></header>
      {tab === "overview" && <div className={styles.view}><div className={styles.viewHeading}><span>Operations</span><h1>Everything behind the studio.</h1><p>Publish updates and weekly figures for the Ethereum-based CLOUT ecosystem.</p></div><div className={styles.summaryGrid}><article><span>Published records</span><strong>{data.updates.length + data.statements.length}</strong><small>Updates and revenue statements</small></article><article><span>Network</span><strong>Ethereum</strong><small>CLOUT ERC-20 ecosystem</small></article><article><span>Reward routes</span><strong>2</strong><small>CLOUT and verified Robux</small></article></div><div className={styles.operationGrid}><button type="button" onClick={() => setTab("updates")}><span>Publish</span><strong>New studio update</strong><small>Write the brief and full release notes.</small><i>↗</i></button><button type="button" onClick={() => setTab("revenue")}><span>Report</span><strong>Weekly revenue</strong><small>Add game, CLOUT and operating figures.</small><i>↗</i></button></div></div>}
      {tab === "updates" && <div className={styles.view}><div className={styles.viewHeading}><span>Publishing</span><h1>Studio updates.</h1><p>Each update appears publicly as soon as it is published.</p></div><div className={styles.splitLayout}><form className={styles.formPanel} onSubmit={publishUpdate}><div className={styles.sectionTitle}><h2>Publish an update</h2><span>Public immediately</span></div><div className={styles.twoFields}><label>Date<input type="date" value={updateForm.date} onChange={(event) => setUpdateForm({ ...updateForm, date: event.target.value })} required /></label><label>Category<select value={updateForm.category} onChange={(event) => setUpdateForm({ ...updateForm, category: event.target.value })}><option value="studio">Studio</option><option value="clout">CLOUT</option><option value="paper">Paper Trade</option><option value="reporting">Reporting</option></select></label></div><label>Title<input value={updateForm.title} onChange={(event) => setUpdateForm({ ...updateForm, title: event.target.value })} maxLength={120} required /></label><label>Brief description<textarea className={styles.shortArea} value={updateForm.summary} onChange={(event) => setUpdateForm({ ...updateForm, summary: event.target.value })} maxLength={220} required /></label><label>Full update<textarea value={updateForm.detail} onChange={(event) => setUpdateForm({ ...updateForm, detail: event.target.value })} maxLength={4000} required /></label><label>Update image <span className={styles.fieldHint}>Optional, up to 2 MB.</span><input className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectImage} /></label>{updateForm.imageDataUrl && <div className={styles.imageSelection}><img src={updateForm.imageDataUrl} alt="Selected update preview" /><div><strong>{imageName}</strong><span>Ready to publish</span></div><button type="button" onClick={() => { setUpdateForm((current) => ({ ...current, imageDataUrl: "" })); setImageName(""); }}>Remove</button></div>}<button className={styles.primaryAction} type="submit" disabled={busy === "update"}>{busy === "update" ? "Publishing..." : "Publish update"}<span>↗</span></button></form><section className={styles.recordPanel}><div className={styles.sectionTitle}><h2>Published updates</h2><span>{data.updates.length} total</span></div>{data.updates.length ? data.updates.map((update) => <article className={styles.publishedCard} key={update.id}>{update.imageUrl && <img className={styles.publishedImage} src={update.imageUrl} alt="" />}<div><span>{update.category}</span><time>{update.date}</time></div><h3>{update.title}</h3><p>{update.summary}</p></article>) : <p className={styles.empty}>New updates will appear here.</p>}</section></div></div>}
      {tab === "revenue" && <div className={styles.view}><div className={styles.viewHeading}><span>Reporting</span><h1>Weekly revenue.</h1><p>Enter the source figures once. The public site handles USD, ETH and Robux display modes.</p></div><div className={styles.splitLayout}><form className={styles.formPanel} onSubmit={publishRevenue}><div className={styles.sectionTitle}><h2>Publish a statement</h2><span>Public immediately</span></div><div className={styles.threeFields}><label>Period start<input type="date" value={revenueForm.periodStart} onChange={(event) => setRevenueForm({ ...revenueForm, periodStart: event.target.value })} required /></label><label>Period end<input type="date" value={revenueForm.periodEnd} onChange={(event) => setRevenueForm({ ...revenueForm, periodEnd: event.target.value })} required /></label><label>Publish date<input type="date" value={revenueForm.publishedDate} onChange={(event) => setRevenueForm({ ...revenueForm, publishedDate: event.target.value })} required /></label></div><div className={styles.twoFields}><label>Game revenue, Robux<input type="number" min="0" step="1" value={revenueForm.gameRevenueRobux} onChange={(event) => setRevenueForm({ ...revenueForm, gameRevenueRobux: event.target.value })} required /></label><label>CLOUT revenue, ETH<input type="number" min="0" step="0.000001" value={revenueForm.coinRevenueEth} onChange={(event) => setRevenueForm({ ...revenueForm, coinRevenueEth: event.target.value })} required /></label><label>Advertising, Robux<input type="number" min="0" step="1" value={revenueForm.advertisingRobux} onChange={(event) => setRevenueForm({ ...revenueForm, advertisingRobux: event.target.value })} required /></label><label>Development and maintenance, Robux<input type="number" min="0" step="1" value={revenueForm.maintenanceRobux} onChange={(event) => setRevenueForm({ ...revenueForm, maintenanceRobux: event.target.value })} required /></label></div><div className={styles.twoFields}><label>Holder distributions, ETH<input type="number" min="0" step="0.000001" value={revenueForm.distributionsEth} onChange={(event) => setRevenueForm({ ...revenueForm, distributionsEth: event.target.value })} required /></label><label>Token buybacks, ETH<input type="number" min="0" step="0.000001" value={revenueForm.buybacksEth} onChange={(event) => setRevenueForm({ ...revenueForm, buybacksEth: event.target.value })} required /></label></div><button className={styles.primaryAction} type="submit" disabled={busy === "revenue"}>{busy === "revenue" ? "Publishing..." : "Publish statement"}<span>↗</span></button></form><section className={styles.recordPanel}><div className={styles.sectionTitle}><h2>Revenue history</h2><span>{data.statements.length} statements</span></div>{data.statements.length ? data.statements.map((statement) => <article className={styles.statementCard} key={statement.id}><div><strong>{statement.period}</strong><small>{statement.published}</small></div><span>{statement.gameRevenueRobux.toLocaleString()} R$</span><span>{statement.coinRevenueEth.toLocaleString()} ETH</span><span>{statement.buybacksEth.toLocaleString()} ETH buybacks</span></article>) : <p className={styles.empty}>New statements will appear here.</p>}</section></div></div>}
    </section>
    {notice && <div className={`${styles.notice} ${styles[notice.tone]}`}>{notice.text}</div>}
  </main>;
}
