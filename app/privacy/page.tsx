import LegalPage from "../legal/LegalPage";

const sections = [
  {
    id: "scope",
    title: "Scope",
    content: <><p>This policy explains how CLOUT Studios handles information when you visit the website, connect a wallet, link a Roblox account or use holder tools.</p><p>Third-party services such as Roblox, Phantom and Solana operate under their own privacy policies. This policy does not control how those providers process information.</p></>,
  },
  {
    id: "information-collected",
    title: "Information we collect",
    content: <><p>We may process a public Solana wallet address, signed wallet-authentication messages, a Roblox username, account-verification results, payout preferences and records needed to calculate or confirm holder eligibility.</p><p>We may also receive basic technical information such as browser type, device type, approximate region, page activity, error logs, security events and referral information when analytics or security systems are enabled.</p></>,
  },
  {
    id: "never-collected",
    title: "What we never request",
    content: <><p>CLOUT Studios does not need your wallet private key or recovery phrase. Do not provide either to us or to anyone claiming to represent the studio.</p><p>A legitimate wallet login only asks you to connect a public address and sign a readable authentication message. It does not authorize the website to move funds.</p></>,
  },
  {
    id: "use",
    title: "How information is used",
    content: <><p>Information may be used to authenticate a wallet, display token holdings, evaluate a published eligibility threshold, store payout preferences, verify a Roblox account, process an approved distribution, prevent abuse and maintain website security.</p><p>We may also use aggregated information to understand site performance, improve the games and produce studio reporting that does not identify an individual user.</p></>,
  },
  {
    id: "basis",
    title: "Why we process information",
    content: <><p>Depending on the feature and applicable law, processing may be necessary to provide a service you request, meet a legal obligation, protect legitimate security and operational interests, or act with your consent.</p><p>You can disconnect your wallet at any time. Disconnecting it in your browser does not automatically erase records that must be retained for security, accounting, payout or legal purposes.</p></>,
  },
  {
    id: "sharing",
    title: "When information is shared",
    content: <><p>Information may be shared with infrastructure, analytics, security, wallet, blockchain and payout providers only where needed to run the service. Public blockchain transactions are visible to anyone and cannot be made private or deleted by CLOUT Studios.</p><p>We may disclose information when required by law, to respond to valid legal requests or to protect users, the studio and the integrity of the service. We do not sell personal information.</p></>,
  },
  {
    id: "retention",
    title: "Retention and security",
    content: <><p>We keep information only for as long as needed for the purpose it was collected, including security, reporting, accounting, dispute and legal requirements. Retention periods can vary by record type.</p><p>We use reasonable technical and organisational safeguards, but no online service, wallet or blockchain interaction is completely secure. You are responsible for protecting your device and wallet credentials.</p></>,
  },
  {
    id: "rights",
    title: "Your choices and rights",
    content: <><p>Depending on where you live, you may have rights to access, correct, delete, restrict or object to the processing of personal information. You may also have the right to withdraw consent or complain to a data-protection authority.</p><p>Some data cannot be changed or removed by us, including information already written to a public blockchain or records we must retain by law.</p></>,
  },
  {
    id: "children",
    title: "Age and Roblox users",
    content: <><p>The financial and wallet features on this website are not directed to children. Users must meet the minimum age and legal requirements that apply to wallets, digital assets and related services in their location.</p><p>Roblox gameplay remains subject to Roblox account settings, age controls and platform rules.</p></>,
  },
  {
    id: "updates-contact",
    title: "Policy updates and contact",
    content: <><p>We may update this policy as the website, games, connected services or legal requirements change. The effective date at the top of this page identifies the current version.</p><p>Privacy questions and rights requests can be sent through the official CLOUT Studios community channels linked on this website. We may need to verify your identity before acting on a request.</p></>,
  },
];

export default function PrivacyPage() {
  return <LegalPage label="Legal" title="Privacy Policy" introduction="A clear account of the information CLOUT Studios handles, why it is used and the controls available to you." sections={sections} />;
}
