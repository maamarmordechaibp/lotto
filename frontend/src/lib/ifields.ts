// ============================================================
// lib/ifields.ts — Sola (Cardknox) iFields loader + token helper.
//
// iFields renders the card number + CVV inside cross-origin iframes,
// so raw PAN/CVV never touch our page or server. getTokens() swaps the
// entered card data for single-use tokens (SUT) written into hidden
// inputs, which we then send to the backend as xCardNum / xCVV.
//
// Requires two PUBLIC values (safe for the browser):
//   VITE_SOLA_IFIELDS_KEY      — the iFields (public) key from Sola
//   VITE_SOLA_IFIELDS_VERSION  — iFields version (see cdn versions page)
// ============================================================

const VERSION = (import.meta.env.VITE_SOLA_IFIELDS_VERSION as string) || "3.5.2607.1401";
const IFIELDS_KEY = import.meta.env.VITE_SOLA_IFIELDS_KEY as string | undefined;

export const IFIELDS_VERSION = VERSION;
export const IFIELD_SRC = `https://cdn.cardknox.com/ifields/${VERSION}/ifield.htm`;

declare global {
  interface Window {
    setAccount?: (key: string, softwareName: string, softwareVersion: string) => void;
    getTokens?: (onSuccess: () => void, onError: () => void, timeout?: number) => void;
    enableAutoFormatting?: (separator?: string) => void;
  }
}

let loadPromise: Promise<void> | null = null;

/** Inject the iFields script once and initialize the account. */
export function loadIfields(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    if (!IFIELDS_KEY) {
      reject(new Error("Missing VITE_SOLA_IFIELDS_KEY"));
      return;
    }
    if (window.setAccount) {
      window.setAccount(IFIELDS_KEY, "VoiceFirstLottery", "2.0.0");
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://cdn.cardknox.com/ifields/${VERSION}/ifields.min.js`;
    script.async = true;
    script.onload = () => {
      try {
        window.setAccount?.(IFIELDS_KEY, "VoiceFirstLottery", "2.0.0");
        window.enableAutoFormatting?.(" ");
        resolve();
      } catch (err) {
        reject(err as Error);
      }
    };
    script.onerror = () => reject(new Error("Failed to load iFields script"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Resolve single-use tokens for the card + CVV iframes. */
export function getIfieldTokens(timeoutMs = 30000): Promise<{ cardToken: string; cvvToken: string }> {
  return new Promise((resolve, reject) => {
    if (!window.getTokens) {
      reject(new Error("iFields not initialized"));
      return;
    }
    window.getTokens(
      () => {
        const card = document.querySelector<HTMLInputElement>('[data-ifields-id="card-number-token"]');
        const cvv = document.querySelector<HTMLInputElement>('[data-ifields-id="cvv-token"]');
        resolve({ cardToken: card?.value ?? "", cvvToken: cvv?.value ?? "" });
      },
      () => reject(new Error("Could not tokenize card. Check the card details.")),
      timeoutMs,
    );
  });
}

export const IFIELDS_CONFIGURED = Boolean(IFIELDS_KEY);
