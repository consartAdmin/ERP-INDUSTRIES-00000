// public/integrations/pluginAutosWebhook.js
// ╔══════════════════════════════════════════════════════════════╗
// ║ pluginAutosWebhook.js — Frontend Webhook (PlugNotas)        ║
// ║ PRODNEX ERP — ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

const form           = document.getElementById('webhookAutosForm');
const inputEnabled   = document.getElementById('enabled');
const inputUrl       = document.getElementById('webhookUrl');
const inputSecret    = document.getElementById('secret');
const feedbackEl     = document.getElementById('webhookFeedback');

const btnCopyUrl      = document.getElementById('btnCopyUrl');
const btnToggleSecret = document.getElementById('btnToggleSecret');
const btnTestWebhook  = document.getElementById('btnTestWebhook');
const btnReset        = document.getElementById('btnResetWebhook');
const btnRefreshLogs  = document.getElementById('btnRefreshLogs');

const statusCurrentEl    = document.getElementById('statusCurrent');
const statusLastDelivery = document.getElementById('statusLastDelivery');
const statusLastCode     = document.getElementById('statusLastCode');
const logTableBody       = document.getElementById('webhookLogTableBody');

// 🔗 Base da API usando helper global, com fallback seguro
const API_BASE = (window.getApiBase
  ? window.getApiBase()
  : 'http://localhost:8080') + '/api/integrations/plugnotas';

console.log('[WebhookPlugNotas] API_BASE =', API_BASE);

function setFeedback(message, type = 'info') {
  if (!feedbackEl) return;
  feedbackEl.textContent = message || '';
  feedbackEl.classList.remove(
    'webhook-feedback--success',
    'webhook-feedback--error',
    'webhook-feedback--info'
  );

  if (!message) return;

  const cls =
    type === 'success' ? 'webhook-feedback--success' :
    type === 'error'   ? 'webhook-feedback--error'   :
                         'webhook-feedback--info';

  feedbackEl.classList.add(cls);
}

// =====================================================================
// Carregar configuração atual
// =====================================================================
async function loadWebhookConfig() {
  try {
    setFeedback('Carregando configuração do webhook...', 'info');

    const res = await fetch(`${API_BASE}/webhook`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Erro ao carregar configuração (HTTP ${res.status})`);
    }

    const data = await res.json();

    inputEnabled.checked = !!data.enabled;
    inputUrl.value       = data.url || '';
    inputSecret.value    = ''; // Por segurança, nunca exibimos o secret real

    statusCurrentEl.textContent    = data.enabled ? 'Ativo' : 'Inativo';
    statusLastDelivery.textContent = data.lastDeliveryAt || '—';
    statusLastCode.textContent     = data.lastHttpStatus || '—';

    setFeedback('Configuração carregada.', 'success');
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro loadWebhookConfig:', err);
    setFeedback('Erro ao carregar configuração do webhook.', 'error');
  }
}

// =====================================================================
// Salvar configuração
// =====================================================================
async function saveWebhookConfig(event) {
  event.preventDefault();

  try {
    setFeedback('Salvando configuração...', 'info');

    const payload = {
      enabled: inputEnabled.checked,
      url: inputUrl.value,
      secret: inputSecret.value || null,
    };

    const res = await fetch(`${API_BASE}/webhook`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} - ${errText}`);
    }

    const data = await res.json().catch(() => null);

    if (data) {
      statusCurrentEl.textContent    = data.enabled ? 'Ativo' : 'Inativo';
      statusLastDelivery.textContent = data.lastDeliveryAt || statusLastDelivery.textContent;
      statusLastCode.textContent     = data.lastHttpStatus || statusLastCode.textContent;
    }

    inputSecret.value = '';

    setFeedback('Configuração salva com sucesso.', 'success');
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro saveWebhookConfig:', err);
    setFeedback('Erro ao salvar configuração do webhook.', 'error');
  }
}

// =====================================================================
// Testar webhook
// =====================================================================
async function testWebhook() {
  try {
    setFeedback('Enviando teste para o Webhook PlugNotas...', 'info');
    btnTestWebhook.disabled = true;

    const res = await fetch(`${API_BASE}/webhook/test`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || `Erro ao testar webhook (HTTP ${res.status})`;
      setFeedback(msg, 'error');
    } else {
      const msg = data?.message || 'Teste enviado com sucesso.';
      setFeedback(msg, 'success');
    }

    if (data?.status) {
      statusCurrentEl.textContent    = data.status.enabled ? 'Ativo' : 'Inativo';
      statusLastDelivery.textContent = data.status.lastDeliveryAt || statusLastDelivery.textContent;
      statusLastCode.textContent     = data.status.lastHttpStatus || statusLastCode.textContent;
    }

    await loadWebhookLogs();
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro testWebhook:', err);
    setFeedback('Erro ao enviar teste do webhook.', 'error');
  } finally {
    btnTestWebhook.disabled = false;
  }
}

// =====================================================================
// Carregar logs
// =====================================================================
async function loadWebhookLogs() {
  try {
    const res = await fetch(`${API_BASE}/webhook/logs`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const logs = Array.isArray(data) ? data : data.logs || [];

    logTableBody.innerHTML = '';

    if (!logs.length) {
      logTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="webhook-log__empty">
            Nenhum log encontrado.
          </td>
        </tr>
      `;
      return;
    }

    for (const log of logs) {
      const tr = document.createElement('tr');

      const dt = log.createdAt || log.timestamp || '';
      const event = [
        log.docType ? String(log.docType).toUpperCase() : null,
        log.status  ? String(log.status).toUpperCase()  : null,
      ].filter(Boolean).join(' • ') || '-';

      const code = log.status || '-';

      const msg =
        log.mensagem ||
        log.message  ||
        log.detail   ||
        (log.chave ? `Chave: ${log.chave}` : '-') ;

      tr.innerHTML = `
        <td>${dt}</td>
        <td>${event}</td>
        <td>${code}</td>
        <td>${msg}</td>
      `;

      logTableBody.appendChild(tr);
    }
  } catch (err) {
    console.error('[WebhookPlugNotas] Erro loadWebhookLogs:', err);
    logTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="webhook-log__empty">
          Erro ao carregar logs do webhook.
        </td>
      </tr>
    `;
  }
}

// =====================================================================
// Utilidades UI
// =====================================================================
function copyWebhookUrl() {
  if (!inputUrl.value) return;
  navigator.clipboard.writeText(inputUrl.value)
    .then(() => setFeedback('URL copiada para a área de transferência.', 'success'))
    .catch(() => setFeedback('Não foi possível copiar a URL.', 'error'));
}

function toggleSecretVisibility() {
  const isPassword = inputSecret.type === 'password';
  inputSecret.type = isPassword ? 'text' : 'password';
  btnToggleSecret.textContent = isPassword ? 'Ocultar' : 'Mostrar';
}

function resetConfig() {
  loadWebhookConfig();
  setFeedback('Configuração recarregada.', 'info');
}

// =====================================================================
// Bind eventos
// =====================================================================
if (form) {
  form.addEventListener('submit', saveWebhookConfig);
}
if (btnCopyUrl) {
  btnCopyUrl.addEventListener('click', copyWebhookUrl);
}
if (btnToggleSecret) {
  btnToggleSecret.addEventListener('click', toggleSecretVisibility);
}
if (btnTestWebhook) {
  btnTestWebhook.addEventListener('click', testWebhook);
}
if (btnReset) {
  btnReset.addEventListener('click', resetConfig);
}
if (btnRefreshLogs) {
  btnRefreshLogs.addEventListener('click', loadWebhookLogs);
}

// =====================================================================
// Inicialização
// =====================================================================
(async function init() {
  await loadWebhookConfig();
  await loadWebhookLogs();
})();
