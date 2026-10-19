// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveries.sanitizers.js — Helpers e normalização        ║
// ╚════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * Helpers básicos
 * ======================================================================= */
export const isFiniteNum = (v) => {
  if (v === '' || v == null) return false;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n);
};

export const toNumOrNull = (v) =>
  isFiniteNum(v) ? Number(String(v).trim().replace(',', '.')) : null;

export const toTrimOrNull = (v) =>
  v == null ? null : (String(v).trim() || null);

/* =======================================================================
 * Normalização de payload
 * ======================================================================= */
export function normalizePayload(payload = {}) {
  const order_id =
    payload.order_id ??
    payload.orderId ??
    payload.pedido_id ??
    null;

  const nfe_key =
    payload.nfe_key ??
    payload.nfeKey ??
    payload.chave_nfe ??
    payload.chaveAcesso ??
    null;

  const signed_name =
    payload.signed_name ??
    payload.signedName ??
    payload.nome_assinatura ??
    payload.nome_recebedor ??
    null;

  const signature_image =
    payload.signature_image ??
    payload.signatureImage ??
    payload.assinatura_imagem ??
    null;

  return {
    order_id:        order_id != null ? Number(order_id) : null,
    nfe_key:         toTrimOrNull(nfe_key),
    signed_name:     toTrimOrNull(signed_name),
    signature_image: signature_image, // base64 dataURL (image/png)
  };
}
