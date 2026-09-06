# CLOUT Studios frontend

The current CLOUT Studios website, packaged as a static Vite/React frontend for GitHub Pages.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

The production Railway API is used by default. To use another backend, copy `.env.example` to `.env.local` and change `VITE_BACKEND_API_URL`.

## Deploy to GitHub Pages

1. Create a GitHub repository and upload every file in this folder.
2. In the repository, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to the `main` branch, or run the **Deploy CLOUT Studios to GitHub Pages** workflow manually.

The included workflow detects the repository subpath automatically, builds the static site and publishes it to GitHub Pages. The `/admin`, `/terms` and `/privacy` routes are included in the export.

## Railway CORS setting

The frontend talks directly to the Railway backend. Set the backend's `FRONTEND_ORIGIN` to the GitHub Pages origin, without the repository path or a trailing slash:

```env
FRONTEND_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
```

For a custom domain, use that domain instead. The backend currently accepts one frontend origin, so changing this value from the ChatGPT Site origin will make the GitHub Pages deployment the active frontend.

## Commands

```bash
npm run build
npm run lint
npm test
```

The static production output is written to `dist`.
