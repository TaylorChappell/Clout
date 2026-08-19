# CLOUT deployment checklist

## GitHub Pages frontend

- Upload this project's files to the repository root.
- Commit `.github/workflows/deploy-pages.yml`.
- GitHub -> Settings -> Pages -> Source: **GitHub Actions**.
- Push to `main`.
- Confirm the `Deploy CLOUT to GitHub Pages` action succeeds.
- Open the Pages URL and confirm there is no `/src/main.jsx` request in DevTools.

## Railway backend

- `GET /health` should identify the holder-auth build.
- `GET /v1/public/version` should report `holderAuth: true`.
- `GET /v1/public/holder/session` without a bearer token should return `401`, not `404`.
- `POST /v1/public/holder/challenge` must exist.
- `POST /v1/public/holder/verify` must exist.

## Wallet login

Expected network flow on a fresh login:

1. Phantom connect.
2. `POST /v1/public/holder/challenge`.
3. Phantom Sign Message prompt.
4. `POST /v1/public/holder/verify`.
5. Session stored locally.
6. `GET /v1/public/holder/dashboard`.

On refresh with a stored session:

1. `GET /v1/public/holder/session`.
2. Restore dashboard/login without reconnecting Phantom.
