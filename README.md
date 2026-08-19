# CLOUT Studios frontend

Complete React/Vite frontend wired to the CLOUT Railway backend.

## Important wallet auth fix

Connecting Phantom is only step one. This frontend performs the full holder authentication flow:

1. Phantom `connect()`
2. `POST /v1/public/holder/challenge`
3. Phantom `signMessage()` using the exact backend message
4. `POST /v1/public/holder/verify`
5. Store the backend `sessionToken` in `localStorage` under `clout_holder_session`
6. Load `/v1/public/holder/dashboard`
7. On page refresh, restore `/v1/public/holder/session` without reopening Phantom

If the deployed backend returns 404 for any `/v1/public/holder/*` route, the UI now explains that the Railway service does not contain the holder auth routes instead of showing a bare "Not Found" message.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment

Copy `.env.example` to `.env` when needed.

The backend defaults to:

`https://cloutstudiosserver-production.up.railway.app`

Optional variables:

- `VITE_CLOUT_GAME_URL`
- `VITE_CLOUT_GROUP_URL`
- `VITE_CLOUT_TOKEN_CA`

## Backend requirement

The deployed backend must expose:

- `GET /v1/public/version`
- `POST /v1/public/holder/challenge`
- `POST /v1/public/holder/verify`
- `GET /v1/public/holder/session`
- `GET /v1/public/holder/dashboard`
- `PATCH /v1/public/holder/preferences`
- `POST /v1/public/holder/logout`

With the backend v2 package, `/v1/public/version` should report build `holder-auth-2026-08-19-v2`.

## Current backend limitation

The backend package currently stores Roblox profile fields but does not yet expose a public Roblox username/group verification endpoint. The dashboard therefore displays an existing linked Roblox profile if one is already stored, but does not fake a linking request that the backend cannot process.
