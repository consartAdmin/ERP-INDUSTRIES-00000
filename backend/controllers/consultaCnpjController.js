// ╔═════════════════════════════════════════════════════════════════════════════════════╗
// ║ 🧠 backend/controllers/consultaCnpjController.js – Consulta de CNPJ (BrasilAPI)    ║
// ╚═════════════════════════════════════════════════════════════════════════════════════╝

import { consultarCnpjGratis } from "../services/cnpjService.js";

/**
 * Remove caracteres não numéricos
 */
const onlyDigits = (s = "") => String(s).replace(/\D/g, "");

/**
 * Validação básica (não faz DV aqui — a validação completa está no service)
 */
const isValidCnpj = (c) => onlyDigits(c).length === 14;

/**
 * Controlador principal da rota /api/consulta-cnpj/:cnpj
 * Consulta o CNPJ usando BrasilAPI (gratuito) e retorna shape normalizado.
 */
export async function consultarCNPJ(req, res) {
  const raw = String(req.params.cnpj || "").trim();

  // ────────────────────────────────────────────────────────────────
  // 1. Validação
  // ────────────────────────────────────────────────────────────────
  if (!isValidCnpj(raw)) {
    return res.status(400).json({
      status: "ERROR",
      message: "CNPJ inválido ou ausente",
    });
  }

  try {
    // ────────────────────────────────────────────────────────────────
    // 2. Consulta via BrasilAPI
    // ────────────────────────────────────────────────────────────────
    const { provider, rawPayload, normalized } = await consultarCnpjGratis(raw);

    // ────────────────────────────────────────────────────────────────
    // 3. Retorno padronizado
    // ────────────────────────────────────────────────────────────────
    return res.status(200).json({
      status: "OK",
      provider,
      data: rawPayload,
      _normalized: normalized,
    });
  } catch (err) {
    // ────────────────────────────────────────────────────────────────
    // 4. Tratamento de erro
    // ────────────────────────────────────────────────────────────────
    console.error("❌ Erro ao consultar CNPJ:", err?.message || err);

    const msg =
      err?.message?.includes("timeout") || err?.message?.includes("aborted")
        ? "Tempo de resposta excedido na consulta ao BrasilAPI"
        : err?.message || "Falha ao consultar CNPJ";

    return res.status(502).json({
      status: "ERROR",
      message: msg,
    });
  }
}
