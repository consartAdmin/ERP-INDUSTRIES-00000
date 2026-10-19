// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ emailInboxAccountRouter.js — Router de Conta (PRODNEX ERP | ESM)         ║
// ║ Lê ?account_id= da URL e aplica filtro/seleção na tela Inbox            ║
// ║ ✅ Marca chip ativo (data-account-id)                                   ║
// ║ ✅ Chama loader da inbox via window.emailInboxLoad({account_id})         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

function getParam(name) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  } catch {
    return null;
  }
}

function setActiveChip(accountId) {
  const id = String(accountId || '');

  // chips/botões devem ter data-account-id="4" etc
  const chips = document.querySelectorAll('[data-account-id]');
  chips.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-account-id') === id);
  });
}

function ensureUrlParam(accountId, paramName = 'account_id') {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set(paramName, String(accountId));
    window.history.replaceState({}, '', u.toString());
  } catch {}
}

/**
 * Espera que sua página inbox exponha:
 *   window.emailInboxLoad({ account_id })   // carrega a lista com filtro
 *
 * Se você já tem um loader interno com outro nome, basta no seu emailInbox.js:
 *   window.emailInboxLoad = ({account_id}) => loadEmails({ account_id });
 */
async function callInboxLoader(accountId) {
  if (typeof window.emailInboxLoad !== 'function') {
    console.warn(
      '[emailInboxAccountRouter] window.emailInboxLoad não está definido. ' +
      'Defina no seu emailInbox.js: window.emailInboxLoad = ({account_id}) => ...'
    );
    return;
  }

  await window.emailInboxLoad({ account_id: accountId });
}

export async function initEmailInboxAccountRouter(opts = {}) {
  const {
    paramName = 'account_id',
    defaultAccountId = null,
    allowAll = true,
  } = opts;

  // 1) pega account_id da URL
  let accountId = getParam(paramName);

  if (!accountId || !String(accountId).trim()) {
    if (defaultAccountId != null) {
      accountId = String(defaultAccountId);
      ensureUrlParam(accountId, paramName);
    } else {
      // sem param e sem default -> não faz nada
      return;
    }
  }

  // 2) ALL
  if (String(accountId).toUpperCase() === 'ALL') {
    if (!allowAll) return;
    setActiveChip('ALL');
    await callInboxLoader('ALL');
    return;
  }

  // 3) normal
  setActiveChip(accountId);
  await callInboxLoader(accountId);

  // 4) clique nos chips para trocar conta sem recarregar tudo
  // (só se os chips existirem)
  document.addEventListener('click', async (ev) => {
    const btn = ev.target?.closest?.('[data-account-id]');
    if (!btn) return;

    const next = btn.getAttribute('data-account-id');
    if (!next) return;

    ev.preventDefault();

    ensureUrlParam(next, paramName);
    setActiveChip(next);
    await callInboxLoader(next);
  });
}
