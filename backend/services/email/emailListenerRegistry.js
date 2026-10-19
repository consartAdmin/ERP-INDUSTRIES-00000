// ╔══════════════════════════════════════════════════════════════════╗
// ║ emailListenerRegistry.js — IMAP Listener Locks                    ║
// ║ CONSART ERP                                                      ║
// ║                                                                  ║
// ║ ✅ Evita múltiplos listeners por account_id                       ║
// ║ ✅ Guarda meta p/ health (startedAt/state/lastError)              ║
// ╚══════════════════════════════════════════════════════════════════╝

const activeListeners = new Map();

/**
 * Tenta registrar um listener para uma conta
 * @returns {boolean} true se lock adquirido
 */
export function acquireListenerLock(accountId) {
  const key = String(accountId);

  if (activeListeners.has(key)) {
    return false;
  }

  activeListeners.set(key, {
    startedAt: new Date(),
    state: 'running',
    lastError: null,
  });

  return true;
}

/**
 * Atualiza meta do listener (health)
 */
export function updateListenerMeta(accountId, patch = {}) {
  const key = String(accountId);
  const cur = activeListeners.get(key);
  if (!cur) return false;

  activeListeners.set(key, {
    ...cur,
    ...patch,
  });

  return true;
}

/**
 * Libera o lock (ex: erro fatal, shutdown)
 */
export function releaseListenerLock(accountId) {
  const key = String(accountId);
  activeListeners.delete(key);
}

/**
 * Debug / health
 */
export function listActiveListeners() {
  return Array.from(activeListeners.entries()).map(([accountId, meta]) => ({
    accountId,
    startedAt: meta.startedAt,
    state: meta.state || 'unknown',
    lastError: meta.lastError || null,
  }));
}

/**
 * Health de uma conta específica
 */
export function getListenerMeta(accountId) {
  const key = String(accountId);
  return activeListeners.get(key) || null;
}
