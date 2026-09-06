"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type EthereumProvider = {
  isMetaMask?: boolean;
  isRobinhood?: boolean;
  providers?: EthereumProvider[];
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    CLOUT_CONFIG?: { walletConnectProjectId?: string };
    CLOUT_ROUTE?: string;
  }
}

type ExternalLinkKey = "robloxGame" | "robloxGroup" | "twitter" | "coin";

const links: Record<ExternalLinkKey, string> = {
  robloxGame: "https://www.roblox.com/games/99235859633016/CLOUT-Trading-Simulator",
  robloxGroup: "https://www.roblox.com/communities/386748770/CLOUT-Crypto-Trading-Simulator#!/about",
  twitter: "https://x.com/CLOUT_robinhood",
  coin: "",
};
const PUBLIC_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const publicPath = (path: string) => `${PUBLIC_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
const BACKEND_API_URL = (import.meta.env.VITE_BACKEND_API_URL || "https://cloutstudiosserver-production.up.railway.app").replace(/\/$/, "");
const ETH_USD_TICKER_URL = "https://api.kraken.com/0/public/Ticker?pair=ETHUSD";
const ROBUX_USD_RATE = 0.0038;
const ETH_CHAIN_ID = "0x1";
const WALLETCONNECT_PROJECT_ID = window.CLOUT_CONFIG?.walletConnectProjectId || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

type ReportingCurrency = "usd" | "eth" | "robux";

type WeeklyStatement = {
  period: string;
  published: string;
  gameRevenueRobux: number;
  coinRevenueEth: number;
  advertisingRobux: number;
  maintenanceRobux: number;
  distributionsEth: number;
  buybacksEth: number;
};

type StudioUpdate = {
  date: string;
  title: string;
  summary: string;
  detail: string;
  category: "reporting" | "clout" | "paper" | "studio";
  imageUrl?: string | null;
};

type HolderDashboard = {
  network: "ethereum";
  chainId: string;
  walletAddress: string;
  sessionExpiresAt?: string;
  profile: {
    payoutPreference: "clout" | "robux";
    robloxUserId: string | null;
    robloxUsername: string | null;
    robloxDisplayName?: string | null;
    robloxAvatarUrl?: string | null;
    robloxGroupMember: boolean | null;
    robloxVerifiedAt: string | null;
  };
  holdings: {
    tokenAddress: string | null;
    balance: number;
    amountRaw: string;
    decimals: number;
    ownershipPercent: number;
    eligible: boolean;
    error: string | null;
  };
  payouts: {
    totalClout: number;
    totalRobux: number;
    payoutCount: number;
    history: Array<{ payoutId: string; asset: "clout" | "robux"; amount: number; amountClout?: number; txHash: string | null; completedAt: string | null; createdAt: string }>;
  };
};

type HolderApiError = Error & { code?: string; joinUrl?: string; profile?: { username?: string; displayName?: string; avatarUrl?: string | null } };

const HOLDER_SESSION_KEY = "clout_holder_session";

type StoredHolderSession = { sessionToken: string; walletAddress: string; walletType: "metamask" | "robinhood" };

function readStoredSession(): StoredHolderSession | null {
  try {
    const raw = window.localStorage.getItem(HOLDER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredHolderSession>;
    if (!parsed.sessionToken || !parsed.walletAddress) return null;
    return { sessionToken: parsed.sessionToken, walletAddress: parsed.walletAddress, walletType: parsed.walletType === "robinhood" ? "robinhood" : "metamask" };
  } catch {
    return null;
  }
}

function injectedProviders() {
  const provider = window.ethereum;
  if (!provider) return [];
  return provider.providers?.length ? provider.providers : [provider];
}

async function holderRequest<T>(path: string, token = "", init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${BACKEND_API_URL}${path}`, { ...init, headers, mode: "cors", credentials: "omit", cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; code?: string; joinUrl?: string; profile?: HolderApiError["profile"] };
  if (!response.ok) {
    const error = new Error(payload.error || "The request failed.") as HolderApiError;
    error.code = payload.code;
    error.joinUrl = payload.joinUrl;
    error.profile = payload.profile;
    throw error;
  }
  return payload;
}

function textToHex(value: string) {
  return `0x${Array.from(new TextEncoder().encode(value)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function backendAssetUrl(value?: string | null) {
  if (!value) return value;
  try {
    const url = new URL(value, BACKEND_API_URL);
    if (url.pathname.startsWith("/v1/public/update-images/")) return `${BACKEND_API_URL}${url.pathname}`;
    if (url.pathname.startsWith("/public/update-images/")) return `${BACKEND_API_URL}/v1${url.pathname}`;
  } catch {
    return value;
  }
  return value;
}

const guideSteps = [
  { icon: "robinhood", title: "Choose your wallet", copy: "Connect Robinhood Wallet or MetaMask to your CLOUT holder profile." },
  { icon: "ethereum", title: "Fund with ETH", copy: "Keep enough ETH for the CLOUT purchase and Ethereum network fees." },
  { icon: "verify", title: "Verify CLOUT", copy: "Use only the coin link shown on this site and the official CLOUT social accounts." },
  { icon: "connect", title: "Acquire and connect", copy: "Acquire CLOUT through the official Robinhood listing, then connect the same wallet to open your dashboard." },
] as const;

function ArrowUpRight() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg>;
}

function ArrowRight() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12M11.5 5.5 16 10l-4.5 4.5" /></svg>;
}

function LockMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" /></svg>;
}

function InfoMark() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 6.2h.01" /></svg>;
}

function CloutMark() {
  return <span className="clout-mark" aria-hidden="true"><img src={publicPath("/clout-icon.png")} alt="" /></span>;
}

function AssetMark({ type }: { type: "clout" | "robux" }) {
  return <span className={`asset-icon ${type}-icon`} aria-hidden="true"><img src={publicPath(type === "clout" ? "/clout-icon.png" : "/robux-logo.png")} alt="" /></span>;
}

function UpdateVisual({ update, compact = false }: { update: StudioUpdate; compact?: boolean }) {
  if (update.imageUrl) return <div className={`update-visual update-image${compact ? " is-compact" : ""}`} aria-hidden="true"><img src={update.imageUrl} alt="" /></div>;
  return <div className={`update-visual update-${update.category}${compact ? " is-compact" : ""}`} aria-hidden="true"><span className="update-visual-grid" /><img src={publicPath("/clout-icon.png")} alt="" /><div><small>CLOUT STUDIOS</small><strong>{update.category === "paper" ? "PAPER TRADE" : update.category.toUpperCase()}</strong></div></div>;
}

function StepIcon({ type }: { type: "robinhood" | "ethereum" | "verify" | "connect" }) {
  if (type === "robinhood") {
    return <img className="platform-step-logo" src={publicPath("/robinhood.png")} alt="" aria-hidden="true" />;
  }
  if (type === "ethereum") {
    return <img className="platform-step-logo" src={publicPath("/eth.png")} alt="" aria-hidden="true" />;
  }
  if (type === "verify") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8 19 7v5.2c0 4.1-2.8 6.8-7 8-4.2-1.2-7-3.9-7-8V7l7-3.2Z" /><path d="m8.7 12 2 2 4.6-4.5" /></svg>;
  }
  return <img className="clout-step-logo" src={publicPath("/clout-icon.png")} alt="" aria-hidden="true" />;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [walletChooserOpen, setWalletChooserOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletType, setWalletType] = useState<"metamask" | "robinhood" | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [holderSessionToken, setHolderSessionToken] = useState("");
  const [holderSessionLoading, setHolderSessionLoading] = useState(true);
  const [holderDashboard, setHolderDashboard] = useState<HolderDashboard | null>(null);
  const [holderDashboardLoading, setHolderDashboardLoading] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"overview" | "payouts" | "roblox">("overview");
  const [payoutChoice, setPayoutChoice] = useState<"clout" | "robux">("clout");
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [robloxChecking, setRobloxChecking] = useState(false);
  const [robloxError, setRobloxError] = useState<{ message: string; code?: string; joinUrl?: string; profile?: HolderApiError["profile"] } | null>(null);
  const [financialRange, setFinancialRange] = useState<"monthly" | "all">("monthly");
  const [weeklyStatements, setWeeklyStatements] = useState<WeeklyStatement[]>([]);
  const [studioUpdates, setStudioUpdates] = useState<StudioUpdate[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState(false);
  const [statementIndex, setStatementIndex] = useState(0);
  const [reportingCurrency, setReportingCurrency] = useState<ReportingCurrency>("usd");
  const [ethUsdRate, setEthUsdRate] = useState<number | null>(null);
  const [updatePage, setUpdatePage] = useState(0);
  const [selectedUpdate, setSelectedUpdate] = useState<StudioUpdate | null>(null);
  const [activeGuideStep, setActiveGuideStep] = useState(0);
  const walletDisplay = walletAddress.length > 16 ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : walletAddress;
  const activeStatement = weeklyStatements[statementIndex] ?? null;
  const gameRevenueUsd = activeStatement ? activeStatement.gameRevenueRobux * ROBUX_USD_RATE : null;
  const coinRevenueUsd = activeStatement && ethUsdRate ? activeStatement.coinRevenueEth * ethUsdRate : null;
  const advertisingUsd = activeStatement ? activeStatement.advertisingRobux * ROBUX_USD_RATE : null;
  const maintenanceUsd = activeStatement ? activeStatement.maintenanceRobux * ROBUX_USD_RATE : null;
  const operatingCostsUsd = advertisingUsd !== null && maintenanceUsd !== null ? advertisingUsd + maintenanceUsd : null;
  const distributionsUsd = activeStatement && ethUsdRate ? activeStatement.distributionsEth * ethUsdRate : null;
  const buybacksUsd = activeStatement && ethUsdRate ? activeStatement.buybacksEth * ethUsdRate : null;
  const netRevenueUsd = gameRevenueUsd !== null && coinRevenueUsd !== null && operatingCostsUsd !== null ? gameRevenueUsd + coinRevenueUsd - operatingCostsUsd : null;
  const currencyOrder: ReportingCurrency[] = ["usd", "eth", "robux"];

  const formatReportingValue = (usdValue: number | null) => {
    if (usdValue === null) return "Rate unavailable";
    if (reportingCurrency === "eth") {
      if (!ethUsdRate) return "Rate unavailable";
      const value = usdValue / ethUsdRate;
      return `${value.toLocaleString("en-US", { maximumFractionDigits: value < 10 ? 4 : 2 })} ETH`;
    }
    if (reportingCurrency === "robux") {
      const value = usdValue / ROBUX_USD_RATE;
      return <span className="formatted-asset-value"><img src={publicPath("/robux-logo.png")} alt="" aria-hidden="true" /><span>{new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)}</span></span>;
    }
    return `$${usdValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const formatCompactNumber = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);

  const cycleReportingCurrency = () => {
    const current = currencyOrder.indexOf(reportingCurrency);
    setReportingCurrency(currencyOrder[(current + 1) % currencyOrder.length]);
  };

  const statementRows = activeStatement ? [
    { label: "Game revenue", value: gameRevenueUsd },
    { label: "Coin revenue", value: coinRevenueUsd },
    { label: "Advertising", value: advertisingUsd },
    { label: "Development & maintenance", value: maintenanceUsd },
    { label: "Holder distributions", value: distributionsUsd },
    { label: "Token buybacks", value: buybacksUsd },
    { label: "Net studio revenue", value: netRevenueUsd, source: "After disclosed operating costs", total: true },
  ] : [];

  const performanceStatements = financialRange === "monthly" ? weeklyStatements.slice(-4) : weeklyStatements;
  const performanceValues = ethUsdRate ? performanceStatements.map((statement) => (
    statement.gameRevenueRobux * ROBUX_USD_RATE
    + statement.coinRevenueEth * ethUsdRate
    - (statement.advertisingRobux + statement.maintenanceRobux) * ROBUX_USD_RATE
  )) : [];
  const performanceMaximum = Math.max(...performanceValues, 1);
  const performancePoints = ethUsdRate ? performanceStatements.map((statement, index) => [
    statement.published.replace("Published ", ""),
    performanceValues[index],
    Math.max(20, Math.round((performanceValues[index] / performanceMaximum) * 94)),
  ] as const) : [];
  const updateStart = updatePage === 0 ? 1 : 7 + (updatePage - 1) * 9;
  const updateCount = updatePage === 0 ? 6 : 9;
  const visibleUpdates = studioUpdates.slice(updateStart, updateStart + updateCount);
  const hasOlderUpdates = updateStart + updateCount < studioUpdates.length;
  const hasNewerUpdates = updatePage > 0;

  const applyHolderDashboard = useCallback((next: HolderDashboard) => {
    setHolderDashboard(next);
    setWalletAddress(next.walletAddress);
    setPayoutChoice(next.profile.payoutPreference);
    if (next.profile.robloxUsername) setRobloxUsername(next.profile.robloxUsername);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const stored = readStoredSession();
    if (!stored) {
      setHolderSessionLoading(false);
      return;
    }
    holderRequest<{ walletAddress: string }>("/v1/public/holder/session", stored.sessionToken)
      .then(() => holderRequest<HolderDashboard>("/v1/public/holder/dashboard", stored.sessionToken))
      .then((dashboard) => {
        if (!active) return;
        setHolderSessionToken(stored.sessionToken);
        setWalletType(stored.walletType);
        applyHolderDashboard(dashboard);
      })
      .catch(() => {
        window.localStorage.removeItem(HOLDER_SESSION_KEY);
      })
      .finally(() => { if (active) setHolderSessionLoading(false); });
    return () => { active = false; };
  }, [applyHolderDashboard]);

  useEffect(() => {
    if (!holderSessionToken) return;
    const refresh = () => {
      holderRequest<HolderDashboard>("/v1/public/holder/dashboard", holderSessionToken)
        .then((dashboard) => applyHolderDashboard(dashboard))
        .catch((error: HolderApiError) => {
          if (error.code !== "SESSION_EXPIRED") return;
          window.localStorage.removeItem(HOLDER_SESSION_KEY);
          setHolderSessionToken("");
          setHolderDashboard(null);
          setWalletAddress("");
        });
    };
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [applyHolderDashboard, holderSessionToken]);

  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_API_URL}/v1/public/content`, { cache: "no-store", mode: "cors" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Public content request failed.");
        return response.json() as Promise<{ updates?: StudioUpdate[]; statements?: WeeklyStatement[] }>;
      })
      .then((content) => {
        if (!active) return;
        const statements = content.statements ?? [];
        setWeeklyStatements(statements);
        setStatementIndex(Math.max(0, statements.length - 1));
        const updates = (content.updates ?? []).map((update) => ({ ...update, imageUrl: backendAssetUrl(update.imageUrl) }));
        setStudioUpdates(updates);
      })
      .catch(() => { if (active) setContentError(true); })
      .finally(() => { if (active) setContentLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadEthPrice = async () => {
      try {
        const response = await fetch(ETH_USD_TICKER_URL, { cache: "no-store", mode: "cors" });
        if (!response.ok) return;
        const data = await response.json() as { error?: string[]; result?: Record<string, { c?: string[] }> };
        const ticker = Object.values(data.result ?? {})[0];
        const price = Number(ticker?.c?.[0]);
        if (active && (!data.error || data.error.length === 0) && Number.isFinite(price) && price > 0) {
          setEthUsdRate(price);
        }
      } catch {
        if (active) setEthUsdRate(null);
      }
    };
    loadEthPrice();
    const interval = window.setInterval(loadEthPrice, 300000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!selectedUpdate && !walletOpen && !walletChooserOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedUpdate(null);
      setWalletOpen(false);
      setWalletChooserOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); };
  }, [selectedUpdate, walletOpen, walletChooserOpen]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [contentLoading, weeklyStatements.length, studioUpdates.length]);

  const openLink = (key: ExternalLinkKey) => {
    const href = links[key];
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const authenticateEthereumWallet = async (provider: EthereumProvider, selectedWallet: "metamask" | "robinhood") => {
    const currentChain = String(await provider.request({ method: "eth_chainId" }));
    if (currentChain.toLowerCase() !== ETH_CHAIN_ID) {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ETH_CHAIN_ID }] });
      } catch {
        throw new Error("Switch your wallet to Ethereum Mainnet to continue.");
      }
    }
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("The wallet did not return a valid Ethereum address.");
    const challenge = await holderRequest<{ challengeId: string; message: string }>("/v1/public/holder/challenge", "", { method: "POST", body: JSON.stringify({ walletAddress: address, network: "ethereum" }) });
    const signature = await provider.request({ method: "personal_sign", params: [textToHex(challenge.message), address] });
    if (typeof signature !== "string" || !signature.startsWith("0x")) throw new Error("The wallet did not return a valid sign-in signature.");
    const session = await holderRequest<{ sessionToken: string; walletAddress: string }>("/v1/public/holder/verify", "", { method: "POST", body: JSON.stringify({ walletAddress: address, challengeId: challenge.challengeId, signature, network: "ethereum" }) });
    const dashboard = await holderRequest<HolderDashboard>("/v1/public/holder/dashboard", session.sessionToken);
    const stored: StoredHolderSession = { sessionToken: session.sessionToken, walletAddress: session.walletAddress || address, walletType: selectedWallet };
    window.localStorage.setItem(HOLDER_SESSION_KEY, JSON.stringify(stored));
    setHolderSessionToken(session.sessionToken);
    setWalletType(selectedWallet);
    applyHolderDashboard(dashboard);
    setDashboardTab("overview");
    setWalletChooserOpen(false);
    setWalletOpen(true);
    setToast(`${selectedWallet === "metamask" ? "MetaMask" : "Robinhood Wallet"} connected on Ethereum.`);
  };

  const connectWallet = async (selectedWallet: "metamask" | "robinhood") => {
    try {
      setWalletLoading(true);
      if (selectedWallet === "metamask") {
        const provider = injectedProviders().find((item) => item.isMetaMask);
        if (!provider) {
          window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
          throw new Error("MetaMask was not detected. Install it, then return to connect.");
        }
        await authenticateEthereumWallet(provider, selectedWallet);
        return;
      }

      const injected = injectedProviders().find((item) => item.isRobinhood || !item.isMetaMask);
      if (injected) {
        await authenticateEthereumWallet(injected, selectedWallet);
        return;
      }
      if (!WALLETCONNECT_PROJECT_ID) throw new Error("Add VITE_WALLETCONNECT_PROJECT_ID to enable Robinhood Wallet from a standard browser.");
      const walletConnectModule = await import("@walletconnect/ethereum-provider");
      const WalletConnectProvider = walletConnectModule.EthereumProvider;
      const provider = await WalletConnectProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [1],
        optionalChains: [1],
        showQrModal: true,
        metadata: {
          name: "CLOUT Studios",
          description: "Ethereum CLOUT holder sign-in",
          url: window.location.origin,
          icons: [`${window.location.origin}${publicPath("/clout-icon.png")}`],
        },
      });
      await provider.connect();
      await authenticateEthereumWallet(provider as unknown as EthereumProvider, selectedWallet);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    } finally {
      setWalletLoading(false);
      setHolderSessionLoading(false);
    }
  };

  const savePayoutPreference = async () => {
    if (!holderSessionToken) return;
    setPayoutSaving(true);
    try {
      await holderRequest("/v1/public/holder/preferences", holderSessionToken, { method: "PATCH", body: JSON.stringify({ payoutPreference: payoutChoice }) });
      const dashboard = await holderRequest<HolderDashboard>("/v1/public/holder/dashboard", holderSessionToken);
      applyHolderDashboard(dashboard);
      setToast(`${payoutChoice === "clout" ? "CLOUT" : "Robux"} selected for future distributions.`);
    } catch (error) {
      const failure = error as HolderApiError;
      setToast(failure.message || "The payout preference could not be saved.");
      if (failure.code === "ROBLOX_REQUIRED") setDashboardTab("roblox");
    } finally { setPayoutSaving(false); }
  };

  const linkRobloxAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!holderSessionToken) return;
    setRobloxChecking(true);
    setRobloxError(null);
    try {
      await holderRequest("/v1/public/holder/roblox", holderSessionToken, { method: "POST", body: JSON.stringify({ username: robloxUsername }) });
      const dashboard = await holderRequest<HolderDashboard>("/v1/public/holder/dashboard", holderSessionToken);
      applyHolderDashboard(dashboard);
      setRobloxError(null);
      setToast(`@${dashboard.profile.robloxUsername} linked successfully.`);
    } catch (error) {
      const failure = error as HolderApiError;
      setRobloxError({ message: failure.message || "The Roblox account could not be checked.", code: failure.code, joinUrl: failure.joinUrl, profile: failure.profile });
    } finally { setRobloxChecking(false); }
  };

  const logoutHolder = async () => {
    if (holderSessionToken) await holderRequest("/v1/public/holder/logout", holderSessionToken, { method: "POST", body: "{}" }).catch(() => null);
    window.localStorage.removeItem(HOLDER_SESSION_KEY);
    setHolderSessionToken("");
    setHolderDashboard(null);
    setWalletAddress("");
    setWalletType(null);
    setWalletOpen(false);
    setRobloxUsername("");
    setRobloxError(null);
    setToast("Signed out.");
  };

  const openHolderDashboard = async () => {
    setWalletOpen(true);
    setDashboardTab("overview");
    if (!holderSessionToken) return;
    setHolderDashboardLoading(true);
    try {
      const dashboard = await holderRequest<HolderDashboard>("/v1/public/holder/dashboard", holderSessionToken);
      applyHolderDashboard(dashboard);
    } catch (error) {
      const failure = error as HolderApiError;
      if (failure.code === "SESSION_EXPIRED") {
        window.localStorage.removeItem(HOLDER_SESSION_KEY);
        setHolderSessionToken("");
        setHolderDashboard(null);
        setWalletAddress("");
        setWalletOpen(false);
      }
      setToast(failure.message || "The holder dashboard could not be refreshed.");
    } finally { setHolderDashboardLoading(false); }
  };

  const holderTokenAmount = holderDashboard?.holdings
    ? Number(holderDashboard.holdings.balance).toLocaleString("en-US", { maximumFractionDigits: Math.min(holderDashboard.holdings.decimals, 6) })
    : null;
  const holderOwnership = holderDashboard?.holdings?.ownershipPercent ?? 0;
  const holderProgress = Math.min(100, Math.max(0, holderOwnership * 100));
  const holderPayoutHistory = holderDashboard?.payouts.history ?? [];
  const formatPayoutDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
    : "Date pending";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CLOUT Studios home"><CloutMark /><span>CLOUT<small>STUDIOS</small></span></a>
        <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label="Main navigation">
          <a href="#games" onClick={() => setMenuOpen(false)}>Our Games</a>
          <a href="#play-to-earn" onClick={() => setMenuOpen(false)}>Play to Earn</a>
          <a href="#financials" onClick={() => setMenuOpen(false)}>Reporting</a>
          <a href="#token" onClick={() => setMenuOpen(false)}>Token</a>
          <a href="#updates" onClick={() => setMenuOpen(false)}>Updates</a>
        </nav>
        <div className="header-actions">
          {links.coin && <button className="text-button desktop-only" type="button" onClick={() => openLink("coin")}>Acquire CLOUT</button>}
          {walletAddress ? (
            <>
              <span className="wallet-connected" aria-label={`Connected wallet ${walletAddress}`}><i />{walletDisplay}</span>
              <button className="connect-button dashboard-button" type="button" onClick={openHolderDashboard}>Open dashboard</button>
            </>
          ) : (
            <button className="connect-button" type="button" disabled={walletLoading || holderSessionLoading} onClick={() => setWalletChooserOpen(true)}>{holderSessionLoading ? "Restoring session..." : walletLoading ? "Connecting..." : "Connect wallet"}</button>
          )}
          <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><span /><span /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-scene" aria-hidden="true">
          <div className="hero-grid-lines" />
          <span className="hero-mesh mesh-one" />
          <span className="hero-mesh mesh-two" />
          <span className="hero-mesh mesh-three" />
          <span className="hero-beam beam-one" />
          <span className="hero-beam beam-two" />
          <div className="hero-particles"><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
        <div className="hero-copy">
          <h1>Play the market.<br /><em>Earn your CLOUT.</em></h1>
          <p className="hero-lede">CLOUT Studios develops market-driven Roblox experiences and publishes the performance behind them, covering revenue, operating costs, buybacks and holder distributions.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#games">Explore Game Shares <ArrowUpRight /></a>
            <a className="secondary-button" href="#play-to-earn">Explore Play to Earn <ArrowUpRight /></a>
          </div>
        </div>
      </section>

      <section className="portfolio-section section-shell" id="games">
        <div className="section-heading reveal">
          <div><h2>Games built like <em>living markets.</em></h2><p>Follow the studio products, their economies and the performance they contribute to CLOUT.</p></div>
          <button className="link-button" type="button" onClick={() => openLink("robloxGroup")}>Visit our Roblox group <ArrowUpRight /></button>
        </div>

        <div className="game-grid">
          <article className="game-card reveal">
            <a className="game-art clout-art" href={links.robloxGame} target="_blank" rel="noreferrer" aria-label="Open CLOUT on Roblox">
              <img className="game-cover-image" src={publicPath("/clout-game-cover.png")} alt="CLOUT Roblox game icon" />
            </a>
            <div className="game-content">
              <div className="game-topline"><span className="status-dot"><i /> Launched</span><span className="game-visits">150K+ visits</span></div>
              <h3>CLOUT</h3>
              <p>Robinhood&apos;s first play-to-earn game and Roblox&apos;s first and most realistic memecoin simulator. Trade, level up and turn your in-game CLOUT into real CLOUT rewards.</p>
              <div className="game-tags"><span>Robinhood</span><span>Play to earn</span><span>Memecoin simulator</span></div>
              <button type="button" onClick={() => openLink("robloxGame")}>View CLOUT <ArrowUpRight /></button>
            </div>
          </article>

          <article className="game-card reveal delay-one">
            <div className="game-art paper-art coming-soon-art" aria-label="Paper Trade coming soon">
              <span>Coming soon</span>
            </div>
            <div className="game-content">
              <div className="game-topline"><span className="status-dot building"><i /> In development</span></div>
              <h3>Paper Trade</h3>
              <p>Learn the rhythm of real markets without risking real money. Build a paper portfolio across stocks and prediction markets inside Roblox.</p>
              <div className="game-tags"><span>Paper trading</span><span>Stocks</span><span>Prediction markets</span></div>
            </div>
          </article>
        </div>
      </section>

      <section className="earn-section" id="play-to-earn">
        <div className="section-shell">
          <div className="section-heading earn-heading reveal">
            <div><h2>Play. Trade. Level up.<br /><em>Earn CLOUT.</em></h2><p>Your in-game progress becomes a route toward CLOUT rewards. Skill, activity and progression drive the experience.</p></div>
          </div>
          <div className="earn-flow reveal" aria-label="Play to earn progression">
            {[
              ["Play", "Enter CLOUT experiences and build your in-game position."],
              ["Trade", "Read the market, make moves and grow your in-game CLOUT."],
              ["Level up", "Turn consistent play and smart trading into progression."],
              ["Earn CLOUT", "Qualifying gameplay rewards can be issued as CLOUT through Robinhood."],
            ].map(([title, copy]) => <article key={title}><div><strong>{title}</strong><p>{copy}</p></div><i aria-hidden="true">↗</i></article>)}
          </div>
        </div>
      </section>

      <section className="financial-section" id="financials">
        <div className="section-shell">
          <div className="section-heading financial-heading reveal">
            <div><h2>Weekly revenue and <em>studio performance.</em></h2><p>Each weekly statement reports revenue from the games and coin alongside operating costs, studio reserves, buybacks and holder distributions.</p></div>
          </div>

          {contentLoading ? <div className="public-empty-state reveal"><strong>Loading published statements.</strong><p>Retrieving the latest reporting data from CLOUT Studios.</p></div> : activeStatement ? <>
          <div className="report-banner reveal">
            <div><strong>Revenue statements are published every week.</strong><small>{activeStatement.published}</small></div>
            <div className="currency-cluster">
              <button className="currency-cycle" type="button" onClick={cycleReportingCurrency} aria-label="Cycle reporting currency"><span>View as</span><strong>{reportingCurrency === "usd" ? "$ USD" : reportingCurrency === "eth" ? <><img src={publicPath("/eth.png")} alt="" aria-hidden="true" />ETH</> : <><img src={publicPath("/robux-logo.png")} alt="" aria-hidden="true" />Robux</>}</strong><i>↻</i></button>
              <small>{ethUsdRate ? (reportingCurrency === "eth" ? `Live ETH rate: $${ethUsdRate.toFixed(2)}` : reportingCurrency === "robux" ? "DevEx rate: $0.0038 per earned Robux" : `ETH $${ethUsdRate.toFixed(2)} | Robux $0.0038`) : "Live ETH rate unavailable"}</small>
            </div>
          </div>

          <div className="report-grid reveal">
            <div className="report-main">
              <div className="metric-grid">
                <article><div className="metric-label"><span>Game revenue</span><button className="info-button" type="button" aria-label="About game revenue"><InfoMark /><span className="info-tooltip" role="tooltip">Robux generated across every live CLOUT Studios experience. This statement records {formatCompactNumber(activeStatement.gameRevenueRobux)} Robux, converted using the published DevEx rate.</span></button></div><strong>{formatReportingValue(gameRevenueUsd)}</strong></article>
                <article><div className="metric-label"><span>CLOUT revenue</span><button className="info-button" type="button" aria-label="About CLOUT revenue"><InfoMark /><span className="info-tooltip" role="tooltip">Revenue attributed to CLOUT coin and studio activity. This statement records {activeStatement.coinRevenueEth} ETH, converted at the current reporting rate.</span></button></div><strong>{formatReportingValue(coinRevenueUsd)}</strong></article>
                <article><div className="metric-label"><span>Operating costs</span><button className="info-button" type="button" aria-label="About operating costs"><InfoMark /><span className="info-tooltip" role="tooltip">Advertising, development and maintenance combined for the period: {formatCompactNumber(activeStatement.advertisingRobux)} Robux in advertising and {formatCompactNumber(activeStatement.maintenanceRobux)} Robux in development and maintenance.</span></button></div><strong>{formatReportingValue(operatingCostsUsd)}</strong></article>
              </div>
              <div className="report-chart">
                <div className="chart-head"><strong>{financialRange === "monthly" ? "Monthly performance" : "All-time performance"}</strong><div className="range-switch"><button className={financialRange === "monthly" ? "active" : ""} type="button" onClick={() => setFinancialRange("monthly")}>Monthly</button><button className={financialRange === "all" ? "active" : ""} type="button" onClick={() => setFinancialRange("all")}>All time</button></div></div>
                <div className="performance-chart" aria-label="Net studio revenue over time">
                  {performancePoints.length ? performancePoints.map(([label, amount, value]) => <div className="performance-bar" key={label}><strong>{formatReportingValue(amount)}</strong><i style={{ height: `${value}%` }} /><span>{label}</span></div>) : <p className="chart-unavailable">Live ETH pricing is required to calculate net performance.</p>}
                </div>
              </div>
            </div>
            <aside className="statement">
              <div className="statement-head"><div><strong>{activeStatement.period.replace(/[\u2013\u2014]/g, " to ")}</strong><small>{activeStatement.published}</small></div><div className="statement-nav">{statementIndex > 0 && <button type="button" aria-label="Older revenue statement" onClick={() => setStatementIndex((current) => current - 1)}>‹</button>}<span>{statementIndex + 1} / {weeklyStatements.length}</span>{statementIndex < weeklyStatements.length - 1 && <button type="button" aria-label="Newer revenue statement" onClick={() => setStatementIndex((current) => current + 1)}>›</button>}</div></div>
              {statementRows.map((row) => <div className={row.total ? "statement-row total" : "statement-row"} key={row.label}><span>{row.label}</span><div><strong>{formatReportingValue(row.value)}</strong>{row.source && <small>{row.source}</small>}</div></div>)}
            </aside>
          </div>
          </> : <div className="public-empty-state reveal"><strong>{contentError ? "Revenue statements could not be loaded." : "No revenue statements have been published."}</strong><p>{contentError ? "Refresh the page to try loading the published reporting data again." : "Verified weekly reporting will appear here after the first statement is released."}</p></div>}
        </div>
      </section>

      <section className="token-section section-shell" id="token">
        <div className="section-heading token-heading reveal">
          <div><h2>A clear route from <em>revenue to holders.</em></h2><p>Qualify at the published snapshot, follow each reported period and choose how an approved distribution reaches you.</p></div>
        </div>

        <div className="token-system reveal">
          <div className="eligibility-core">
            <div className="eligibility-threshold" aria-label="One percent eligibility threshold">
              <div className="threshold-number"><strong>1</strong><span>%</span></div>
              <div className="threshold-caption"><strong>Minimum eligible ownership</strong><span>Recorded at the weekly distribution snapshot</span></div>
            </div>
            <div className="eligibility-copy">
              <h3>Hold 1% or more to qualify.</h3>
              <p>Wallets holding at least 1% of the published CLOUT supply at a distribution snapshot qualify for that reporting period.</p>
              <button type="button" disabled={walletLoading || holderSessionLoading} onClick={() => walletAddress ? openHolderDashboard() : setWalletChooserOpen(true)}>{holderSessionLoading ? "Restoring session..." : walletLoading ? "Connecting..." : walletAddress ? "Open holder dashboard" : "Connect wallet"} <ArrowUpRight /></button>
            </div>
          </div>

          <div className="value-journey">
            <span className="journey-beam" aria-hidden="true" />
            <div className="journey-intro"><h3>From play to payout.</h3><p>Every distribution follows the same reported path.</p></div>
            {[
              ["Games generate revenue", "CLOUT, Paper Trade and future releases"],
              ["Operations are reported", "Costs, development and reserves"],
              ["The approved pool closes", "A frozen public statement for the period"],
              ["Eligible holders are paid", "CLOUT or Robux, based on holder preference"],
            ].map(([title, copy]) => <article className="journey-node" key={title}><strong>{title}</strong><small>{copy}</small></article>)}
          </div>

          <div className="payout-strip">
            <div className="payout-intro"><h3>Choose how you&apos;re paid.</h3></div>
            <article className="payout-route"><AssetMark type="clout" /><div><strong>CLOUT</strong><small>CLOUT sent to your connected holder wallet</small></div><i>Robinhood</i></article>
            <article className="payout-route robux-route"><AssetMark type="robux" /><div><strong>Robux</strong><small>Sent after Roblox account verification</small></div><i>+20% value</i></article>
          </div>
        </div>
      </section>

      <section className="updates-section section-shell" id="updates">
        <div className="updates-heading reveal"><div><h2>Updates.</h2><p>The latest published progress across CLOUT, Paper Trade and the studio.</p></div>{studioUpdates.length > 0 && <div className="updates-nav">{hasOlderUpdates && <button type="button" aria-label="View older updates" onClick={() => setUpdatePage((current) => current + 1)}>‹</button>}<span>{updatePage === 0 ? "Latest" : "Earlier"}</span>{hasNewerUpdates && <button type="button" aria-label="View newer updates" onClick={() => setUpdatePage((current) => current - 1)}>›</button>}</div>}</div>
        {contentLoading ? <div className="public-empty-state reveal"><strong>Loading studio updates.</strong><p>Retrieving the latest published releases.</p></div> : studioUpdates.length === 0 ? <div className="public-empty-state reveal"><strong>{contentError ? "Studio updates could not be loaded." : "No studio updates have been published."}</strong><p>{contentError ? "Refresh the page to try loading the published updates again." : "Official releases will appear here as they are published."}</p></div> : updatePage === 0 ? (
          <div className="updates-latest-layout" key={updatePage}>
            <div className="updates-grid updates-grid-compact">
              {visibleUpdates.map((update, index) => <button className="update-card" style={{ animationDelay: `${index * 45}ms` }} type="button" onClick={() => setSelectedUpdate(update)} key={`${update.date}-${update.title}`}><time>{update.date}</time><h3>{update.title}</h3><p>{update.summary}</p><span className="update-open">Read update <span>↗</span></span></button>)}
            </div>
            <button className="featured-update" type="button" onClick={() => setSelectedUpdate(studioUpdates[0])}>
              <UpdateVisual update={studioUpdates[0]} />
              <div className="featured-update-copy"><span>Most recent update</span><time>{studioUpdates[0].date}</time><h3>{studioUpdates[0].title}</h3><p>{studioUpdates[0].detail}</p><strong>Read full update <span>↗</span></strong></div>
            </button>
          </div>
        ) : (
          <div className="updates-grid updates-grid-backlog" key={updatePage}>
            {visibleUpdates.map((update, index) => <button className="update-card" style={{ animationDelay: `${index * 45}ms` }} type="button" onClick={() => setSelectedUpdate(update)} key={`${update.date}-${update.title}`}><time>{update.date}</time><h3>{update.title}</h3><p>{update.summary}</p><span className="update-open">Read update <span>↗</span></span></button>)}
          </div>
        )}
      </section>

      {links.coin && <section className="how-section">
        <div className="section-shell">
          <div className="section-heading how-heading reveal"><div><h2>Acquire CLOUT through <em>Robinhood.</em></h2><p>Connect a supported wallet, verify the official CLOUT coin and open your holder profile.</p></div><button className="primary-button" type="button" onClick={() => openLink("coin")}>Open CLOUT on Robinhood <ArrowUpRight /></button></div>
          <div className="acquire-guide reveal">
            <div className="guide-rail">
              <div className="guide-line"><i style={{ width: `${(activeGuideStep / (guideSteps.length - 1)) * 100}%` }} /></div>
              {guideSteps.map((step, index) => <button className={`step-${step.icon} ${activeGuideStep === index ? "active" : activeGuideStep > index ? "complete" : ""}`} type="button" onClick={() => setActiveGuideStep(index)} aria-current={activeGuideStep === index ? "step" : undefined} key={step.title}><span className="step-icon"><StepIcon type={step.icon} /></span><strong>{step.title}</strong></button>)}
            </div>
            <div className="guide-focus" key={activeGuideStep}>
              <div><h3>{guideSteps[activeGuideStep].title}</h3><p>{guideSteps[activeGuideStep].copy}</p></div>
              {activeGuideStep < guideSteps.length - 1 ? <button className="guide-next" type="button" aria-label={`Continue to ${guideSteps[activeGuideStep + 1].title}`} onClick={() => setActiveGuideStep((current) => current + 1)}><ArrowRight /></button> : <button className="guide-next final" type="button" onClick={() => openLink("coin")}>Open CLOUT <ArrowUpRight /></button>}
            </div>
            <div className="safety-note"><LockMark /><p>CLOUT Studios will never ask for a private key or recovery phrase. Wallet sign-in requests only a public address and a message signature. It does not request a transaction.</p></div>
          </div>
        </div>
      </section>}

      <footer>
        <div className="footer-main section-shell"><a className="brand footer-brand" href="#top"><CloutMark /><span>CLOUT<small>STUDIOS</small></span></a><p>Market-driven games. CLOUT rewards. Transparent reporting.</p><div className="footer-links"><a href={links.robloxGroup} target="_blank" rel="noreferrer">Roblox group</a>{links.twitter && <button type="button" onClick={() => openLink("twitter")}>X / Twitter</button>}{links.coin && <button type="button" onClick={() => openLink("coin")}>Acquire CLOUT</button>}</div></div>
        <div className="footer-bottom section-shell"><span>© 2026 CLOUT Studios</span><nav className="footer-legal-links" aria-label="Legal"><a href={publicPath("/terms/")}>Terms</a><a href={publicPath("/privacy/")}>Privacy</a></nav><span className="footer-platform"><img src={publicPath("/robinhood.png")} alt="" aria-hidden="true" /> Robinhood</span><span>Robinhood / Roblox</span></div>
      </footer>

      {walletChooserOpen && !walletAddress && (
        <div className="wallet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !walletLoading) setWalletChooserOpen(false); }}>
          <section className="wallet-panel wallet-chooser" role="dialog" aria-modal="true" aria-labelledby="wallet-chooser-title">
            <button className="wallet-close" type="button" aria-label="Close wallet chooser" onClick={() => setWalletChooserOpen(false)}>×</button>
            <div className="wallet-connect-view">
              <span className="wallet-connect-kicker">CLOUT wallet access</span>
              <h2 id="wallet-chooser-title">Connect your wallet.</h2>
              <p>Choose Robinhood Wallet or MetaMask. You will sign a free message to prove ownership. No transaction or spending approval is requested.</p>
              <div className="wallet-provider-list">
                <button type="button" disabled={walletLoading} onClick={() => connectWallet("metamask")}>
                  <span className="provider-mark metamask-mark"><img src={publicPath("/metamask.png")} alt="" aria-hidden="true" /></span><div><strong>MetaMask</strong><small>Browser extension or mobile wallet</small></div><ArrowRight />
                </button>
                <button type="button" disabled={walletLoading} onClick={() => connectWallet("robinhood")}>
                  <span className="provider-mark robinhood-mark"><img src={publicPath("/robinhood.png")} alt="" aria-hidden="true" /></span><div><strong>Robinhood Wallet</strong><small>In-app browser or WalletConnect</small></div><ArrowRight />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {walletOpen && walletAddress && (
        <div className="wallet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWalletOpen(false); }}>
          <section className="wallet-panel" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
            <button className="wallet-close" type="button" aria-label="Close holder dashboard" onClick={() => setWalletOpen(false)}>×</button>
            <div className="holder-dashboard">
              <header className="holder-dashboard-head">
                <div><span className="dashboard-kicker">Holder dashboard</span><h2 id="wallet-title">My CLOUT</h2></div>
                <div className="holder-account-actions">
                  <span className="wallet-id" title={walletAddress}><i /><span>{walletDisplay}</span><small>{walletType === "robinhood" ? "Robinhood" : "MetaMask"}</small></span>
                  <button type="button" onClick={logoutHolder}>Sign out</button>
                </div>
              </header>

              <nav className="holder-tabs" aria-label="Holder dashboard sections">
                <button className={dashboardTab === "overview" ? "active" : ""} type="button" onClick={() => setDashboardTab("overview")}>Overview</button>
                <button className={dashboardTab === "payouts" ? "active" : ""} type="button" onClick={() => setDashboardTab("payouts")}>Payout settings</button>
                <button className={dashboardTab === "roblox" ? "active" : ""} type="button" onClick={() => setDashboardTab("roblox")}>Roblox account</button>
              </nav>

              {holderDashboardLoading || !holderDashboard ? (
                <div className="holder-loading"><span /><strong>Loading holder data</strong><small>Reading the published token and payout records.</small></div>
              ) : dashboardTab === "overview" ? (
                <div className="holder-view holder-overview">
                  <section className="holder-position">
                    <div className="holder-balance">
                      <span>Current CLOUT balance</span>
                      <strong>{holderTokenAmount ?? (holderDashboard.holdings.tokenAddress ? "Unavailable" : "Not configured")}</strong>
                      <small>{holderDashboard.holdings.tokenAddress ? "Read live from the official CLOUT coin contract" : "The official coin contract has not been published yet"}</small>
                    </div>
                    <div className="holder-ownership">
                      <div><span>Ownership</span><strong>{holderDashboard.holdings.tokenAddress ? `${holderOwnership.toLocaleString("en-US", { maximumFractionDigits: 6 })}%` : "Not available"}</strong></div>
                      <div><span>Revenue share</span><strong className={holderDashboard.holdings.eligible ? "is-qualified" : ""}>{holderDashboard.holdings.eligible ? "Qualified" : "Below 1%"}</strong></div>
                      <div className="holder-threshold"><span style={{ width: `${holderProgress}%` }} /></div>
                      <small>{holderDashboard.holdings.eligible ? "Qualified at the latest live reading" : `${holderProgress.toLocaleString("en-US", { maximumFractionDigits: 1 })}% of the minimum holding reached`}</small>
                    </div>
                  </section>

                  {holderDashboard.holdings.error && <p className="holder-inline-error">{holderDashboard.holdings.error}</p>}

                  <section className="holder-paid-summary" aria-label="Completed payouts">
                    <div className="paid-summary-intro"><span>Lifetime distributions</span><h3>Paid to this account.</h3><p>Confirmed holder payouts linked to this wallet.</p></div>
                    <div className="paid-asset"><AssetMark type="clout" /><div><span>Paid in CLOUT</span><strong>{holderDashboard.payouts.totalClout.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 })} CLOUT</strong></div></div>
                    <div className="paid-asset"><AssetMark type="robux" /><div><span>Paid in Robux</span><strong>{holderDashboard.payouts.totalRobux.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></div></div>
                  </section>

                  <section className="holder-history">
                    <div className="holder-section-title"><div><span>Distribution history</span><h3>Completed payouts</h3></div><button type="button" onClick={() => setDashboardTab("payouts")}>Manage payout method <ArrowRight /></button></div>
                    {holderPayoutHistory.length ? <div className="payout-history-list">
                      {holderPayoutHistory.map((payout, index) => (
                        <article key={`${payout.payoutId}-${index}`}>
                          <AssetMark type={payout.asset} />
                          <div><strong>{payout.asset === "clout" ? `${payout.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} CLOUT` : `${payout.amount.toLocaleString("en-US")} Robux`}</strong><small>{formatPayoutDate(payout.completedAt || payout.createdAt)}</small></div>
                          {payout.txHash ? <a href={`https://etherscan.io/tx/${payout.txHash}`} target="_blank" rel="noreferrer">View transaction <ArrowUpRight /></a> : <span>Confirmed</span>}
                        </article>
                      ))}
                    </div> : <div className="holder-empty"><span /><h4>No completed payouts yet</h4><p>Your first confirmed distribution will appear here with its date and public proof.</p></div>}
                  </section>
                </div>
              ) : dashboardTab === "payouts" ? (
                <div className="holder-view holder-payout-settings">
                  <div className="holder-view-heading"><span>Payout settings</span><h3>Choose how distributions reach you.</h3><p>Your preference is saved to this wallet account. Robux requires a verified Roblox account in the CLOUT group.</p></div>
                  <div className="holder-methods">
                    <button className={payoutChoice === "clout" ? "active" : ""} type="button" onClick={() => setPayoutChoice("clout")}>
                      <AssetMark type="clout" /><div><strong>CLOUT</strong><span>Sent directly to this holder wallet</span><small>CLOUT payout</small></div><i aria-hidden="true" />
                    </button>
                    <button className={payoutChoice === "robux" ? "active" : ""} type="button" onClick={() => { setPayoutChoice("robux"); if (!holderDashboard.profile.robloxGroupMember) setDashboardTab("roblox"); }}>
                      <AssetMark type="robux" /><div><strong>Robux</strong><span>Sent after Roblox account verification</span><small>20% additional value</small></div><i aria-hidden="true" />
                    </button>
                  </div>
                  <div className="holder-method-footer">
                    <div><span>Current selection</span><strong>{holderDashboard.profile.payoutPreference === "clout" ? "CLOUT" : "Robux"}</strong></div>
                    <button className="primary-button" type="button" disabled={payoutSaving || payoutChoice === holderDashboard.profile.payoutPreference} onClick={savePayoutPreference}>{payoutSaving ? "Saving..." : "Save payout preference"}</button>
                  </div>
                  {!holderDashboard.profile.robloxGroupMember && <button className="holder-account-prompt" type="button" onClick={() => setDashboardTab("roblox")}><span>Want Robux payouts?</span><strong>Verify your Roblox account first</strong><ArrowRight /></button>}
                </div>
              ) : (
                <div className="holder-view holder-roblox-settings">
                  <div className="holder-view-heading"><span>Roblox account</span><h3>Link your Roblox identity.</h3><p>Enter your Roblox username. We will confirm that the account exists and is a member of the CLOUT group.</p></div>

                  {holderDashboard.profile.robloxUsername && <div className="verified-roblox-profile">
                    {holderDashboard.profile.robloxAvatarUrl ? <img src={holderDashboard.profile.robloxAvatarUrl} alt={`${holderDashboard.profile.robloxUsername} Roblox avatar`} /> : <span>{holderDashboard.profile.robloxUsername.slice(0, 1).toUpperCase()}</span>}
                    <div><small>Verified account</small><strong>{holderDashboard.profile.robloxDisplayName || holderDashboard.profile.robloxUsername}</strong><p>@{holderDashboard.profile.robloxUsername}</p></div>
                    <div className="group-verified"><i /> CLOUT group member</div>
                  </div>}

                  <form className="roblox-link-form" onSubmit={linkRobloxAccount}>
                    <label htmlFor="roblox-username">Roblox username</label>
                    <div><span>@</span><input id="roblox-username" name="robloxUsername" value={robloxUsername} onChange={(event) => setRobloxUsername(event.target.value)} placeholder="Your username" autoComplete="off" maxLength={20} /><button type="submit" disabled={robloxChecking || robloxUsername.trim().length < 3}>{robloxChecking ? "Checking..." : holderDashboard.profile.robloxUsername ? "Check and update" : "Check account"}</button></div>
                    <small>Use your Roblox username, not your display name.</small>
                  </form>

                  {robloxError && <div className="roblox-error" role="alert">
                    {robloxError.profile?.avatarUrl && <img src={robloxError.profile.avatarUrl} alt="Roblox profile" />}
                    <div><strong>{robloxError.code === "ROBLOX_GROUP_REQUIRED" ? "Group membership required" : "Account could not be linked"}</strong><p>{robloxError.message}</p>{robloxError.joinUrl && <a href={robloxError.joinUrl} target="_blank" rel="noreferrer">Join the CLOUT group <ArrowUpRight /></a>}</div>
                  </div>}

                  <div className="roblox-requirements"><div><i className={holderDashboard.profile.robloxUsername ? "done" : ""} /><span><strong>Valid Roblox account</strong><small>The username must resolve to an active Roblox profile.</small></span></div><div><i className={holderDashboard.profile.robloxGroupMember ? "done" : ""} /><span><strong>CLOUT group member</strong><small>Membership is required before selecting Robux payouts.</small></span></div></div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedUpdate && (
        <div className="update-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUpdate(null); }}>
          <article className="update-modal" role="dialog" aria-modal="true" aria-labelledby="update-modal-title">
            <button className="update-close" type="button" aria-label="Close update" onClick={() => setSelectedUpdate(null)}>×</button>
            <UpdateVisual update={selectedUpdate} />
            <div className="update-modal-copy"><span>{selectedUpdate.category === "paper" ? "Paper Trade" : selectedUpdate.category === "clout" ? "CLOUT" : selectedUpdate.category === "reporting" ? "Reporting" : "Studio"} update</span><time>{selectedUpdate.date}</time><h2 id="update-modal-title">{selectedUpdate.title}</h2><p>{selectedUpdate.detail}</p></div>
          </article>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
