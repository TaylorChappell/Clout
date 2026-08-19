# Deploy checklist

1. Deploy the backend v2 first.
2. Confirm this URL returns JSON with `holderAuth: true`:
   `https://cloutstudiosserver-production.up.railway.app/v1/public/version`
3. Confirm `/v1/public/holder/session` returns HTTP 401 without a bearer token, not 404.
4. Deploy this frontend.
5. Add the deployed frontend origin to the backend `FRONTEND_ORIGINS` environment variable.
6. Connect Phantom. You should see two wallet steps: connect, then sign message.
7. After signing, the dashboard should open and `clout_holder_session` should exist in localStorage.
8. Refresh. The website should restore the backend session without reopening Phantom.
