// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ 🚀 nfeGatewayController.js – Integração ERP → API externa de emissão NF-e    ║
// ║ Busca pedido e cliente no banco e envia JSON completo para API emissor-nfe.  ║
/* ╚══════════════════════════════════════════════════════════════════════════════╝ */

import db from "../config/db.js";
import axios from "axios";

// Helper para limpar CNPJ/CPF
const onlyDigits = (s = "") => String(s || "").replace(/\D+/g, "");

/** ============================================================================
 * 🔧 Função interna: monta o payload da NF-e a partir do número do pedido
 * Usada por montarNfePorPedido (GET) e emitirNfeViaApi (POST)
 * ===========================================================================*/
async function buildDadosNfeFromNumero(numero) {
  const pedRes = await db.query(
    `SELECT * FROM pedidos WHERE numero = $1 AND deleted_at IS NULL LIMIT 1`,
    [numero]
  );
  if (!pedRes.rowCount) {
    const err = new Error("Pedido não encontrado.");
    err.status = 404;
    throw err;
  }
  const pedido = pedRes.rows[0];

  // Itens
  const itensRes = await db.query(
    `SELECT sku, descricao, unidade, grade,
            quantidade, valor_unitario,
            COALESCE(desconto,0) AS desconto,
            COALESCE(total_item, quantidade*valor_unitario - COALESCE(desconto,0))::numeric(12,2) AS total,
            ncm
       FROM "pedidoItens"
      WHERE pedido_id = $1
      ORDER BY id`,
    [pedido.id]
  );
  const itens = itensRes.rows || [];

  // Cliente
  const cliRes = await db.query(
    `SELECT * FROM clientes WHERE cliente_id = $1 LIMIT 1`,
    [pedido.cliente_id]
  );
  if (!cliRes.rowCount) {
    const err = new Error("Cliente vinculado ao pedido não encontrado.");
    err.status = 404;
    err.code = "CLIENTE_NAO_ENCONTRADO";
    throw err;
  }
  const cliente = cliRes.rows[0];

  // Montagem do payload NF-e
  const dados = {
    ide: {
      cUF: "31", // MG
      natOp: "VENDA DE MERCADORIAS",
      serie: 1,
      nNF: pedido.numero,
      tpAmb: process.env.NFE_AMBIENTE === "producao" ? "1" : "2",
      tpEmis: "1",
      finNFe: "1",
      indFinal: "1",
      indPres: "1",
    },
    emit: {
      CNPJ: process.env.NFE_EMIT_CNPJ || "34363337000185",
      xNome: process.env.NFE_EMIT_RAZAO || "BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA",
      xFant: process.env.NFE_EMIT_FANTASIA || "BH3 DISTRIBUIDORA",
      enderEmit: {
        xLgr: "AV. BIAS FORTES",
        nro: "784",
        xBairro: "LOURDES",
        cMun: "3106200",
        xMun: "BELO HORIZONTE",
        UF: "MG",
        CEP: "30170012",
        fone: "3135660070",
      },
      IE: "ISENTO",
    },
    dest: {
      CNPJ: onlyDigits(cliente.cnpj_cpf),
      xNome: cliente.nome_fantasia || cliente.razao_social || pedido.cliente_nome,
      enderDest: {
        xLgr: cliente.endereco || "",
        nro: cliente.numero || "",
        xBairro: cliente.bairro || "",
        cMun: "0000000",
        xMun: cliente.cidade || "",
        UF: cliente.uf || "",
        CEP: onlyDigits(cliente.cep),
        fone: onlyDigits(cliente.telefone),
      },
      indIEDest: "9",
      IE: cliente.ie || "",
    },
    itens: itens.map((it, i) => ({
      nItem: i + 1,
      cProd: it.sku || "",
      xProd: it.descricao || "",
      NCM: it.ncm || "61091000",
      CFOP: "5102",
      uCom: it.unidade || "UN",
      qCom: Number(it.quantidade || 0),
      vUnCom: Number(it.valor_unitario || 0),
      vProd: Number(it.total || 0),
    })),
    pagamentos: [
      {
        tPag: "01", // Dinheiro
        vPag: itens.reduce((s, i) => s + Number(i.total || 0), 0),
      },
    ],
  };

  return { pedido, cliente, itens, dados };
}

/* =============================================================================
 * 🔍 GET /api/nfe/pedido/:numero – montar payload NF-e a partir do pedido
 * ========================================================================== */
export async function montarNfePorPedido(req, res) {
  const numero = Number(req.params.numero);
  if (!Number.isFinite(numero)) {
    return res.status(400).json({ ok: false, erro: "Número inválido." });
  }
  try {
    const { dados } = await buildDadosNfeFromNumero(numero);
    return res.json({ ok: true, dados });
  } catch (err) {
    const status = Number(err.status || 500);
    console.error("[❌ montarNfePorPedido]", err);
    return res.status(status).json({ ok: false, erro: err.code || err.message });
  }
}

/* =============================================================================
 * 🚀 POST /api/nfe/emitir  e  POST /api/nfe/emitir/:numero
 * Aceita:
 *   - params:  :numero
 *   - body:    { pedido|numero|id }
 *   - query:   ?numero=114
 * Envia o payload para a API emissora configurada em NFE_API_BASE_URL / NFE_API_KEY
 * ========================================================================== */
export async function emitirNfeViaApi(req, res) {
  const numeroRaw =
    req.params?.numero ??
    req.body?.pedido ?? req.body?.numero ?? req.body?.id ??
    req.query?.numero ?? req.query?.pedido ?? req.query?.id;

  const numero = Number(numeroRaw);
  if (!Number.isFinite(numero)) {
    return res.status(400).json({
      ok: false,
      erro: "PARAMETRO_FALTANDO",
      hint: 'Informe o número do pedido via :numero, body {"pedido":114} ou ?numero=114',
    });
  }

  const baseURL = process.env.NFE_API_BASE_URL;
  const apiKey  = process.env.NFE_API_KEY;
  if (!baseURL || !apiKey) {
    return res.status(500).json({
      ok: false,
      erro: "CONFIG_NFE_AUSENTE",
      hint: "Defina NFE_API_BASE_URL e NFE_API_KEY no ambiente.",
    });
  }

  try {
    // 1) Monta payload direto do banco (sem round-trip HTTP)
    const { dados } = await buildDadosNfeFromNumero(numero);

    // 2) Envia para a API emissora
    const resp = await axios.post(
      `${baseURL.replace(/\/+$/,'')}/api/nfe/emitir`,
      dados,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: Number(process.env.NFE_API_TIMEOUT_MS || 15000),
      }
    );

    return res.status(200).json({
      ok: true,
      mensagem: "NF-e enviada com sucesso.",
      retorno: resp.data,
    });
  } catch (err) {
    // Normaliza erro da API externa
    const status = Number(err.response?.status || err.status || 500);
    const payload = err.response?.data || { message: err.message };
    console.error("[❌ emitirNfeViaApi]", { status, payload });

    return res.status(status).json({
      ok: false,
      erro: "EMISSAO_FALHOU",
      detalhe: payload,
    });
  }
}
