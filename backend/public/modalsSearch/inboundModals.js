/* ╔══════════════════════════════════════════════════════════════╗
 * ║ inboundModals.js — Modal de Entrada de NF-e | PRODNEX ERP   ║
 * ║ Local: /public/modalsSearch/inboundModals.js                 ║
 * ║                                                              ║
 * ║ Função global:                                              ║
 * ║   window.openInboundEntryModal({ accessKey, issuer, total })║
 * ║                                                              ║
 * ║ Fluxo:                                                      ║
 * ║   1) Mostra modal com loader                                ║
 * ║   2) Chama API /api/inbound/auto-from-dfe?accessKey=...     ║
 * ║   3) Recebe invoiceId                                       ║
 * ║   4) Abre /public/inbound/inbound.html?invoiceId=ID         ║
 * ╚══════════════════════════════════════════════════════════════╝ */

(function () {
  const API_BASE =
    (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const INBOUND_PAGE_URL = '/public/inbound/inbound.html';

  const ROUTES = {
    autoImportFromDfe: (accessKey) =>
      `${API_BASE}/api/inbound/auto-from-dfe?accessKey=${encodeURIComponent(
        accessKey
      )}`,
  };

  function ensureInboundModalContainer() {
    let overlay = document.getElementById('inbound-entry-modal-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'inbound-entry-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(15,23,42,0.72)';
    overlay.style.backdropFilter = 'blur(3px)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const container = document.createElement('div');
    container.id = 'inbound-entry-modal-container';
    container.style.width = 'min(1200px, 96vw)';
    container.style.height = 'min(650px, 92vh)';
    container.style.background = '#ffffff';
    container.style.borderRadius = '18px';
    container.style.boxShadow = '0 30px 80px rgba(15,23,42,0.55)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';

    // Cabeçalho
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '10px 16px';
    header.style.background = 'linear-gradient(90deg,#2563eb,#38bdf8)';
    header.style.color = '#f9fafb';

    const title = document.createElement('div');
    title.textContent = 'Entrada de Notas Fiscais (NF-e)';
    title.style.fontSize = '0.95rem';
    title.style.fontWeight = '600';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'rgba(248,250,252,0.9)';
    closeBtn.style.fontSize = '1.6rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.padding = '0 4px';
    closeBtn.addEventListener('click', closeInboundEntryModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Barra de status (mostra "importando XML..." etc.)
    const statusBar = document.createElement('div');
    statusBar.id = 'inbound-entry-status-bar';
    statusBar.style.padding = '8px 16px';
    statusBar.style.fontSize = '0.8rem';
    statusBar.style.color = '#111827';
    statusBar.style.background = '#e5f0ff';
    statusBar.style.borderBottom = '1px solid #bfdbfe';
    statusBar.textContent = '';

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'inbound-entry-iframe';
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.flex = '1 1 auto';
    iframe.style.background = '#f1f5f9';

    container.appendChild(header);
    container.appendChild(statusBar);
    container.appendChild(iframe);
    overlay.appendChild(container);

    // Clique fora fecha
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        closeInboundEntryModal();
      }
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function setStatus(text, isError = false) {
    const bar = document.getElementById('inbound-entry-status-bar');
    if (!bar) return;
    bar.textContent = text || '';
    bar.style.background = isError ? '#fee2e2' : '#e5f0ff';
    bar.style.color = isError ? '#991b1b' : '#111827';
    bar.style.borderBottomColor = isError ? '#fecaca' : '#bfdbfe';
  }

  function openInboundEntryModal(opts = {}) {
    const { accessKey = '', issuer = '', total = '' } = opts;

    const overlay = ensureInboundModalContainer();
    const iframe = document.getElementById('inbound-entry-iframe');

    if (!overlay || !iframe) return;

    overlay.style.display = 'flex';
    iframe.src = 'about:blank';
    setStatus('Importando XML da NF-e selecionada, aguarde...');

    if (!accessKey) {
      setStatus('Chave de acesso não informada. Não foi possível importar o XML.', true);
      return;
    }

    // Chama backend para importar o XML e gerar registro em inbound_invoices
    fetch(ROUTES.autoImportFromDfe(accessKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issuer: issuer || undefined,
        total: total !== '' ? total : undefined,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} - ${txt || 'Falha ao importar XML.'}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!json || json.success === false) {
          throw new Error(json?.message || 'Erro ao importar XML da NF-e.');
        }

        const invoiceId =
          json.invoiceId || json.id || (json.invoice && json.invoice.id);
        if (!invoiceId) {
          throw new Error('A API não retornou o ID da nota de entrada (invoiceId).');
        }

        // 🔥 Se vier XML, guarda no sessionStorage
        let xmlKey = null;
        if (json.xml) {
          xmlKey = `INBOUND_XML_${invoiceId}`;
          try {
            sessionStorage.setItem(xmlKey, json.xml);
          } catch (e) {
            console.warn('[inboundModals] Falha ao salvar XML no sessionStorage:', e);
          }
        }

        // Monta URL da tela de entrada já apontando para a nota criada
        const params = new URLSearchParams();
        params.set('invoiceId', String(invoiceId));
        params.set('chave', accessKey);
        if (xmlKey) {
          // passamos a chave para a tela saber onde buscar o XML
          params.set('xmlKey', xmlKey);
        }

        const url = `${INBOUND_PAGE_URL}?${params.toString()}`;
        iframe.src = url;
        setStatus('');
      })

      .catch((err) => {
        console.error('[inboundModals] auto-import error:', err);
        setStatus(
          'Erro ao importar XML da NF-e. Verifique o console / logs para mais detalhes.',
          true
        );
      });

    // ESC fecha
    function escHandler(ev) {
      if (ev.key === 'Escape') {
        closeInboundEntryModal();
        document.removeEventListener('keydown', escHandler);
      }
    }
    document.addEventListener('keydown', escHandler);
  }

  function closeInboundEntryModal() {
    const overlay = document.getElementById('inbound-entry-modal-overlay');
    const iframe = document.getElementById('inbound-entry-iframe');
    if (overlay) overlay.style.display = 'none';
    if (iframe) iframe.src = 'about:blank';
  }

  // Registra no window para uso global
  if (typeof window !== 'undefined') {
    window.openInboundEntryModal = openInboundEntryModal;
    window.closeInboundEntryModal = closeInboundEntryModal;
  }
})();
