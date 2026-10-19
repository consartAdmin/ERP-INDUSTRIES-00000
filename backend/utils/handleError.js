// ╔══════════════════════════════════════════════════════════════╗
// ║ utils/handleError.js — Tratamento padrão de erros (ESM)      ║
// ╚══════════════════════════════════════════════════════════════╝

export function handleError(res, err, extra = {}) {
  try {
    const isPg = err && typeof err === 'object' && (
      err.code || err.detail || err.table || err.constraint
    );

    const status =
      err?.status ??
      (isPg ? 400 : 500);

    const payload = {
      erro: err?.message || 'Erro interno.',
      name: err?.name,
      ...(isPg ? {
        pg: {
          code: err.code,
          detail: err.detail,
          table: err.table,
          column: err.column,
          constraint: err.constraint,
          routine: err.routine
        }
      } : {}),
      ...(extra || {})
    };

    // Garante que res exista e tenha .status()
    if (!res || typeof res.status !== 'function') {
      // Último fallback pra não estourar outro erro
      console.error('[handleError] res inválido. Payload:', payload);
      return;
    }

    return res.status(status).json(payload);
  } catch (e) {
    // Nunca deixar o handler quebrar
    console.error('[handleError] falhou:', e, 'erro original:', err);
    try { res.status(500).json({ erro: 'Erro interno.' }); } catch {}
  }
}
