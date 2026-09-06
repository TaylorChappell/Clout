import type { ReactNode } from "react";

type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  label: string;
  title: string;
  introduction: string;
  sections: LegalSection[];
};

const robloxGroup = "https://www.roblox.com/communities/386748770/CLOUT-Crypto-Trading-Simulator#!/about";
const PUBLIC_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
const publicPath = (path: string) => `${PUBLIC_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;

export default function LegalPage({ label, title, introduction, sections }: LegalPageProps) {
  return (
    <main className="legal-page">
      <header className="site-header legal-header">
        <a className="brand" href={publicPath("/")} aria-label="CLOUT Studios home">
          <span className="clout-mark" aria-hidden="true"><img src={publicPath("/clout-icon.png")} alt="" /></span>
          <span>CLOUT<small>STUDIOS</small></span>
        </a>
        <nav className="legal-header-nav" aria-label="Legal navigation">
          <a href={publicPath("/terms/")}>Terms</a>
          <a href={publicPath("/privacy/")}>Privacy</a>
          <a className="legal-back-link" href={publicPath("/")}>Back to site</a>
        </nav>
      </header>

      <section className="legal-hero">
        <div className="legal-glow" aria-hidden="true" />
        <div className="section-shell legal-hero-inner">
          <span>{label}</span>
          <h1>{title}</h1>
          <p>{introduction}</p>
          <time dateTime="2026-08-18">Effective 18 August 2026</time>
        </div>
      </section>

      <div className="section-shell legal-layout">
        <aside className="legal-index">
          <span>On this page</span>
          <nav aria-label={`${title} sections`}>
            {sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><small>{String(index + 1).padStart(2, "0")}</small>{section.title}</a>)}
          </nav>
        </aside>

        <article className="legal-document">
          {sections.map((section, index) => (
            <section id={section.id} key={section.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{section.title}</h2>{section.content}</div>
            </section>
          ))}
        </article>
      </div>

      <footer>
        <div className="footer-main section-shell">
          <a className="brand footer-brand" href={publicPath("/")}><span className="clout-mark" aria-hidden="true"><img src={publicPath("/clout-icon.png")} alt="" /></span><span>CLOUT<small>STUDIOS</small></span></a>
          <p>Market-driven games. Transparently operated.</p>
          <div className="footer-links"><a href={robloxGroup} target="_blank" rel="noreferrer">Roblox group</a><a href={publicPath("/terms/")}>Terms</a><a href={publicPath("/privacy/")}>Privacy</a></div>
        </div>
        <div className="footer-bottom section-shell"><span>© 2026 CLOUT Studios</span><nav className="footer-legal-links" aria-label="Legal"><a href={publicPath("/terms/")}>Terms</a><a href={publicPath("/privacy/")}>Privacy</a></nav><span>Robinhood / Roblox</span></div>
      </footer>
    </main>
  );
}
