// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesDiagnosticsController.js — Diagnóstico direto da PlugNotas       ║
// ║ Retorna erro de schema diretamente na resposta da API                ║
// ╚══════════════════════════════════════════════════════════════════════╝
import ordersApi from '../repositories/orders/orders.index.js';
import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';

export async function debugEmit(req, res) {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0)
      return res.status(400).json({ ok: false, error: 'orderId inválido' });

    // 1) Carrega pedido completo
    const pedido = await ordersApi.getById(orderId);
    if (!pedido?.ok)
      return res.status(404).json({ ok: false, error: 'Pedido não encontrado' });

    // 2) Monta o JSON da NF-e
    const nfeJson = await tecnospeedNfeApi.buildNFeFromOrder(pedido);

    // 3) Tenta emitir (a própria função já trata erro PlugNotas)
    let result;
    try {
      result = await tecnospeedNfeApi.emitirNFe(nfeJson);
    } catch (err) {
      // Captura bruto da exceção
      result = {
        ok: false,
        message: err.message,
        response: err.response?.data || null,
        stack: err.stack?.split('\n').slice(0, 5),
      };
    }

    // 4) Retorna payloads e resposta, sem gravar no banco
    return res.status(result.ok ? 200 : 400).json({
      ok: result.ok || false,
      hint: 'Verifique a propriedade "response" para o erro PlugNotas',
      requestPayload: nfeJson,     // JSON enviado
      plugnotasResponse: result,   // resposta completa, incluindo erro de schema
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
