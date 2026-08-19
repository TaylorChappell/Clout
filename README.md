# CLOUT Studios — GitHub Pages frontend

This is the restored static frontend for the CLOUT Studios public site. It intentionally uses plain HTML/CSS/JavaScript so GitHub Pages can publish it directly from `main / (root)` without Vite or an Actions build.

## GitHub Pages

1. Replace the current repository contents with the contents of this folder.
2. GitHub → Settings → Pages.
3. Source: **Deploy from a branch**.
4. Branch: **main**.
5. Folder: **/(root)**.
6. Save and wait for the Pages deployment.

The public URL for the repository `TaylorChappell/Clout` is expected to be:

`https://taylorchappell.github.io/Clout/`

All asset links are relative (`./styles.css`, `./app.js`) so the `/Clout/` repository base path works correctly.

## Railway CORS — required

The holder frontend calls the Railway backend directly from the browser. `FRONTEND_ORIGIN` on Railway must include the GitHub Pages origin.

Example:

`FRONTEND_ORIGIN=https://clout-studios.taylorchappell02.chatgpt.site,https://taylorchappell.github.io`

The backend patch supports comma-separated allowed origins.

## Wallet login flow

- Phantom connect
- POST `/v1/public/holder/challenge`
- Phantom `signMessage`
- POST `/v1/public/holder/verify`
<<<<<<< HEAD
- save the opaque backend `sessionToken`
- refresh restores with GET `/v1/public/holder/session`
- dashboard uses GET `/v1/public/holder/dashboard`
- logout revokes the backend session

Website authentication is intentionally independent from Phantom's transient extension connection state.

## Optional URLs

`app.js` currently has blank `GAME_URL` and `GROUP_URL` constants because the exact URLs were not present in the recovered source. Put the actual URLs into those constants when available.
=======
- GET `/v1/public/holder/session`
- GET `/v1/public/holder/dashboard`
>>>>>>> 04c5ec9a571940c45433007ada8cd25eb21ec3f1
