# GitHub Pages deployment

This project is configured to deploy through GitHub Actions.

## One-time setup

1. Push the **contents of this folder** to the root of your GitHub repository.
2. In GitHub, open **Settings -> Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to the `main` branch, or run **Deploy CLOUT to GitHub Pages** manually from the Actions tab.
5. Wait for the workflow to finish, then open the Pages URL shown by GitHub.

Do **not** configure Pages to serve the repository root or `/docs` directly. This is a Vite project and the browser must receive the generated `dist/` build, not `/src/main.jsx`.

## Why the previous deployment failed

The source `index.html` contains a Vite entry such as `/src/main.jsx`. That is valid for Vite development/build processing, but it is not a production asset on GitHub Pages. The GitHub Action runs `npm run build`, then deploys `dist/`, where Vite has replaced the source entry with hashed JavaScript/CSS files.

## Backend

The frontend still expects:

`https://cloutstudiosserver-production.up.railway.app`

You can override it at build time with `VITE_CLOUT_API_URL` if necessary.

## Routing

The CLOUT dashboard uses hash routing (`#dashboard`), so GitHub Pages does not need an SPA 404 redirect hack.
