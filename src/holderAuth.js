import {
  createHolderChallenge,
  getHolderSession,
  logoutHolder,
  verifyHolderChallenge,
} from "./api";
import { HOLDER_STORAGE_KEY } from "./config";

function phantomProvider() {
  const provider = window.phantom?.solana || window.solana;
  if (!provider?.isPhantom) return null;
  return provider;
}

export function readSavedHolderSession() {
  try {
    const raw = localStorage.getItem(HOLDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionToken || !parsed?.walletAddress) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveHolderSession(session) {
  const saved = {
    sessionToken: session.sessionToken,
    walletAddress: session.walletAddress,
    expiresAt: session.expiresAt,
  };
  localStorage.setItem(HOLDER_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function clearSavedHolderSession() {
  localStorage.removeItem(HOLDER_STORAGE_KEY);
}

export async function restoreHolderLogin() {
  const saved = readSavedHolderSession();
  if (!saved) return null;

  try {
    const session = await getHolderSession(saved.sessionToken);
    const refreshed = {
      sessionToken: saved.sessionToken,
      walletAddress: session.walletAddress,
      expiresAt: session.expiresAt,
      profile: session.profile,
    };
    saveHolderSession(refreshed);
    return refreshed;
  } catch (error) {
    if (error?.status === 401) {
      clearSavedHolderSession();
      return null;
    }
    throw error;
  }
}

export async function connectAndAuthenticateHolder() {
  const provider = phantomProvider();
  if (!provider) {
    throw new Error("Phantom is not installed. Install or enable Phantom, then try again.");
  }

  const connected = await provider.connect();
  const publicKey = connected?.publicKey || provider.publicKey;
  if (!publicKey) throw new Error("Phantom connected without returning a public key.");
  const walletAddress = publicKey.toString();

  // Connecting Phantom is not a CLOUT login. The backend challenge and signed
  // message below prove control of the wallet and create the website session.
  const challenge = await createHolderChallenge(walletAddress);
  if (!challenge?.challengeId || !challenge?.message) {
    throw new Error("The CLOUT backend returned an invalid wallet challenge.");
  }

  const encodedMessage = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(encodedMessage, "utf8");
  const signature = signed?.signature;
  if (!signature) throw new Error("Phantom did not return a message signature.");

  const verified = await verifyHolderChallenge({
    challengeId: challenge.challengeId,
    walletAddress,
    signature: Array.from(signature),
  });

  if (!verified?.sessionToken || !verified?.walletAddress) {
    throw new Error("The CLOUT backend did not create a holder session.");
  }

  return saveHolderSession(verified);
}

export async function signOutHolder(sessionToken) {
  try {
    if (sessionToken) await logoutHolder(sessionToken);
  } finally {
    clearSavedHolderSession();
  }
}

export function watchPhantomAccountChanges(onChange) {
  const provider = phantomProvider();
  if (!provider?.on) return () => {};

  const handler = (publicKey) => {
    onChange(publicKey ? publicKey.toString() : null);
  };

  provider.on("accountChanged", handler);
  return () => {
    try {
      provider.removeListener?.("accountChanged", handler);
    } catch {
      // Extension implementations differ. The listener will be removed on unload.
    }
  };
}
