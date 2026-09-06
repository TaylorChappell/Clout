# CLOUT Studios frontend

The CLOUT Studios Ethereum frontend, packaged as a static Vite/React project for GitHub Pages. It includes MetaMask sign-in, Robinhood Wallet through WalletConnect, persistent holder sessions, ETH reporting, a holder dashboard and separate Game Shares and Play-to-Earn sections.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

The production Railway API is used by default. To use another backend, copy `.env.example` to `.env.local` and change `VITE_BACKEND_API_URL`.

Create a free Reown project ID and set `VITE_WALLETCONNECT_PROJECT_ID` to enable Robinhood Wallet from a standard desktop or mobile browser. For the prebuilt direct-upload site, paste the same value into `config.js` instead. Robinhood Wallet can still connect without it when the site is opened inside a compatible wallet browser.

## Deploy to GitHub Pages

1. Create a GitHub repository and upload every file in this folder.
2. In the repository, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to the `main` branch, or run the **Deploy CLOUT Studios to GitHub Pages** workflow manually.

The included workflow detects the repository subpath automatically, builds the static site and publishes it to GitHub Pages. The `/admin`, `/terms` and `/privacy` routes are included in the export.

Do not publish the source `index.html` directly. That file intentionally points to `src/main.tsx` for Vite development. GitHub Pages must publish the compiled `dist` directory, which the included workflow handles automatically. A separate direct-upload ZIP is also supplied for branch-based Pages hosting.

## Railway CORS setting

The frontend talks directly to the Railway backend. Set the backend's `FRONTEND_ORIGIN` to the GitHub Pages origin, without the repository path or a trailing slash:

```env
FRONTEND_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
```

For a custom domain, use that domain instead. The Ethereum backend can accept comma-separated origins when both the existing site and GitHub Pages must remain active.

The Railway backend must be the Ethereum holder-auth release and must define `ETHEREUM_RPC_URL` and `CLOUT_TOKEN_ADDRESS`. The old Solana payout executor is not used by this frontend.

## Commands

```bash
npm run build
npm run typecheck
npm test
```

The static production output is written to `dist`.
