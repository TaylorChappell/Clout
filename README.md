# CLOUT Frontend - Static GitHub Pages Build

This version does not use Vite, React, npm, or a build step.

## Deploy to GitHub Pages

1. Delete the old frontend files from the `Clout` repository, especially the old Vite `index.html` and `/src` folder.
2. Upload the **contents of this folder directly to the repository root** so `index.html` is at the top level.
3. Commit/push to `main`.
4. GitHub: **Settings -> Pages**.
5. Under Build and deployment choose **Deploy from a branch**.
6. Branch: **main**. Folder: **/(root)**.
7. Save.

Your page should then load from:

`https://taylorchappell.github.io/Clout/`

The browser should request:

- `/Clout/assets/styles.css`
- `/Clout/assets/app.js`

It should never request `/src/main.jsx`.

## Important backend requirement

The frontend uses:

`https://cloutstudiosserver-production.up.railway.app`

Holder login still requires these live backend routes:

- POST `/v1/public/holder/challenge`
- POST `/v1/public/holder/verify`
- GET `/v1/public/holder/session`
- GET `/v1/public/holder/dashboard`

If `/holder/session` is still a 404, Railway is still running a backend without the holder auth routes. The static frontend will load correctly, but holder login cannot complete until the backend routes are live.
