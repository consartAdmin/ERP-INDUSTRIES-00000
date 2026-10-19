// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.attachTiles.js — Anexos em quadrados (Editar Mov.)    ║
// ║ PRODNEX ERP                                                          ║
// ║                                                                      ║
// ║ Os quadrados são só a "vitrine": a lista #listaAnexosEdicao e o      ║
// ║ input #edit_anexoFile continuam sendo o motor (upload, listagem e    ║
// ║ exclusão já existentes). Aqui a lista é espelhada em quadrados e os  ║
// ║ quadrados vazios repassam clique/arraste para o input.               ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { actionIconSvg } from '/public/includes/js/actionIcons.js';

const MIN_SLOTS = 3;
const PDFJS_URL = '/public/vendor/pdfjs/pdf.mjs';
const PDFJS_WORKER = '/public/vendor/pdfjs/pdf.worker.mjs';
const THUMB_WIDTH = 320;

// url -> { state: 'loading' | 'img' | 'frame', src }
const previews = new Map();
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return lib;
    });
  }
  return pdfjsPromise;
}

/** Desenha a 1ª página do PDF em um PNG. Sem CORS no bucket, cai no iframe. */
async function renderPdfThumb(url) {
  try {
    const lib = await loadPdfjs();
    const task = lib.getDocument({ url });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    previews.set(url, { state: 'img', src: canvas.toDataURL('image/png') });
    task.destroy?.().catch?.(() => {});
  } catch (err) {
    console.warn('[CAIXA][ANEXO] Prévia do PDF via pdf.js falhou, usando visualizador do navegador:', err?.message || err);
    previews.set(url, { state: 'frame', src: `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` });
  }
}
const ALLOWED = /\.(pdf|xml|png|jpe?g|webp)$/i;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fileKind(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'xml') return 'XML';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'IMG';
  return ext.toUpperCase().slice(0, 4) || 'ARQ';
}

function init() {
  const slots = document.getElementById('edit_attachSlots');
  const list = document.getElementById('listaAnexosEdicao');
  const input = document.getElementById('edit_anexoFile');
  const progress = document.getElementById('edit_anexoProgress');
  if (!slots || !list || !input) return;

  /** Anexos atuais lidos da lista que o motor existente renderiza. */
  function readItems() {
    return [...list.querySelectorAll(':scope > li')]
      .map((li) => {
        const link = li.querySelector('a[href]');
        const del = li.querySelector('button');
        return link ? { li, name: link.textContent.trim(), url: link.href, del } : null;
      })
      .filter(Boolean);
  }

  function previewHtml(item) {
    const kind = fileKind(item.name);
    const badge = `<span class="cx-tile__kind">${kind}</span>`;

    if (kind === 'IMG') {
      return `<img class="cx-tile__thumb" src="${esc(item.url)}" alt="" loading="lazy" data-fallback="${kind}">`;
    }
    if (kind !== 'PDF') return badge;

    const preview = previews.get(item.url);
    if (!preview) {
      previews.set(item.url, { state: 'loading' });
      renderPdfThumb(item.url).then(render);
      return badge;
    }
    if (preview.state === 'img') {
      return `<img class="cx-tile__thumb" src="${preview.src}" alt="">`;
    }
    if (preview.state === 'frame') {
      return `<span class="cx-tile__frame"><iframe src="${esc(preview.src)}" title="Prévia" tabindex="-1" loading="lazy"></iframe></span>`;
    }
    return badge;
  }

  const isUploading = () => progress && !progress.hidden && progress.style.display !== 'none';
  const isLoading = () => /carregando/i.test(list.textContent) && !list.querySelector('a[href]');

  function render() {
    const items = readItems();
    const total = Math.max(MIN_SLOTS, items.length + 1); // sempre sobra 1 quadrado para anexar
    const html = [];

    items.forEach((item, idx) => {
      html.push(`
        <div class="cx-tile cx-tile--file" data-idx="${idx}">
          <a class="cx-tile__open" href="${esc(item.url)}" target="_blank" rel="noopener" title="Abrir ${esc(item.name)}">
            ${previewHtml(item)}
            <span class="cx-tile__name">${esc(item.name)}</span>
          </a>
          <button type="button" class="action-icon action-icon--delete cx-tile__del" data-del-idx="${idx}"
            title="Excluir anexo" aria-label="Excluir ${esc(item.name)}">${actionIconSvg('delete')}</button>
        </div>`);
    });

    for (let i = items.length; i < total; i += 1) {
      const first = i === items.length;
      const label = first && isUploading() ? 'Enviando…'
        : first && isLoading() ? 'Carregando…'
          : 'Anexar arquivo';
      html.push(`
        <div class="cx-tile cx-tile--empty" role="button" tabindex="0" data-add
          title="Clique ou arraste um arquivo (PDF, XML, PNG, JPG, WEBP)">
          <span class="cx-tile__plus" aria-hidden="true">+</span>
          <span class="cx-tile__hint">${label}</span>
        </div>`);
    }

    slots.innerHTML = html.join('');
  }

  // clique / teclado
  slots.addEventListener('click', (event) => {
    const del = event.target.closest('[data-del-idx]');
    if (del) {
      event.preventDefault();
      readItems()[Number(del.dataset.delIdx)]?.del?.click(); // exclusão do motor (com confirmação)
      return;
    }
    if (event.target.closest('[data-add]')) input.click();
  });

  slots.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-add]')) {
      event.preventDefault();
      input.click();
    }
  });

  // arrastar e soltar
  slots.addEventListener('dragover', (event) => {
    const tile = event.target.closest('[data-add]');
    if (!tile) return;
    event.preventDefault();
    slots.querySelectorAll('.is-dragover').forEach((t) => t !== tile && t.classList.remove('is-dragover'));
    tile.classList.add('is-dragover');
  });

  slots.addEventListener('dragleave', (event) => {
    const tile = event.target.closest('[data-add]');
    if (tile && !tile.contains(event.relatedTarget)) tile.classList.remove('is-dragover');
  });

  slots.addEventListener('drop', (event) => {
    const tile = event.target.closest('[data-add]');
    if (!tile) return;
    event.preventDefault();
    tile.classList.remove('is-dragover');

    const files = [...(event.dataTransfer?.files || [])].filter((f) => ALLOWED.test(f.name));
    if (!files.length) {
      window.alert('Formato não permitido. Use PDF, XML, PNG, JPG, JPEG ou WEBP.');
      return;
    }

    const transfer = new DataTransfer();
    files.forEach((f) => transfer.items.add(f));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true })); // motor valida e envia
  });

  // imagem que não carregou volta para o selo
  slots.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    const badge = document.createElement('span');
    badge.className = 'cx-tile__kind';
    badge.textContent = img.dataset.fallback;
    img.replaceWith(badge);
  }, true);

  // espelha a lista e o progresso do motor
  new MutationObserver(render).observe(list, { childList: true, subtree: true, characterData: true });
  if (progress) {
    new MutationObserver(render).observe(progress, { attributes: true, attributeFilter: ['hidden', 'style'] });
  }

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
