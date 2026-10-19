// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeTransport.repository.js — Transporte NF-e                         ║
// ║ ✔ Monta grupo transporte + entrega do pedido                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  onlyDigits,
  toUpperSafe,
} from './nfe.utils.js';

export function buildTransporteFromOrder(header = {}, totalFrete = 0, { strict = true } = {}) {
  const shipping =
    header.shipping ||
    header.delivery ||
    header.order_delivery ||
    header ||
    {};

  const text = (v) => String(v ?? '').trim();

  // Primeiro valor não vazio (aceita 0 como valor válido)
  const pick = (...values) => {
    for (const v of values) {
      const s = text(v);
      if (s) return s;
    }
    return '';
  };

  // Limites do layout da NF-e (xNome, xEnder, xMun = 60)
  const limit = (v, max) => text(v).slice(0, max);

  // ── Modalidade do frete ───────────────────────────────────────────────
  const modalidadeFrete = pick(shipping.freight_mode, shipping.modalidadeFrete) ||
    (Number(totalFrete || 0) > 0 ? '0' : '9');

  const transporte = {
    modalidadeFrete: String(modalidadeFrete),
  };

  // ── Transportador ─────────────────────────────────────────────────────
  // budgetsShipping usa carrier_state; ordersDelivery usa carrier_uf
  const nome = limit(pick(shipping.carrier_name, shipping.carrierName), 60);
  const doc = onlyDigits(pick(shipping.carrier_cnpj_cpf, shipping.carrier_doc));

  const ieRaw = pick(shipping.carrier_ie, shipping.carrierIe);
  const ie = /^ISENTO$/i.test(ieRaw) ? 'ISENTO' : onlyDigits(ieRaw);

  const uf = toUpperSafe(
    pick(shipping.carrier_state, shipping.carrier_uf, shipping.carrierState, shipping.carrierUf)
  ).slice(0, 2);

  const cidade = limit(pick(shipping.carrier_city, shipping.carrierCity), 60);

  const logradouro = pick(shipping.carrier_address);
  const numero = pick(shipping.carrier_number);
  const bairro = pick(shipping.carrier_district);

  const linhaLogradouro = logradouro
    ? (numero ? `${logradouro}, ${numero}` : logradouro)
    : numero;

  const enderecoTxt = limit(
    [linhaLogradouro, bairro].filter(Boolean).join(' - ').toUpperCase(),
    60
  );

  if (nome || doc) {
    // SEFAZ rejeita IE/município sem UF ("UF do Transportador nao informada")
    if ((ie || cidade) && !/^[A-Z]{2}$/.test(uf)) {
      const msg =
        'UF da transportadora não informada. Preencha o estado no cadastro ' +
        'da transportadora (ou no frete do orçamento) antes de emitir a NF-e.';

      if (strict) {
        const err = new Error(msg);
        err.status = 400;
        err.statusCode = 400;
        err.code = 'CARRIER_UF_REQUIRED';
        throw err;
      }

      console.warn(`[NFe][transporte] ${msg}`);
    }

    const transportador = {};

    if (doc.length === 14) transportador.cnpj = doc;
    else if (doc.length === 11) transportador.cpf = doc;

    if (nome) transportador.nome = nome;
    if (ie) transportador.inscricaoEstadual = ie;

    const endereco = {};
    if (enderecoTxt) endereco.logradouro = enderecoTxt;
    if (cidade) endereco.descricaoCidade = cidade;
    if (uf) endereco.uf = uf;

    if (Object.keys(endereco).length) {
      transportador.endereco = endereco;
    }

    transporte.transportador = transportador;
  }

  // ── Veículo ───────────────────────────────────────────────────────────
  const placa = toUpperSafe(pick(shipping.vehicle_plate))
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);

  if (placa) {
    const veiculo = { placa };

    const vehicleUF = toUpperSafe(
      pick(shipping.vehicle_state, shipping.vehicle_uf)
    ).slice(0, 2);

    const rntc = limit(pick(shipping.vehicle_rntc, shipping.antt_code), 20);

    if (vehicleUF) veiculo.uf = vehicleUF;
    if (rntc) veiculo.rntc = rntc;

    transporte.veiculo = veiculo;
  }

  // ── Volumes ───────────────────────────────────────────────────────────
  // volumes tem default 0 na tabela: usa o primeiro valor > 0
  const quantidade =
    [shipping.volumes, shipping.volume_quantity]
      .map((v) => Number(v))
      .find((n) => Number.isFinite(n) && n > 0) || 0;

  // Peso bruto/líquido vão para a NF-e mesmo sem quantidade de volumes
  // (o DANFE da prévia já mostra o peso; antes ele sumia na emissão).
  const pesoBruto = Number(shipping.gross_weight || 0);
  const pesoLiquido = Number(shipping.net_weight || 0);

  const volume = {};
  if (quantidade > 0) volume.quantidade = quantidade;
  if (Number.isFinite(pesoBruto) && pesoBruto > 0) volume.pesoBruto = pesoBruto;
  if (Number.isFinite(pesoLiquido) && pesoLiquido > 0) volume.pesoLiquido = pesoLiquido;

  const especie = limit(shipping.volume_species, 60);
  const marca = limit(shipping.volume_brand, 60);
  const numeracao = limit(shipping.volume_numbering, 60);

  if (especie) volume.especie = especie;
  if (marca) volume.marca = marca;
  if (numeracao) volume.numeracao = numeracao;

  if (Object.keys(volume).length) {
    transporte.volumes = [volume];
  }

  console.log('[NFe][transporte] payload:', JSON.stringify(transporte));

  return transporte;
}

export async function loadOrderDeliveryForNfe(orderId) {
  if (!orderId) return null;

  const { rows } = await pool.query(
    `
    SELECT *
    FROM public."ordersDelivery"
    WHERE order_id = $1
    LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}
