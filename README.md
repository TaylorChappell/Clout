# CLOUT Studios frontend

The CLOUT Studios Robinhood-focused frontend, packaged as a static Vite/React project for GitHub Pages. It includes MetaMask sign-in, Robinhood Wallet through WalletConnect, persistent holder sessions, ETH reporting, a holder dashboard and separate Game Shares and Play-to-Earn sections.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

The production Railway API is used by default. To use another backend, copy `.env.example` to `.env.local` and change `VITE_BACKEND_API_URL`.

### WalletConnect project ID

`WALLETCONNECT_PROJECT_ID` is a frontend GitHub repository variable. It does not belong on Railway.

1. Create a project at [Reown Cloud](https://cloud.reown.com).
2. Copy its Project ID.
3. In GitHub, open **Settings > Secrets and variables > Actions > Variables**.
4. Create a repository variable named `WALLETCONNECT_PROJECT_ID` and paste the Project ID as its value.
5. Add the GitHub Pages origin and any custom domain to the project allowlist in Reown Cloud.

The included GitHub Actions workflow exposes that value to Vite as `VITE_WALLETCONNECT_PROJECT_ID`. This Project ID is a public frontend identifier, not a private key.

For the prebuilt direct-upload site, edit `config.js` and place the same value in `walletConnectProjectId` instead.

## Deploy to GitHub Pages

1. Create a GitHub repository and upload every file in this folder.
2. In the repository, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to the `main` branch, or run the **Deploy CLOUT Studios to GitHub Pages** workflow manually.

The included workflow builds the site for the `https://clout.game` domain root and publishes it to GitHub Pages. The `public/CNAME` file keeps the custom domain attached during deployment. The `/admin`, `/terms` and `/privacy` routes are included in the export.

Do not publish the source `index.html` directly. That file intentionally points to `src/main.tsx` for Vite development. GitHub Pages must publish the compiled `dist` directory, which the included workflow handles automatically. A separate direct-upload ZIP is also supplied for branch-based Pages hosting.

## Railway CORS setting

The frontend talks directly to the Railway backend. Set the backend's `FRONTEND_ORIGIN` to the GitHub Pages origin, without the repository path or a trailing slash:

```env
FRONTEND_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
```

For a custom domain, use that domain instead. The Ethereum backend can accept comma-separated origins when both the existing site and GitHub Pages must remain active.

### Ethereum RPC URL

`ETHEREUM_RPC_URL` is a Railway backend variable. It does not belong in the frontend repository.

1. Create an Ethereum Mainnet HTTPS endpoint with Alchemy, Infura, QuickNode or another production RPC provider.
2. In Railway, open the backend service and select **Variables**.
3. Add `ETHEREUM_RPC_URL` with the complete HTTPS endpoint as its value.
4. Redeploy the backend service.

Do not use a WebSocket URL. Keep provider keys contained in the Railway variable and never commit them to GitHub.

The Railway backend must also define `CLOUT_TOKEN_ADDRESS` after the official token contract is deployed. The old Solana payout executor is not used by this frontend.

## Commands

```bash
npm run build
npm run typecheck
npm test
```

The static production output is written to `dist`.
