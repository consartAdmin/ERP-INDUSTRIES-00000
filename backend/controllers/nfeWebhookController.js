// ╔══════════════════════════════════════════════════════════════════════════════════╗
// ║ backend/webhooks/nfeWebhookController.js – Recebe atualizações da API NF-e       ║
// ╚══════════════════════════════════════════════════════════════════════════════════╝
import crypto from "node:crypto";

/**
 * Obtém assinatura fornecida nos headers (HMAC-SHA256)
 */
function getSignature(req) {
  return (
    req.get("x-hub-signature-256") ||
    req.get("x-signature") ||
    req.get("x-nfe-signature") ||
    ""
  ).trim();
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export const nfeWebhookController = {
  async handle(req, res) {
    const secret = process.env.NFE_WEBHOOK_SECRET || "";
    if (!secret) {
      console.warn("[webhook:nfe] NFE_WEBHOOK_SECRET ausente – aceitando sem validação.");
      return res.status(202).json({ ok: true, warn: "secret ausente" });
    }

    try {
      const raw = req.rawBody;
      if (!raw || !raw.length) return res.status(400).json({ ok: false, erro: "rawBody ausente" });

      const provided = getSignature(req);
      if (!provided) return res.status(401).json({ ok: false, erro: "assinatura ausente" });

      const hmac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      const ok   = safeEqual(provided.toLowerCase().replace(/^sha256=/, ""), hmac);

      if (!ok) return res.status(401).json({ ok: false, erro: "assinatura inválida" });

      let event = {};
      try { event = JSON.parse(raw.toString("utf-8")); }
      catch { event = { raw: raw.toString("utf-8") }; }

      console.log("[webhook:nfe] evento recebido:", JSON.stringify(event).slice(0,500));

      // TODO: Aqui você processa o evento: atualiza status do pedido/nota no seu DB

      return res.status(202).json({ ok: true });
    } catch (err) {
      console.error("[webhook:nfe] erro", err);
      return res.status(500).json({ ok: false, erro: err.message });
    }
  },
};

export default nfeWebhookController;