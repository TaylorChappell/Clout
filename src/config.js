export const API_URL = (
  import.meta.env.VITE_CLOUT_API_URL ||
  "https://cloutstudiosserver-production.up.railway.app"
).replace(/\/$/, "");

export const CLOUT_GAME_URL = import.meta.env.VITE_CLOUT_GAME_URL || "";
export const CLOUT_GROUP_URL = import.meta.env.VITE_CLOUT_GROUP_URL || "";
export const CLOUT_TOKEN_CA = import.meta.env.VITE_CLOUT_TOKEN_CA || "";
export const HOLDER_STORAGE_KEY = "clout_holder_session";
