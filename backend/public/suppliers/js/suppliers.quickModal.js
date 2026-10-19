/* ╔═══════════════════════════════════════════════════════════════════╗
   ║ suppliersModal.js — Modal de Cadastro Rápido de Fornecedor        ║
   ║ PRODNEX ERP — Usado no módulo de Inbound (NF-e Entrada)           ║
   ║ ✅ Usa suppliersModal.css                                         ║
   ║ ✅ Endereço organizado                                            ║
   ║ ✅ Novos campos: website, login, password, observations           ║
   ║ ✅ ESC / clique fora / botão X / cancelar                         ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
import sefazApi from './suppliers.sefazApi.js';

const MODAL_STACK_KEY = '__consartModalStack__';
const MODAL_CSS_ID = 'suppliers-modal-css-runtime';

function getStack() {
  if (!window[MODAL_STACK_KEY]) window[MODAL_STACK_KEY] = [];
  return window[MODAL_STACK_KEY];
}

function ensureSuppliersModalCss() {
  if (document.getElementById(MODAL_CSS_ID)) return;

  const hrefCandidates = [
    './suppliersModal.css',
    'suppliersModal.css',
    '/suppliers/suppliersModal.css',
    '/public/suppliers/suppliersModal.css',
  ];

  const link = document.createElement('link');
  link.id = MODAL_CSS_ID;
  link.rel = 'stylesheet';
  link.href = hrefCandidates[0];
  document.head.appendChild(link);

  let index = 1;
  link.onerror = () => {
    if (index >= hrefCandidates.length) return;
    link.href = hrefCandidates[index++];
  };
}

function cleanValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function buildLegacyAddress(data = {}) {
  const parts = [
    cleanValue(data.address_street),
    cleanValue(data.address_number),
    cleanValue(data.address_complement),
    cleanValue(data.address_district),
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function getApiBase() {
  const base = (window.API_BASE || '').replace(/\/$/, '');
  return `${base}/api/suppliers`;
}

function setButtonLoading(btn, isLoading, loadingText = 'Salvando...') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function openSuppliersModal(options = {}) {
  ensureSuppliersModalCss();

  return new Promise((resolve) => {
    const preset = options.preset || {};
    const title = options.title || 'Cadastrar Fornecedor';
    const subtitle =
      options.subtitle ||
      'Informe os dados do fornecedor para continuar a importação da NF-e.';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog modal-dialog--supplier';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'suppliersQuickModalTitle');
    modal.addEventListener('click', (ev) => ev.stopPropagation());

    modal.innerHTML = `
  <div class="modal-header">
    <div>
      <h2 id="suppliersQuickModalTitle">${escapeHtml(title)}</h2>
      <p class="modal-subtitle">${escapeHtml(subtitle)}</p>
    </div>

    <button
      type="button"
      class="btn btn-toolbar btn-sm"
      id="btnCloseX"
      aria-label="Fechar modal"
      title="Fechar"
    >✕</button>
  </div>

  <div class="modal-body">
    <section class="modal-section">
      <h3 class="section-title">Dados principais</h3>

      <div class="form-grid form-grid--12">
        <div class="form-group span-4">
          <label for="supTaxId">CNPJ/CPF</label>
          <input
            id="supTaxId"
            type="text"
            placeholder="Apenas números"
            value="${escapeHtml(preset.tax_id || '')}"
          />
        </div>

        <div class="form-group span-12">
          <label for="supName">Nome / Razão Social</label>
          <input
            id="supName"
            type="text"
            placeholder="Nome do fornecedor"
            value="${escapeHtml(preset.name || '')}"
          />
        </div>

        <div class="form-group span-4">
          <label for="supPhone">Telefone</label>
          <input
            id="supPhone"
            type="text"
            placeholder="(XX) XXXXX-XXXX"
            value="${escapeHtml(preset.phone || '')}"
          />
        </div>

        <div class="form-group span-4">
          <label for="supEmail">E-mail</label>
          <input
            id="supEmail"
            type="email"
            placeholder="email@fornecedor.com"
            value="${escapeHtml(preset.email || '')}"
          />
        </div>

        <div class="form-group span-4">
          <label for="supWebsite">Website</label>
          <input
            id="supWebsite"
            type="text"
            placeholder="https://..."
            value="${escapeHtml(preset.website || '')}"
          />
        </div>
      </div>
    </section>

    <section class="modal-section">
      <h3 class="section-title">Credenciais</h3>

      <div class="form-grid form-grid--12">
        <div class="form-group span-6">
          <label for="supLogin">Login</label>
          <input
            id="supLogin"
            type="text"
            placeholder="Usuário / login"
            value="${escapeHtml(preset.login || '')}"
          />
        </div>

        <div class="form-group span-6">
          <label for="supPassword">Password</label>
          <input
            id="supPassword"
            type="text"
            placeholder="Senha"
            value="${escapeHtml(preset.password || '')}"
          />
        </div>
      </div>
    </section>

    <section class="modal-section">
      <h3 class="section-title">Endereço</h3>

      <div class="address-grid">
        <div class="form-group addr-cep">
          <label for="supPostalCode">CEP</label>
          <input
            id="supPostalCode"
            type="text"
            placeholder="00000-000"
            value="${escapeHtml(preset.postal_code || '')}"
          />
        </div>

        <div class="form-group addr-street">
          <label for="supAddressStreet">Rua</label>
          <input
            id="supAddressStreet"
            type="text"
            placeholder="Rua / Avenida"
            value="${escapeHtml(preset.address_street || preset.address || '')}"
          />
        </div>

        <div class="form-group addr-number">
          <label for="supAddressNumber">Número</label>
          <input
            id="supAddressNumber"
            type="text"
            placeholder="Nº"
            value="${escapeHtml(preset.address_number || '')}"
          />
        </div>

        <div class="form-group addr-complement">
          <label for="supAddressComplement">Complemento</label>
          <input
            id="supAddressComplement"
            type="text"
            placeholder="Complemento"
            value="${escapeHtml(preset.address_complement || '')}"
          />
        </div>

        <div class="form-group addr-district">
          <label for="supAddressDistrict">Bairro</label>
          <input
            id="supAddressDistrict"
            type="text"
            placeholder="Bairro"
            value="${escapeHtml(preset.address_district || '')}"
          />
        </div>

        <div class="form-group addr-city">
          <label for="supCity">Cidade</label>
          <input
            id="supCity"
            type="text"
            placeholder="Cidade"
            value="${escapeHtml(preset.city || '')}"
          />
        </div>

        <div class="form-group addr-state">
          <label for="supState">UF</label>
          <input
            id="supState"
            type="text"
            maxlength="2"
            placeholder="UF"
            value="${escapeHtml(preset.state || '')}"
          />
        </div>
      </div>
    </section>

    <section class="modal-section">
      <h3 class="section-title">Observações</h3>

      <div class="form-grid form-grid--12">
        <div class="form-group span-12">
          <label for="supObservations">Observações</label>
          <textarea
            id="supObservations"
            rows="4"
            placeholder="Anotações internas..."
          >${escapeHtml(preset.observations || '')}</textarea>
        </div>
      </div>
    </section>
  </div>

  <div class="modal-footer">
    <button
      type="button"
      class="btn btn-toolbar btn-sm"
      id="btnCancel"
    >Cancelar</button>

    <button
      type="button"
      class="btn btn-toolbar btn-sm"
      id="btnSave"
    >Salvar Fornecedor</button>
  </div>
`;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const stack = getStack();
    const stackToken = { backdrop, resolve };
    stack.push(stackToken);

    let closed = false;

    function isTopMost() {
      const s = getStack();
      return s.length > 0 && s[s.length - 1] === stackToken;
    }

    function removeFromStack() {
      const s = getStack();
      const idx = s.indexOf(stackToken);
      if (idx >= 0) s.splice(idx, 1);
    }

    function removeKeyListeners() {
      window.removeEventListener('keydown', onEsc, true);
      document.removeEventListener('keydown', onEsc, true);
    }

    function closeModal(result) {
      if (closed) return;
      closed = true;

      removeFromStack();
      removeKeyListeners();

      if (backdrop?.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }

      resolve(result);
    }

    function onEsc(ev) {
      const key = ev.key || ev.code || '';
      const isEsc = key === 'Escape' || key === 'Esc' || key === '27';
      if (!isEsc) return;
      if (!isTopMost()) return;
      if (!backdrop?.isConnected) return;

      ev.preventDefault();
      ev.stopPropagation();
      closeModal(false);
    }

    window.addEventListener('keydown', onEsc, true);
    document.addEventListener('keydown', onEsc, true);

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) {
        closeModal(false);
      }
    });

    const btnCloseX = modal.querySelector('#btnCloseX');
    const btnCancel = modal.querySelector('#btnCancel');
    const btnSave = modal.querySelector('#btnSave');

    const fldTaxId = modal.querySelector('#supTaxId');
    const fldName = modal.querySelector('#supName');
    const fldStateRegistration = modal.querySelector('#supStateRegistration');
    const fldPhone = modal.querySelector('#supPhone');
    const fldEmail = modal.querySelector('#supEmail');
    const fldWebsite = modal.querySelector('#supWebsite');
    const fldLogin = modal.querySelector('#supLogin');
    const fldPassword = modal.querySelector('#supPassword');
    const fldPostalCode = modal.querySelector('#supPostalCode');
    const fldStreet = modal.querySelector('#supAddressStreet');
    const fldNumber = modal.querySelector('#supAddressNumber');
    const fldComplement = modal.querySelector('#supAddressComplement');
    const fldDistrict = modal.querySelector('#supAddressDistrict');
    const fldCity = modal.querySelector('#supCity');
    const fldState = modal.querySelector('#supState');
    const fldObservations = modal.querySelector('#supObservations');

    let lastCnpjConsulted = '';
    let cnpjLookupTimer = null;

    function setFieldValue(field, value, { overwrite = false } = {}) {
      if (!field) return;
      if (value === undefined || value === null || value === '') return;

      // Evita sobrescrever algo que o usuário já digitou.
      if (!overwrite && String(field.value || '').trim()) return;

      field.value = String(value);
    }

    function formatCep(value) {
      const digits = onlyDigits(value);

      if (digits.length !== 8) {
        return value || '';
      }

      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }

    function formatCnpj(value) {
      const digits = onlyDigits(value).slice(0, 14);

      if (digits.length <= 2) {
        return digits;
      }

      if (digits.length <= 5) {
        return `${digits.slice(0, 2)}.${digits.slice(2)}`;
      }

      if (digits.length <= 8) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
      }

      if (digits.length <= 12) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
      }

      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
    }

    async function lookupSupplierByCnpj() {
      const cnpj = onlyDigits(fldTaxId?.value);

      // CPF ainda não entra nessa consulta.
      if (cnpj.length !== 14) {
        return;
      }

      // Evita consultar repetidamente o mesmo CNPJ.
      if (cnpj === lastCnpjConsulted) {
        return;
      }

      lastCnpjConsulted = cnpj;

      try {
        fldTaxId.disabled = true;

        const cadastro = await sefazApi.searchSefazByCnpj({
          cnpj,
          uf: null,
        });

        if (!cadastro) {
          return;
        }

        const supplierName =
          cadastro.razao_social ||
          cadastro.nome ||
          cadastro.fantasia ||
          null;

        setFieldValue(fldName, supplierName);
        setFieldValue(fldPhone, cadastro.telefone);
        setFieldValue(fldEmail, cadastro.email);

        setFieldValue(
          fldPostalCode,
          cadastro.cep ? formatCep(cadastro.cep) : null
        );

        setFieldValue(fldStreet, cadastro.logradouro_completo || cadastro.logradouro);
        setFieldValue(fldNumber, cadastro.numero);
        setFieldValue(fldComplement, cadastro.complemento);
        setFieldValue(fldDistrict, cadastro.bairro);
        setFieldValue(fldCity, cadastro.municipio);

        if (cadastro.uf && fldState && !fldState.value.trim()) {
          fldState.value = String(cadastro.uf)
            .toUpperCase()
            .slice(0, 2);
        }

        console.log(
          '[suppliersModal] Cadastro encontrado:',
          cadastro
        );
      } catch (err) {
        console.warn(
          '[suppliersModal] CNPJ não localizado:',
          err?.message || err
        );

        // Não bloqueia o cadastro manual.
        // O usuário continua podendo preencher normalmente.
      } finally {
        fldTaxId.disabled = false;
      }
    }

    fldTaxId?.addEventListener('input', () => {
      const digits = onlyDigits(fldTaxId.value);

      fldTaxId.value = formatCnpj(digits);

      if (digits.length !== 14) {
        lastCnpjConsulted = '';
      }

      clearTimeout(cnpjLookupTimer);

      if (digits.length === 14) {
        cnpjLookupTimer = setTimeout(() => {
          lookupSupplierByCnpj();
        }, 350);
      }
    });

    fldTaxId?.addEventListener('blur', () => {
      const digits = onlyDigits(fldTaxId.value);

      if (digits.length === 14) {
        lookupSupplierByCnpj();
      }
    });

    fldState?.addEventListener('input', () => {
      fldState.value = String(fldState.value || '').toUpperCase().slice(0, 2);
    });

    btnCloseX.onclick = () => closeModal(false);
    btnCancel.onclick = () => closeModal(false);

    btnSave.onclick = async () => {
      const payload = {
        tax_id: onlyDigits(fldTaxId.value) || null,
        name: cleanValue(fldName.value),

        state_registration:
          cleanValue(fldStateRegistration?.value),

        phone: cleanValue(fldPhone.value),
        email: cleanValue(fldEmail.value),
        website: cleanValue(fldWebsite.value),
        login: cleanValue(fldLogin.value),
        password: cleanValue(fldPassword.value),

        postal_code: cleanValue(fldPostalCode.value),
        address_street: cleanValue(fldStreet.value),
        address_number: cleanValue(fldNumber.value),
        address_complement: cleanValue(fldComplement.value),
        address_district: cleanValue(fldDistrict.value),
        city: cleanValue(fldCity.value),

        state:
          cleanValue(fldState.value)
            ?.toUpperCase()
            .slice(0, 2) || null,

        observations:
          cleanValue(fldObservations.value),
      };

      payload.address = buildLegacyAddress(payload);

      if (!payload.tax_id) {
        alert('Informe o CNPJ/CPF do fornecedor.');
        fldTaxId.focus();
        return;
      }

      if (!payload.name) {
        alert('Informe o nome do fornecedor.');
        fldName.focus();
        return;
      }

      try {
        setButtonLoading(btnSave, true, 'Salvando...');

        const resp = await fetch(getApiBase(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let json = null;
        try {
          json = await resp.json();
        } catch {
          json = null;
        }

        if (!resp.ok || !json?.ok) {
          alert(json?.error || 'Erro ao salvar fornecedor.');
          return;
        }

        closeModal({
          ok: true,
          data: json.data,
        });
      } catch (err) {
        console.error('[suppliersModal] Erro ao cadastrar fornecedor:', err);
        alert('Falha ao cadastrar fornecedor.');
      } finally {
        setButtonLoading(btnSave, false);
      }
    };

    setTimeout(() => fldTaxId?.focus?.(), 0);
  });
}
