# CLOUT Studios Frontend

React + Vite frontend for the CLOUT Studios website and holder dashboard.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm install
npm run build
npm run preview
```

Vite writes the production website to `dist/`.

## GitHub Pages

The project includes `.github/workflows/deploy-pages.yml` and is configured with relative Vite asset paths so it can run from a GitHub Pages repository subdirectory or a custom domain.

In the GitHub repository, open **Settings -> Pages** and set **Source** to **GitHub Actions**. Push to `main`; the workflow builds and deploys `dist/` automatically.

See `GITHUB_PAGES.md` for the exact steps.

## CLOUT holder authentication

Connecting Phantom is only the wallet connection step. CLOUT login then performs:

1. Connect Phantom.
2. Request a backend wallet challenge.
3. Sign the challenge with Phantom.
4. Verify the signature with the backend.
5. Save the returned holder session token.
6. Restore that token on future page loads.

The session is stored in local storage under `clout_holder_session` and the dashboard sends it as a bearer token.

## Environment variables

Copy `.env.example` to `.env` for local overrides.

- `VITE_CLOUT_API_URL`
- `VITE_CLOUT_GAME_URL`
- `VITE_CLOUT_GROUP_URL`
- `VITE_CLOUT_TOKEN_CA`

The production API defaults to `https://cloutstudiosserver-production.up.railway.app`.

## Browser extension warnings

Messages such as `ObjectMultiplex`, `app-init-liveness`, `background-liveness`, and `MaxListenersExceededWarning` originating from `contentscript.js` are emitted by injected wallet/browser-extension code. They are separate from a site asset 404 such as `/src/main.jsx`.
