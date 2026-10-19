// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsModal.js — Modal de contas de e-mail                  ║
// ║ CREATE / EDIT para SMTP/IMAP — layout padrão CONSART               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const MODAL_ID = 'emailAccountsModalLayerConsart';

function ensureModal() {
    let layer = document.getElementById(MODAL_ID);
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = MODAL_ID;
    layer.className = 'modal modal-width-5 modal-height-5';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
      <div class="modal__backdrop" data-modal-close></div>

      <div class="modal__dialog">
        <section class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="emailAccountsModalTitle">
          <header class="modal__header modal-header-color-3">
            <div>
              <h3 id="emailAccountsModalTitle">Nova conta de e-mail</h3>
              <small>Cadastro e edição de contas SMTP/IMAP</small>
            </div>

            <div class="email-accounts-modal-header-actions">
              <span id="emailAccountsModalBadge" class="email-accounts-modal-badge is-create">CREATE</span>
              <button type="button" id="emailAccountsModalClose" data-modal-close
                class="btn btn-new btn-sm btn-icon" aria-label="Fechar" title="Fechar">✕</button>
            </div>
          </header>

          <div class="modal__body">
            <div id="emailAccountsModalFeedback" class="email-accounts-modal-feedback" hidden></div>

            <form id="emailAccountsModalForm" novalidate>
              <input type="hidden" id="emailAccountsModalAccountId">

              <h4 class="email-accounts-modal-section-title">Dados principais</h4>
              <div class="fields-inline fields-gap-2">
                <div class="fields fields-w-15 fields-h-5 fields-p-left-10">
                  <label for="emailAccountsModalLabel">Rótulo / Nome</label>
                  <input id="emailAccountsModalLabel" name="label" type="text" maxlength="120" required>
                  <small class="email-accounts-modal-error" data-error-for="label"></small>
                </div>
                <div class="fields fields-w-15 fields-h-5">
                  <label for="emailAccountsModalEmail">E-mail</label>
                  <input id="emailAccountsModalEmail" name="email_address" type="email" maxlength="180" required>
                  <small class="email-accounts-modal-error" data-error-for="email_address"></small>
                </div>
                <div class="fields fields-w-12 fields-h-5">
                  <label for="emailAccountsModalProvider">Provider</label>
                  <select id="emailAccountsModalProvider" name="provider">
                    <option value="custom" selected>custom</option>
                    <option value="gmail">gmail</option>
                    <option value="outlook">outlook</option>
                    <option value="hostinger">hostinger</option>
                    <option value="zoho">zoho</option>
                    <option value="office365">office365</option>
                  </select>
                </div>
              </div>

              <h4 class="email-accounts-modal-section-title">SMTP</h4>
              <div class="fields-inline fields-gap-2">
                <div class="fields fields-w-12 fields-h-5 fields-p-left-10">
                  <label for="emailAccountsModalSmtpHost">SMTP Host</label>
                  <input id="emailAccountsModalSmtpHost" name="smtp_host" type="text" maxlength="180" required>
                  <small class="email-accounts-modal-error" data-error-for="smtp_host"></small>
                </div>
                <div class="fields fields-w-8 fields-h-5">
                  <label for="emailAccountsModalSmtpPort">Porta</label>
                  <input id="emailAccountsModalSmtpPort" name="smtp_port" type="number" min="1" step="1" value="587" required>
                  <small class="email-accounts-modal-error" data-error-for="smtp_port"></small>
                </div>
                <div class="fields fields-w-12 fields-h-5">
                  <label for="emailAccountsModalSmtpUser">SMTP Usuário</label>
                  <input id="emailAccountsModalSmtpUser" name="smtp_user" type="text" maxlength="180" required>
                  <small class="email-accounts-modal-error" data-error-for="smtp_user"></small>
                </div>
                <div class="fields fields-w-14 fields-h-5">
                  <label for="emailAccountsModalSmtpPass">SMTP Senha</label>
                  <input id="emailAccountsModalSmtpPass" name="smtp_pass" type="password" maxlength="255">
                  <small class="email-accounts-modal-error" data-error-for="smtp_pass"></small>
                </div>
              </div>
              <div class="fields-inline fields-gap-2 email-accounts-modal-options">
                <label class="email-accounts-modal-check fields-p-left-10">
                  <input id="emailAccountsModalSmtpSecure" name="smtp_secure" type="checkbox">
                  <span>SMTP seguro (SSL/TLS)</span>
                </label>
                <label class="email-accounts-modal-check">
                  <input id="emailAccountsModalIsActive" name="is_active" type="checkbox" checked>
                  <span>Conta ativa</span>
                </label>
                <small class="email-accounts-modal-hint">Em edição, informe a senha somente para alterá-la.</small>
              </div>

              <h4 class="email-accounts-modal-section-title">IMAP</h4>
              <div class="fields-inline fields-gap-2">
                <div class="fields fields-w-12 fields-h-5 fields-p-left-10">
                  <label for="emailAccountsModalImapHost">IMAP Host</label>
                  <input id="emailAccountsModalImapHost" name="imap_host" type="text" maxlength="180">
                </div>
                <div class="fields fields-w-8 fields-h-5">
                  <label for="emailAccountsModalImapPort">Porta</label>
                  <input id="emailAccountsModalImapPort" name="imap_port" type="number" min="1" step="1" placeholder="993">
                </div>
                <div class="fields fields-w-12 fields-h-5">
                  <label for="emailAccountsModalImapUser">IMAP Usuário</label>
                  <input id="emailAccountsModalImapUser" name="imap_user" type="text" maxlength="180">
                </div>
                <div class="fields fields-w-14 fields-h-5">
                  <label for="emailAccountsModalImapPass">IMAP Senha</label>
                  <input id="emailAccountsModalImapPass" name="imap_pass" type="password" maxlength="255">
                </div>
              </div>
              <div class="fields-inline fields-gap-2 email-accounts-modal-options">
                <label class="email-accounts-modal-check fields-p-left-10">
                  <input id="emailAccountsModalImapSecure" name="imap_secure" type="checkbox" checked>
                  <span>IMAP seguro (SSL/TLS)</span>
                </label>
                <small class="email-accounts-modal-hint">Em edição, informe a senha somente para alterá-la.</small>
              </div>
            </form>
          </div>

          <footer class="modal__footer modal-footer-color-3">
            <span class="email-accounts-modal-footer-note">Preencha os dados conforme seu provedor.</span>
            <div class="email-accounts-modal-footer-actions">
              <button type="button" id="emailAccountsModalBtnClear" class="btn btn-new btn-sm">Limpar</button>
              <button type="button" id="emailAccountsModalBtnCancel" data-modal-close class="btn btn-new btn-sm">Cancelar</button>
              <button type="submit" form="emailAccountsModalForm" id="emailAccountsModalBtnSave" class="btn btn-new btn-sm">Salvar</button>
            </div>
          </footer>
        </section>
      </div>`;

    document.body.appendChild(layer);
    return layer;
}

function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function toInt(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function toBool(value, fallback = false) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return fallback;
}

export function createEmailAccountsModal(options = {}) {
    const { apiBase = '/api/email/accounts', onSaved = null } = options;
    const layer = ensureModal();
    const form = qs('#emailAccountsModalForm', layer);
    const feedback = qs('#emailAccountsModalFeedback', layer);
    const title = qs('#emailAccountsModalTitle', layer);
    const badge = qs('#emailAccountsModalBadge', layer);
    const btnClear = qs('#emailAccountsModalBtnClear', layer);
    const btnSave = qs('#emailAccountsModalBtnSave', layer);

    const fields = {
        accountId: qs('#emailAccountsModalAccountId', layer),
        label: qs('#emailAccountsModalLabel', layer),
        email_address: qs('#emailAccountsModalEmail', layer),
        provider: qs('#emailAccountsModalProvider', layer),
        smtp_host: qs('#emailAccountsModalSmtpHost', layer),
        smtp_port: qs('#emailAccountsModalSmtpPort', layer),
        smtp_secure: qs('#emailAccountsModalSmtpSecure', layer),
        smtp_user: qs('#emailAccountsModalSmtpUser', layer),
        smtp_pass: qs('#emailAccountsModalSmtpPass', layer),
        imap_host: qs('#emailAccountsModalImapHost', layer),
        imap_port: qs('#emailAccountsModalImapPort', layer),
        imap_secure: qs('#emailAccountsModalImapSecure', layer),
        imap_user: qs('#emailAccountsModalImapUser', layer),
        imap_pass: qs('#emailAccountsModalImapPass', layer),
        is_active: qs('#emailAccountsModalIsActive', layer),
    };
    const state = { mode: 'create', saving: false };

    function show() {
        layer.classList.add('is-open');
        layer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }
    function hide() {
        layer.classList.remove('is-open');
        layer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }
    function clearFeedback() {
        feedback.hidden = true;
        feedback.className = 'email-accounts-modal-feedback';
        feedback.textContent = '';
    }
    function showFeedback(message, type = 'info') {
        feedback.hidden = false;
        feedback.className = `email-accounts-modal-feedback ${type}`;
        feedback.textContent = message;
    }
    function clearErrors() {
        qsa('.email-accounts-modal-error[data-error-for]', layer).forEach((el) => { el.textContent = ''; });
    }
    function setFieldError(fieldName, message) {
        const el = qs(`.email-accounts-modal-error[data-error-for="${fieldName}"]`, layer);
        if (el) el.textContent = message || '';
    }
    function setMode(mode) {
        state.mode = mode === 'edit' ? 'edit' : 'create';
        const isEdit = state.mode === 'edit';
        title.textContent = isEdit ? 'Editar conta de e-mail' : 'Nova conta de e-mail';
        badge.textContent = isEdit ? 'EDIT' : 'CREATE';
        badge.className = `email-accounts-modal-badge ${isEdit ? 'is-edit' : 'is-create'}`;
    }
    function resetForm() {
        form.reset();
        fields.accountId.value = '';
        fields.provider.value = 'custom';
        fields.smtp_port.value = 587;
        fields.smtp_secure.checked = false;
        fields.imap_secure.checked = true;
        fields.is_active.checked = true;
        clearErrors();
    }
    function fillForm(account = {}) {
        const data = account?.row && typeof account.row === 'object' ? account.row : account;
        fields.accountId.value = data.id ?? '';
        fields.label.value = data.label ?? '';
        fields.email_address.value = data.email_address ?? data.email ?? '';
        fields.provider.value = data.provider ?? 'custom';
        fields.smtp_host.value = data.smtp_host ?? '';
        fields.smtp_port.value = data.smtp_port ?? 587;
        fields.smtp_secure.checked = toBool(data.smtp_secure, false);
        fields.smtp_user.value = data.smtp_user ?? '';
        fields.smtp_pass.value = '';
        fields.imap_host.value = data.imap_host ?? '';
        fields.imap_port.value = data.imap_port ?? '';
        fields.imap_secure.checked = toBool(data.imap_secure, true);
        fields.imap_user.value = data.imap_user ?? '';
        fields.imap_pass.value = '';
        fields.is_active.checked = toBool(data.is_active, true);
    }
    function serializeForm() {
        return {
            label: fields.label.value.trim(),
            email_address: fields.email_address.value.trim(),
            provider: fields.provider.value.trim() || 'custom',
            smtp_host: fields.smtp_host.value.trim(),
            smtp_port: toInt(fields.smtp_port.value, 587),
            smtp_secure: fields.smtp_secure.checked,
            smtp_user: fields.smtp_user.value.trim(),
            smtp_pass: fields.smtp_pass.value,
            imap_host: fields.imap_host.value.trim() || null,
            imap_port: fields.imap_port.value === '' ? null : toInt(fields.imap_port.value),
            imap_secure: fields.imap_secure.checked,
            imap_user: fields.imap_user.value.trim() || null,
            imap_pass: fields.imap_pass.value || null,
            is_active: fields.is_active.checked,
        };
    }
    function validatePayload(payload, isEdit = false) {
        clearErrors();
        const errors = {};
        if (!payload.label) errors.label = 'Informe o rótulo da conta.';
        if (!payload.email_address) errors.email_address = 'Informe o e-mail.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email_address)) errors.email_address = 'Informe um e-mail válido.';
        if (!payload.smtp_host) errors.smtp_host = 'Informe o host SMTP.';
        if (!payload.smtp_port || payload.smtp_port <= 0) errors.smtp_port = 'Informe uma porta SMTP válida.';
        if (!payload.smtp_user) errors.smtp_user = 'Informe o usuário SMTP.';
        if (!isEdit && !payload.smtp_pass) errors.smtp_pass = 'Informe a senha SMTP no cadastro.';
        Object.entries(errors).forEach(([field, message]) => setFieldError(field, message));
        return { ok: Object.keys(errors).length === 0, errors };
    }
    async function apiFetch(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        let data = null;
        try { data = isJson ? await res.json() : await res.text(); } catch { data = null; }
        if (!res.ok) {
            const message = (data && typeof data === 'object' && (data.message || data.error)) ||
                (typeof data === 'string' && data) || `Erro HTTP ${res.status}`;
            throw new Error(message);
        }
        return data;
    }
    function extractOne(payload) {
        if (!payload) return null;
        if (payload.row && typeof payload.row === 'object') return payload.row;
        if (payload.item && typeof payload.item === 'object') return payload.item;
        if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
        return payload;
    }
    async function fetchAccountById(id, includeSecrets = false) {
        const url = `${apiBase}/${id}${includeSecrets ? '?includeSecrets=true' : ''}`;
        return extractOne(await apiFetch(url, { method: 'GET' }));
    }
    async function createAccount(payload) {
        const body = { ...payload };
        if (!body.imap_host) delete body.imap_host;
        if (body.imap_port == null) delete body.imap_port;
        if (!body.imap_user) delete body.imap_user;
        if (!body.imap_pass) delete body.imap_pass;
        return apiFetch(apiBase, { method: 'POST', body: JSON.stringify(body) });
    }
    async function updateAccount(id, payload) {
        const body = { ...payload };
        if (!body.smtp_pass) delete body.smtp_pass;
        if (!body.imap_pass) delete body.imap_pass;
        if (!body.imap_host) body.imap_host = null;
        if (body.imap_port == null || body.imap_port === '') body.imap_port = null;
        if (!body.imap_user) body.imap_user = null;
        return apiFetch(`${apiBase}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    }
    function applyProviderPreset() {
        const presets = {
            gmail: ['smtp.gmail.com', 587, false, 'imap.gmail.com', 993, true],
            outlook: ['smtp-mail.outlook.com', 587, false, 'outlook.office365.com', 993, true],
            office365: ['smtp.office365.com', 587, false, 'outlook.office365.com', 993, true],
            hostinger: ['smtp.hostinger.com', 465, true, 'imap.hostinger.com', 993, true],
            zoho: ['smtp.zoho.com', 465, true, 'imap.zoho.com', 993, true],
        };
        const cfg = presets[fields.provider.value.toLowerCase()];
        if (!cfg) return;
        if (!fields.smtp_host.value) fields.smtp_host.value = cfg[0];
        if (!fields.smtp_port.value) fields.smtp_port.value = cfg[1];
        fields.smtp_secure.checked = cfg[2];
        if (!fields.imap_host.value) fields.imap_host.value = cfg[3];
        if (!fields.imap_port.value) fields.imap_port.value = cfg[4];
        fields.imap_secure.checked = cfg[5];
    }
    async function onSubmitForm(event) {
        event.preventDefault();
        if (state.saving) return;
        const isEdit = state.mode === 'edit';
        try {
            clearFeedback();
            const payload = serializeForm();
            if (!validatePayload(payload, isEdit).ok) {
                showFeedback('Revise os campos obrigatórios do formulário.', 'error');
                return;
            }
            state.saving = true;
            btnSave.disabled = true;
            btnSave.textContent = isEdit ? 'Salvando...' : 'Cadastrando...';
            if (isEdit) {
                const id = Number(fields.accountId.value || 0);
                if (!id) throw new Error('Identificador da conta inválido.');
                await updateAccount(id, payload);
                showFeedback('Conta atualizada com sucesso.', 'success');
            } else {
                await createAccount(payload);
                showFeedback('Conta cadastrada com sucesso.', 'success');
            }
            if (typeof onSaved === 'function') await onSaved();
            setTimeout(close, 300);
        } catch (err) {
            console.error('[emailAccountsModal] submit error:', err);
            showFeedback(`Erro ao salvar conta: ${err.message}`, 'error');
        } finally {
            state.saving = false;
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar';
        }
    }
    function openCreate() {
        setMode('create'); resetForm(); clearFeedback(); show();
        setTimeout(() => fields.label.focus(), 40);
    }
    async function openEdit(id) {
        setMode('edit'); resetForm(); clearFeedback(); show();
        showFeedback('Carregando conta para edição...', 'info');
        try {
            const account = await fetchAccountById(id, true);
            if (!account || typeof account !== 'object') throw new Error('Conta não encontrada.');
            fillForm(account); clearFeedback();
            setTimeout(() => fields.label.focus(), 40);
        } catch (err) {
            console.error('[emailAccountsModal] openEdit error:', err);
            showFeedback(`Erro ao carregar conta: ${err.message}`, 'error');
        }
    }
    function close() {
        if (state.saving) return;
        clearFeedback(); clearErrors(); hide();
    }

    layer.addEventListener('click', (event) => {
        if (event.target.closest('[data-modal-close]')) close();
    });
    btnClear.addEventListener('click', () => {
        if (state.mode === 'edit') {
            fields.smtp_pass.value = '';
            fields.imap_pass.value = '';
            clearErrors(); clearFeedback();
        } else {
            resetForm(); clearFeedback();
        }
    });
    fields.provider.addEventListener('change', applyProviderPreset);
    form.addEventListener('submit', onSubmitForm);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && layer.classList.contains('is-open')) close();
    });

    return { openCreate, openEdit, close };
}