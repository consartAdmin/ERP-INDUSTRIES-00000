// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFe.mappers.js — normalização de notas DF-e            ║
// ║ mapNota, normalizeListResponse                                   ║
// ╚══════════════════════════════════════════════════════════════════╝

// ======================================================================
// Helpers internos de normalização
// ======================================================================

/**
 * Reduz a nota COMPLETA da PlugNotas para um formato mais enxuto,
 * ideal para inbox / grid.
 *
 * Baseado no JSON de exemplo enviado (campos principais).
 */
export function mapNota(raw = {}) {
  const emit = raw.emitente || {};
  const dest = raw.destinatario || {};
  const total = raw.total || {};
  const ultimaManifestacao =
    Array.isArray(raw.manifestacao) && raw.manifestacao.length
      ? raw.manifestacao[raw.manifestacao.length - 1]
      : null;

  return {
    // Campos chave
    idIntegracao: raw.idIntegracao || null,
    status: raw.status || null,
    chave: raw.chave || null,
    numero: raw.numero || null,
    serie: raw.serie ?? null,
    versaoManual: raw.versaoManual || null,
    finalidade: raw.finalidade || null,

    // Datas importantes
    dataEmissao: raw.dataEmissao || null,
    dataSaidaEntrada: raw.dataSaidaEntrada || null,
    dataAutorizacao: raw.dataAutorizacao || null,

    // Emissão / tipo
    saida: Boolean(raw.saida),
    presencial: raw.presencial || null,
    tipoImpressao: raw.tipoImpressao || null,
    tipoEmissao: raw.tipoEmissao || null,

    // Emitente
    emitente: {
      cpfCnpj: emit.cpfCnpj || null,
      razaoSocial: emit.razaoSocial || null,
      nomeFantasia: emit.nomeFantasia || null,
      inscricaoEstadual: emit.inscricaoEstadual || null,
      inscricaoMunicipal: emit.inscricaoMunicipal || null,
      email: emit.email || null,
      telefone: emit.telefone
        ? `${emit.telefone.ddd || ''}${emit.telefone.numero || ''}`.trim()
        : null,
      endereco: emit.endereco
        ? {
            logradouro: emit.endereco.logradouro || null,
            numero: emit.endereco.numero || null,
            bairro: emit.endereco.bairro || null,
            cep: emit.endereco.cep || null,
            codigoCidade: emit.endereco.codigoCidade || null,
            descricaoCidade: emit.endereco.descricaoCidade || null,
            estado: emit.endereco.estado || null,
          }
        : null,
    },

    // Destinatário
    destinatario: {
      cpfCnpj: dest.cpfCnpj || null,
      razaoSocial: dest.razaoSocial || null,
      nomeFantasia: dest.nomeFantasia || null,
      email: dest.email || null,
      telefone: dest.telefone
        ? `${dest.telefone.ddd || ''}${dest.telefone.numero || ''}`.trim()
        : null,
      inscricaoEstadual: dest.inscricaoEstadual || null,
      orgaoPublico: Boolean(dest.orgaoPublico),
      endereco: dest.endereco
        ? {
            logradouro: dest.endereco.logradouro || null,
            numero: dest.endereco.numero || null,
            bairro: dest.endereco.bairro || null,
            cep: dest.endereco.cep || null,
            codigoCidade: dest.endereco.codigoCidade || null,
            descricaoCidade: dest.endereco.descricaoCidade || null,
            estado: dest.endereco.estado || null,
          }
        : null,
    },

    // Totais principais
    totais: {
      valorNfe: total.valorNfe ?? null,
      valorProdutosServicos: total.valorProdutosServicos ?? null,
      valorFrete: total.valorFrete ?? null,
      valorDesconto: total.valorDesconto ?? null,
      valorIcms: total.valorIcms ?? null,
      valorIpi: total.valorIpi ?? null,
      valorPis: total.valorPis ?? null,
      valorCofins: total.valorCofins ?? null,
      valorOutros: total.valorOutros ?? null,
    },

    // Pagamento (primeiro registro)
    pagamento:
      Array.isArray(raw.pagamentos) && raw.pagamentos.length
        ? {
            meio: raw.pagamentos[0].meio || null,
            descricaoMeio: raw.pagamentos[0].descricaoMeio || null,
            valor: raw.pagamentos[0].valor ?? null,
            aVista: Boolean(raw.pagamentos[0].aVista),
          }
        : null,

    // Cobrança (duplicatas/parcelas)
    cobranca: raw.cobranca
      ? {
          numero: raw.cobranca.numero || null,
          valorTotal: raw.cobranca.valorTotal ?? null,
          valorDesconto: raw.cobranca.valorDesconto ?? null,
          valorLiquido: raw.cobranca.valorLiquido ?? null,
          parcelas: Array.isArray(raw.cobranca.parcelas)
            ? raw.cobranca.parcelas.map((p) => ({
                numero: p.numero || null,
                dataVencimento: p.dataVencimento || null,
                valor: p.valor ?? null,
              }))
            : [],
        }
      : null,

    // Última manifestação (se houver)
    manifestacao: ultimaManifestacao
      ? {
          data: ultimaManifestacao.data || null,
          operacao: ultimaManifestacao.operacao || null,
          status: ultimaManifestacao.status || null,
          respostaSefaz: ultimaManifestacao.respostaSefaz || null,
          cStat: ultimaManifestacao.cStat ?? null,
          retorno: ultimaManifestacao.retorno || null,
        }
      : null,

    // Flags
    xmlCompleto: Boolean(raw.xmlCompleto),
    enviaremail: Boolean(raw.enviaremail),

    // Campos extras se precisar
    raw, // mantém original caso você precise em telas mais detalhadas
  };
}

/**
 * Normaliza a resposta COMPLETA da listagem de DF-e,
 * baseada no JSON de exemplo.
 */
export function normalizeListResponse(body = {}) {
  const notasArray = Array.isArray(body.notas) ? body.notas : [];

  return {
    nextPageHash: body.hashProximaPagina || null,
    totalNotas: notasArray.length,
    notas: notasArray.map(mapNota),
    raw: body,
  };
}
