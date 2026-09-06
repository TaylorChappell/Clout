import LegalPage from "../legal/LegalPage";

const sections = [
  {
    id: "acceptance",
    title: "Using this website",
    content: <><p>These terms govern your access to the CLOUT Studios website and its public reporting, wallet connection, account linking and holder tools. By using the website, you agree to follow these terms and all laws that apply to you.</p><p>If you do not agree, do not connect a wallet, submit account information or use the holder features.</p></>,
  },
  {
    id: "information",
    title: "Published information",
    content: <><p>Studio statements, exchange-rate conversions, game metrics, forecasts and token information are provided for transparency and general information. Figures may be preliminary, delayed, estimated or corrected when better source data becomes available.</p><p>Nothing on this website is financial, investment, tax or legal advice. You are responsible for checking information independently before making a decision.</p></>,
  },
  {
    id: "token",
    title: "CLOUT token and risk",
    content: <><p>Digital assets are volatile and can lose all of their value. Buying or holding CLOUT does not guarantee profit, liquidity, a buyback, a distribution or continued access to any feature.</p><p>The token does not represent legal ownership, equity, debt or shares in CLOUT Studios unless that right is expressly granted in separate binding documentation. Any holder benefit shown on the website remains subject to the published eligibility rules, applicable law and the final terms for that reporting period.</p></>,
  },
  {
    id: "distributions",
    title: "Eligibility and distributions",
    content: <><p>The current website describes a minimum holding threshold of 1% of the published CLOUT supply at a stated snapshot. Meeting that threshold makes a wallet eligible for review. It does not create an unconditional right to payment.</p><p>Distribution amounts, timing, available payout methods and verification requirements may change. Robux payouts may require a verified Roblox account, group membership and compliance with Roblox rules. Network fees, exchange rates and third-party processing can affect the final value received.</p></>,
  },
  {
    id: "wallets",
    title: "Wallets and account security",
    content: <><p>You remain responsible for your wallet, private keys, recovery phrase and connected accounts. CLOUT Studios will never ask for your private key or recovery phrase.</p><p>Wallet login may request a public address and a signed message to confirm control. Check the message and website address before signing. CLOUT Studios is not responsible for losses caused by compromised devices, phishing, third-party wallets or transactions you approve.</p></>,
  },
  {
    id: "conduct",
    title: "Acceptable use",
    content: <><p>Do not interfere with the website, bypass access controls, automate abusive traffic, submit false verification information, manipulate eligibility checks or use the service for fraud, money laundering or any unlawful activity.</p><p>We may restrict access to protect the website, other users, the studio or a third-party platform.</p></>,
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: <><p>The website links to services operated by Roblox, Phantom, Solana and other providers. Their own terms, availability and privacy practices apply. CLOUT Studios does not control those services and is not responsible for their outages, policy changes or actions.</p><p>CLOUT Studios is independent and is not endorsed by or affiliated with Roblox Corporation, Solana Foundation or Phantom unless explicitly stated.</p></>,
  },
  {
    id: "ownership",
    title: "Intellectual property",
    content: <><p>The CLOUT name, visual identity, website design, written content and game materials are owned by CLOUT Studios or used with permission. You may view and share public links, but you may not copy, resell or misrepresent the content as your own.</p></>,
  },
  {
    id: "liability",
    title: "Availability and liability",
    content: <><p>The website is provided on an as-available basis. We do not promise uninterrupted access, error-free data or permanent availability of any game, token feature, report or payout method.</p><p>To the fullest extent permitted by law, CLOUT Studios is not liable for indirect loss, lost profits, lost digital assets, market losses or damage caused by third-party platforms. Nothing in these terms excludes liability that cannot legally be excluded.</p></>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    content: <><p>We may update these terms when the website, games, token features or legal requirements change. The effective date at the top of this page will show the latest version. Continued use after an update means you accept the revised terms.</p><p>Questions about these terms can be sent through the official CLOUT Studios community channels linked on this website.</p></>,
  },
];

export default function TermsPage() {
  return <LegalPage label="Legal" title="Terms of Use" introduction="The rules that apply when you use the CLOUT Studios website, reporting tools and connected holder features." sections={sections} />;
}
