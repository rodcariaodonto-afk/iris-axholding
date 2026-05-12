/**
 * Active account state — single source of truth for the current tenant.
 * Synchronously readable so it can be used inside `.insert()` payloads
 * without forcing every call site into a hook.
 */

const STORAGE_KEY = "iris.activeAccountId";

let activeAccountId: string | null = null;

// Hydrate from localStorage on module load
try {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored) activeAccountId = stored;
} catch {
  // SSR / private mode safe
}

export function getActiveAccountId(): string | null {
  return activeAccountId;
}

export function setActiveAccountId(id: string | null) {
  activeAccountId = id;
  try {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Throws if no account is selected. Use inside mutations that require tenancy.
 */
export function requireActiveAccountId(): string {
  if (!activeAccountId) {
    throw new Error("Nenhuma conta ativa selecionada. Recarregue a página.");
  }
  return activeAccountId;
}
