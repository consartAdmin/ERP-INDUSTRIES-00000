// public/includes/upload.js

// Helper: deixa a URL absoluta usando o host da API
function toAbs(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (typeof window !== 'undefined' && window.apiBase) ? window.apiBase : '';
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url.replace(/^\/+/, '')}`;
}

// Helper: tenta parsear JSON, senão retorna null
function tryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// Extrai File de diferentes origens: File, <input type="file"> change, drag&drop
function getFileFromAny(e) {
  if (e instanceof File) return e;
  if (e?.target?.files?.[0]) return e.target.files[0];
  if (e?.dataTransfer?.files?.[0]) return e.dataTransfer.files[0];
  return null;
}

// Normaliza payload do backend para { ok, url, erro? }
function normalizePayload(data) {
  if (!data || typeof data !== 'object') return { ok: false, erro: 'Resposta vazia' };
  if (data.ok && data.url) return { ok: true, url: data.url };
  if (data.ok && data.arquivo && data.arquivo.url) return { ok: true, url: data.arquivo.url };
  // tenta alguns formatos alternativos comuns
  if (data.file && data.file.url) return { ok: true, url: data.file.url };
  if (data.imagem && data.imagem.url) return { ok: true, url: data.imagem.url };
  return { ok: !!data.ok, url: null, erro: data.erro || null };
}

// === Envio genérico a partir de um <input type="file"> ===
async function enviarArquivo(inputId, resultadoId) {
  const input = document.getElementById(inputId);
  const out   = document.getElementById(resultadoId);

  if (!input || !out) {
    console.error('Elementos não encontrados:', inputId, resultadoId);
    return;
  }
  if (!input.files?.length) {
    out.textContent = 'Selecione um arquivo primeiro.';
    return;
  }

  const file = input.files[0];

  const fd = new FormData();
  fd.append('arquivo', file); // backend espera "arquivo"

  // Decide a rota conforme o tipo do arquivo
  let rota = '';
  if (file.type === 'application/pdf') {
    rota = '/api/upload/pdf';
  } else if (file.type?.startsWith('image/')) {
    rota = '/api/upload/imagem';
  } else {
    out.textContent = 'Tipo de arquivo não suportado.';
    return;
  }

  const urlPost = `${(window.apiBase || '')}${rota}`;

  out.textContent = 'Enviando...';
  try {
    const res = await fetch(urlPost, { method: 'POST', body: fd });
    const raw = await res.text();
    const data = tryJson(raw) || {};
    const norm = normalizePayload(data);

    if (!res.ok || !norm.ok || !norm.url) {
      const detalhe = norm.erro || data?.erro || `HTTP ${res.status} - ${raw.slice(0, 200)}`;
      throw new Error(detalhe);
    }

    const urlAbs = toAbs(norm.url);

    if (file.type === 'application/pdf') {
      out.innerHTML = `
        ✅ PDF enviado: <a href="${urlAbs}" target="_blank" rel="noopener">Abrir</a><br>
        <embed src="${urlAbs}" type="application/pdf" width="100%" height="400">
      `;
    } else {
      out.innerHTML = `
        ✅ Imagem enviada:<br>
        <img src="${urlAbs}" style="max-width:300px;margin-top:8px;border:1px solid #ccc;padding:4px;border-radius:6px;">
      `;
    }
  } catch (err) {
    console.error('Falha no upload:', err);
    out.textContent = `Erro: ${err.message || err}`;
  } finally {
    // limpa input depois do envio (permite reenviar o mesmo arquivo se necessário)
    input.value = '';
  }
}

// === Função usada pelos cards de produto (retorna a URL relativa) ===
// Aceita File, change event do input, ou drop (DataTransfer)
async function uploadImagemGenerica(fileOrEvent) {
  const file = getFileFromAny(fileOrEvent);
  if (!(file instanceof File)) {
    console.error('[uploadImagemGenerica] Nenhum File detectado:', fileOrEvent);
    throw new Error('Selecione um arquivo de imagem.');
  }
  if (!file.type?.startsWith('image/')) {
    throw new Error('Apenas imagens são permitidas nesta ação.');
  }

  const fd = new FormData();
  fd.append('arquivo', file); // nome do campo precisa ser "arquivo"

  const urlPost = `${(window.apiBase || '')}/api/upload/imagem`;
  const res = await fetch(urlPost, { method: 'POST', body: fd });

  // Pode vir HTML em erro (ex.: proxy), então lemos como texto primeiro
  const raw = await res.text();
  const data = tryJson(raw) || {};
  const norm = normalizePayload(data);

  if (!res.ok || !norm.ok || !norm.url) {
    const detalhe = norm.erro || data?.erro || `HTTP ${res.status} - ${raw.slice(0, 200)}`;
    throw new Error(detalhe);
  }

  // Retorna a URL *relativa* (ex.: /uploads/imagens/xxx.png) — o produtos.js resolve para absoluta se precisar
  return norm.url;
}

// Expõe no escopo global (se precisar chamar direto no HTML)
window.enviarArquivo = enviarArquivo;
window.uploadImagemGenerica = uploadImagemGenerica;