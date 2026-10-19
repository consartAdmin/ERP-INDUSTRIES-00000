// ╔══════════════════════════════════════════════════════════════════════╗
// ║ roletaManagement.js — Roleta Management (PRODNEX ERP)                ║
// ║ Path: public/roleta/roletaManagement.js                              ║
// ║ - Admin UI para campanhas, produtos, tokens e giros                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const API = '/api/roleta';

  // Selected campaign (global UI state)
  let selectedCampaignId = null;
  let selectedCampaignName = null;

  // Last generated link
  let lastLink = null;

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.tab).classList.add('active');
    });
  });

  // Helpers
  function toISOFromLocal(dtLocal) {
    if (!dtLocal) return null;
    // dtLocal is "YYYY-MM-DDTHH:mm"
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function setSelectedCampaign(id, name) {
    selectedCampaignId = id;
    selectedCampaignName = name;

    $('selectedCampaignLabel').innerText = id ? `${id} • ${name}` : 'Nenhuma';
    $('prodCampaignPill').innerText = id ? `Campanha: ${id} • ${name}` : 'Campanha: (nenhuma)';
    $('tokenCampaignPill').innerText = id ? `Campanha: ${id} • ${name}` : 'Campanha: (nenhuma)';
    $('spinsCampaignPill').innerText = id ? `Campanha: ${id} • ${name}` : 'Campanha: (nenhuma)';
  }

  async function apiJson(url, opts) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
  }

  // ========================= Campaigns =========================
  async function loadCampaigns() {
    const q = $('cSearch').value.trim();
    const data = await apiJson(`${API}/admin/campaigns?q=${encodeURIComponent(q)}`, { method:'GET' });
    const tbody = $('tbodyCampaigns');
    tbody.innerHTML = '';

    (data.items || []).forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${esc(c.id)}</td>
        <td>${esc(c.name)}</td>
        <td>${c.is_active ? '✅' : '—'}</td>
        <td class="mono">${esc(c.max_spins_per_customer)}</td>
        <td>
          <button class="btn ghost" data-pick="${esc(c.id)}" data-name="${esc(c.name)}">Selecionar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedCampaign(Number(btn.dataset.pick), btn.dataset.name);
      });
    });
  }

  async function createCampaign() {
    const name = $('cName').value.trim();
    const description = $('cDesc').value.trim() || null;
    const starts_at = toISOFromLocal($('cStartsAt').value);
    const ends_at = toISOFromLocal($('cEndsAt').value);
    const max_spins_per_customer = Math.max(1, Number($('cMaxSpins').value || 1));
    const is_active = !!$('cActive').checked;

    if (!name) {
      alert('Informe o nome da campanha.');
      return;
    }

    const data = await apiJson(`${API}/admin/campaigns`, {
      method: 'POST',
      body: JSON.stringify({ name, description, starts_at, ends_at, max_spins_per_customer, is_active })
    });

    alert(`Campanha criada: ID ${data.id}`);
    $('cName').value = '';
    $('cDesc').value = '';
    $('cStartsAt').value = '';
    $('cEndsAt').value = '';
    $('cMaxSpins').value = '1';
    $('cActive').checked = true;

    await loadCampaigns();
    setSelectedCampaign(data.id, data.name);
  }

  // ========================= Campaign Products =========================
  async function loadCampaignProducts() {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha primeiro (aba Campanhas).');
      return;
    }
    const data = await apiJson(`${API}/admin/campaigns/${selectedCampaignId}/products`, { method:'GET' });

    const tbody = $('tbodyCampaignProducts');
    tbody.innerHTML = '';

    (data.items || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${esc(p.id)}</td>
        <td class="mono">${esc(p.product_code)}</td>
        <td>${esc(p.name || '')}</td>
        <td class="mono">${esc(p.weight)}</td>
        <td>${p.is_active ? '✅' : '—'}</td>
        <td>
          <button class="btn danger" data-del="${esc(p.id)}">Remover</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover este produto da campanha?')) return;
        await apiJson(`${API}/admin/campaign-products/${btn.dataset.del}`, { method:'DELETE' });
        await loadCampaignProducts();
      });
    });
  }

  async function addProductToCampaign() {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha primeiro (aba Campanhas).');
      return;
    }

    const product_code = $('pCode').value.trim();
    const weight = Math.max(1, Number($('pWeight').value || 1));
    const is_active = !!$('pActive').checked;

    if (!product_code) {
      alert('Informe o SKU (product_code).');
      return;
    }

    await apiJson(`${API}/admin/campaigns/${selectedCampaignId}/products`, {
      method:'POST',
      body: JSON.stringify({ product_code, weight, is_active })
    });

    $('pCode').value = '';
    $('pWeight').value = '1';
    $('pActive').checked = true;

    await loadCampaignProducts();
  }

  // ========================= Tokens =========================
  async function generateToken() {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha primeiro (aba Campanhas).');
      return;
    }
    const customer_id = $('tCustomerId').value.trim();
    if (!customer_id) {
      alert('Informe o customer_id.');
      return;
    }

    const expires_at = toISOFromLocal($('tExpiresAt').value);

    const data = await apiJson(`${API}/token`, {
      method:'POST',
      body: JSON.stringify({ campaign_id: selectedCampaignId, customer_id, expires_at })
    });

    const absolute = `${window.location.origin}${data.url}`;
    lastLink = absolute;
    $('lastLink').innerText = absolute;

    try { await navigator.clipboard.writeText(absolute); } catch {}
    alert('Token gerado! Link (copiado se permitido):\n' + absolute);

    await loadTokens();
  }

  async function copyLastLink() {
    if (!lastLink) { alert('Nenhum link gerado ainda.'); return; }
    try {
      await navigator.clipboard.writeText(lastLink);
      alert('Link copiado!');
    } catch {
      alert('Não consegui copiar automaticamente. Copie manualmente:\n' + lastLink);
    }
  }

  async function loadTokens() {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha primeiro (aba Campanhas).');
      return;
    }
    const q = $('tSearch').value.trim();
    const data = await apiJson(`${API}/admin/tokens?campaign_id=${selectedCampaignId}&q=${encodeURIComponent(q)}`, { method:'GET' });

    const tbody = $('tbodyTokens');
    tbody.innerHTML = '';

    (data.items || []).forEach(t => {
      const link = `${window.location.origin}/roleta/roleta.html?t=${t.token}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${esc(t.id)}</td>
        <td class="mono">${esc(t.customer_id)}</td>
        <td class="mono">${esc(t.token)}</td>
        <td class="mono">${esc(t.expires_at || '')}</td>
        <td>${t.is_active ? '✅' : '—'}</td>
        <td>
          <button class="btn ghost" data-copy="${esc(link)}">Copiar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const link = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(link);
          alert('Link copiado!');
        } catch {
          alert('Copie manualmente:\n' + link);
        }
      });
    });
  }

  // ========================= Spins =========================
  async function loadSpins() {
    if (!selectedCampaignId) {
      alert('Selecione uma campanha primeiro (aba Campanhas).');
      return;
    }
    const customer_id = $('sCustomerId').value.trim();
    const qs = new URLSearchParams();
    qs.set('campaign_id', String(selectedCampaignId));
    if (customer_id) qs.set('customer_id', customer_id);

    const data = await apiJson(`${API}/admin/spins?${qs.toString()}`, { method:'GET' });

    const tbody = $('tbodySpins');
    tbody.innerHTML = '';

    (data.items || []).forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${esc(s.id)}</td>
        <td class="mono">${esc(s.customer_id)}</td>
        <td class="mono">${esc(s.token)}</td>
        <td class="mono">${esc(s.product_code)}</td>
        <td>${esc(s.product_name || '')}</td>
        <td class="mono">${esc(s.created_at || '')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ========================= Wire Buttons =========================
  $('btnReload').addEventListener('click', () => window.location.reload());
  $('btnLoadCampaigns').addEventListener('click', loadCampaigns);
  $('btnCreateCampaign').addEventListener('click', createCampaign);

  $('btnLoadCampaignProducts').addEventListener('click', loadCampaignProducts);
  $('btnAddProductToCampaign').addEventListener('click', addProductToCampaign);

  $('btnGenerateToken').addEventListener('click', generateToken);
  $('btnCopyLastLink').addEventListener('click', copyLastLink);
  $('btnLoadTokens').addEventListener('click', loadTokens);

  $('btnLoadSpins').addEventListener('click', loadSpins);

  // Init
  (async function init() {
    setSelectedCampaign(null, null);
    await loadCampaigns();
  })();

})();