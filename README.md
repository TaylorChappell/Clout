# CLOUT Studios — GitHub Pages frontend

This static frontend is rebuilt from the supplied full-page reference screenshot and keeps the same dark editorial visual structure while applying the Ethereum / Robinhood changes.

## GitHub Pages
Upload the contents of this folder to the repository root, then set:
- Settings → Pages
- Deploy from a branch
- main
- /(root)

No build step is required.

## Wallets
- MetaMask uses the injected Ethereum provider.
- Robinhood Wallet uses the injected provider inside Robinhood Wallet's Web3 browser.
- For desktop Robinhood Wallet connection, add a Reown/WalletConnect project ID to `config.js`.

## Ethereum configuration
Edit `config.js`:
- `apiBase`
- `walletConnectProjectId`
- `tokenAddress`

The frontend expects Ethereum holder endpoints at `/v1/public/holder/challenge` and `/v1/public/holder/verify` using `personal_sign`.
