// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/services/budgetsNfePreviewService.js                         ║
// ║ ✅ Monta XML temporário a partir do orçamento                        ║
// ║ ✅ Usa o layout oficial do danfeConsartService                       ║
// ║ ✅ Não transmite para PlugNotas ou SEFAZ                             ║
// ║ ✅ Não utiliza ou consome número fiscal                              ║
// ║ ✅ Marca o PDF como SEM VALOR FISCAL                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    buildNFeFromOrder,
} from '../repositories/nfe/nfe.index.js';

import {
    generateDanfeFromXml,
} from './danfeConsartService.js';

function escapeXml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function digits(value) {
    return String(value ?? '')
        .replace(/\D/g, '');
}

function decimal(
    value,
    decimals = 2
) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed.toFixed(decimals)
        : Number(0).toFixed(decimals);
}

function calculateItemValues(item) {
    const quantity = Number(
        item.quantidade?.comercial ??
        item.quantidade ??
        0
    );

    const unitPrice = Number(
        item.valorUnitario?.comercial ??
        item.valorUnitario ??
        0
    );

    const grossValue = Number(
        item.valor ??
        quantity * unitPrice
    );

    const discount = Number(
        item.valorDesconto || 0
    );

    const total = Number(
        item.valorTotal ??
        Math.max(
            0,
            grossValue - discount
        )
    );

    return {
        quantity,
        unitPrice,
        grossValue,
        discount,
        total,
    };
}

function buildAddressXml(
    tag,
    address = {}
) {
    return `
    <${tag}>
      <xLgr>${escapeXml(
        address.logradouro ||
        'NÃO INFORMADO'
    )}</xLgr>

      <nro>${escapeXml(
        address.numero ||
        'S/N'
    )}</nro>

      ${address.complemento
            ? `<xCpl>${escapeXml(address.complemento)}</xCpl>`
            : ''
        }

      <xBairro>${escapeXml(
            address.bairro ||
            'CENTRO'
        )}</xBairro>

      <cMun>${escapeXml(
            address.codigoCidade ||
            address.codigoMunicipio ||
            ''
        )}</cMun>

<xMun>${escapeXml(
            address.descricaoCidade ||
            address.cidade ||
            address.municipio ||
            address.nomeCidade ||
            ''
        )}</xMun>

      <UF>${escapeXml(
            address.estado ||
            address.uf ||
            ''
        )}</UF>

      <CEP>${digits(
            address.cep
        )}</CEP>

      <cPais>1058</cPais>
      <xPais>BRASIL</xPais>

      ${address.telefone
            ? `<fone>${digits(address.telefone)}</fone>`
            : ''
        }
    </${tag}>
  `;
}

function buildIssuerXml(
    issuer = {}
) {
    const cnpj = digits(
        issuer.cpfCnpj ||
        process.env.EMPRESA_CNPJ
    );

    const address = {
        logradouro:
            issuer.endereco?.logradouro ||
            process.env.EMPRESA_LOGRADOURO ||
            'NÃO INFORMADO',

        numero:
            issuer.endereco?.numero ||
            process.env.EMPRESA_NUMERO ||
            'S/N',

        complemento:
            issuer.endereco?.complemento ||
            process.env.EMPRESA_COMPLEMENTO ||
            '',

        bairro:
            issuer.endereco?.bairro ||
            process.env.EMPRESA_BAIRRO ||
            'CENTRO',

        codigoCidade:
            issuer.endereco?.codigoCidade ||
            process.env.EMPRESA_CODIGO_IBGE ||
            '',

        cidade:
            issuer.endereco?.cidade ||
            process.env.EMPRESA_CIDADE ||
            '',

        estado:
            issuer.endereco?.estado ||
            issuer.endereco?.uf ||
            process.env.EMPRESA_UF ||
            '',

        cep:
            issuer.endereco?.cep ||
            process.env.EMPRESA_CEP ||
            '',

        telefone:
            issuer.endereco?.telefone ||
            process.env.EMPRESA_TELEFONE ||
            '',
    };

    return `
    <emit>
      <CNPJ>${cnpj}</CNPJ>

      <xNome>${escapeXml(
        issuer.razaoSocial ||
        process.env.EMPRESA_RAZAO ||
        'EMITENTE'
    )}</xNome>

      <xFant>${escapeXml(
        issuer.nomeFantasia ||
        process.env.EMPRESA_FANTASIA ||
        issuer.razaoSocial ||
        'EMITENTE'
    )}</xFant>

      ${buildAddressXml(
        'enderEmit',
        address
    )}

      <IE>${digits(
        issuer.inscricaoEstadual ||
        process.env.EMPRESA_IE
    )}</IE>

      <CRT>${escapeXml(
        issuer.regimeTributario ||
        process.env.EMPRESA_CRT ||
        '3'
    )}</CRT>
    </emit>
  `;
}

function buildRecipientXml(
    recipient = {}
) {
    const document = digits(
        recipient.cpfCnpj
    );

    const documentTag =
        document.length === 11
            ? 'CPF'
            : 'CNPJ';

    return `
    <dest>
      <${documentTag}>${document}</${documentTag}>

      <xNome>${escapeXml(
        recipient.razaoSocial ||
        recipient.nome ||
        'CONSUMIDOR'
    )}</xNome>

${buildAddressXml(
        'enderDest',
        {
            ...(recipient.endereco || {}),

            telefone:
                recipient.telefone ||
                recipient.endereco?.telefone ||
                '',
        }
    )}

      <indIEDest>${escapeXml(
        recipient.indicadorIEDestinatario ||
        '9'
    )}</indIEDest>

      ${recipient.inscricaoEstadual
            ? `
            <IE>${digits(
                recipient.inscricaoEstadual
            )}</IE>
          `
            : ''
        }

      ${recipient.email
            ? `
            <email>${escapeXml(
                recipient.email
            )}</email>
          `
            : ''
        }
    </dest>
  `;
}

function buildTaxXml(item) {
    const taxes =
        item.tributos || {};

    const icms =
        taxes.icms || {};

    const pis =
        taxes.pis || {};

    const cofins =
        taxes.cofins || {};

    const icmsCst = String(
        icms.cst || '00'
    ).padStart(2, '0');

    const pisCst = String(
        pis.cst || '07'
    ).padStart(2, '0');

    const cofinsCst = String(
        cofins.cst || '07'
    ).padStart(2, '0');

    return `
    <imposto>
      <ICMS>
        <ICMS${icmsCst}>
          <orig>${escapeXml(
        icms.origem ?? '0'
    )}</orig>

          <CST>${escapeXml(
        icmsCst
    )}</CST>

          ${icmsCst !== '60'
            ? `
                <modBC>0</modBC>

                <vBC>${decimal(
                icms.baseCalculo?.valor,
                2
            )}</vBC>

                <pICMS>${decimal(
                icms.aliquota,
                4
            )}</pICMS>

                <vICMS>${decimal(
                icms.valor,
                2
            )}</vICMS>
              `
            : ''
        }
        </ICMS${icmsCst}>
      </ICMS>

      <PIS>
        <PISNT>
          <CST>${escapeXml(
            pisCst
        )}</CST>
        </PISNT>
      </PIS>

      <COFINS>
        <COFINSNT>
          <CST>${escapeXml(
            cofinsCst
        )}</CST>
        </COFINSNT>
      </COFINS>
    </imposto>
  `;
}

function buildItemsXml(items = []) {
    return items
        .map(
            (item, index) => {
                const values =
                    calculateItemValues(item);

                const unit =
                    item.unidade?.comercial ||
                    item.unidade ||
                    'UN';

                return `
          <det nItem="${index + 1}">
            <prod>
              <cProd>${escapeXml(
                    item.codigo ||
                    item.sku ||
                    index + 1
                )}</cProd>

              <cEAN>SEM GTIN</cEAN>

              <xProd>${escapeXml(
                    item.descricao ||
                    'PRODUTO'
                )}</xProd>

              <NCM>${digits(
                    item.ncm
                )}</NCM>

              ${item.cest
                        ? `<CEST>${digits(item.cest)}</CEST>`
                        : ''
                    }

              <CFOP>${digits(
                        item.cfop
                    )}</CFOP>

              <uCom>${escapeXml(
                        unit
                    )}</uCom>

              <qCom>${decimal(
                        values.quantity,
                        4
                    )}</qCom>

              <vUnCom>${decimal(
                        values.unitPrice,
                        4
                    )}</vUnCom>

              <vProd>${decimal(
                        values.grossValue,
                        2
                    )}</vProd>

              <cEANTrib>SEM GTIN</cEANTrib>

              <uTrib>${escapeXml(
                        item.unidade?.tributavel ||
                        unit
                    )}</uTrib>

              <qTrib>${decimal(
                        values.quantity,
                        4
                    )}</qTrib>

              <vUnTrib>${decimal(
                        values.unitPrice,
                        4
                    )}</vUnTrib>

              ${values.discount > 0
                        ? `
                    <vDesc>${decimal(
                            values.discount,
                            2
                        )}</vDesc>
                  `
                        : ''
                    }

              <indTot>1</indTot>
            </prod>

            ${buildTaxXml(item)}
          </det>
        `;
            }
        )
        .join('\n');
}

function buildTotalsXml(
    nfe,
    items
) {
    const products = items.reduce(
        (
            total,
            item
        ) => (
            total +
            calculateItemValues(item)
                .grossValue
        ),
        0
    );

    const discount = items.reduce(
        (
            total,
            item
        ) => (
            total +
            calculateItemValues(item)
                .discount
        ),
        0
    );

    const freight = Number(
        nfe.total?.valorFrete || 0
    );

    const invoiceTotal =
        products -
        discount +
        freight;

    return `
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>

        <vProd>${decimal(
        products,
        2
    )}</vProd>

        <vFrete>${decimal(
        freight,
        2
    )}</vFrete>

        <vSeg>0.00</vSeg>

        <vDesc>${decimal(
        discount,
        2
    )}</vDesc>

        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>

        <vNF>${decimal(
        invoiceTotal,
        2
    )}</vNF>
      </ICMSTot>
    </total>
  `;
}

function buildDraftNfeXml(
    nfe,
    budget
) {
    const items =
        Array.isArray(nfe.itens)
            ? nfe.itens
            : [];

    const issueDate =
        new Date().toISOString();

    const budgetId = Number(
        budget.budget_id ||
        budget.id
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
    <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe versao="4.00">
        <ide>
          <cUF>31</cUF>
          <cNF>00000000</cNF>
          <natOp>${escapeXml(
        nfe.natureza ||
        'VENDA DE MERCADORIAS'
    )}</natOp>

          <mod>55</mod>
          <serie>0</serie>
          <nNF>0</nNF>

          <dhEmi>${escapeXml(
        issueDate
    )}</dhEmi>

          <tpNF>1</tpNF>
          <idDest>1</idDest>

          <cMunFG>${escapeXml(
        nfe.codigoMunicipioFatoGeradorIbs ||
        nfe.destinatario?.endereco?.codigoCidade ||
        ''
    )}</cMunFG>

          <tpImp>1</tpImp>
          <tpEmis>1</tpEmis>
          <cDV>0</cDV>
          <tpAmb>2</tpAmb>
          <finNFe>1</finNFe>

          <indFinal>${nfe.consumidorFinal
            ? '1'
            : '0'
        }</indFinal>

          <indPres>1</indPres>
          <procEmi>0</procEmi>
          <verProc>CONSART-PREVIEW</verProc>
        </ide>

        ${buildIssuerXml(
            nfe.emitente || {}
        )}

        ${buildRecipientXml(
            nfe.destinatario || {}
        )}

        ${buildItemsXml(
            items
        )}

        ${buildTotalsXml(
            nfe,
            items
        )}

        <transp>
          <modFrete>${escapeXml(
            nfe.transporte?.modalidadeFrete ??
            '9'
        )}</modFrete>
        </transp>

        <pag>
          <detPag>
            <tPag>90</tPag>

            <vPag>${decimal(
            0,
            2
        )}</vPag>
          </detPag>
        </pag>

        <infAdic>
          <infCpl>${escapeXml(
            [
                nfe.informacoesComplementares ||
                budget.notes ||
                '',

                `PRÉ-VISUALIZAÇÃO DO ORÇAMENTO ${budgetId}.`,

                'DOCUMENTO SEM VALOR FISCAL.',
            ]
                .filter(Boolean)
                .join(' | ')
        )}</infCpl>
        </infAdic>
      </infNFe>
    </NFe>
  `;
}

function applyBudgetFiscalOperationToPreview(
    nfe,
    budget
) {
    const operation =
        budget?.fiscal_operation ||
        budget?.operation ||
        null;

    if (!operation) {
        return nfe;
    }

    const natureOperation = String(
        operation.nature_operation ||
        budget.nature_operation ||
        ''
    ).trim();

    const operationCfop = digits(
        operation.cfop ||
        budget.operation_cfop ||
        ''
    ).slice(0, 4);

    const forceCfop = Boolean(
        operation.force_cfop ??
        budget.operation_forces_cfop ??
        false
    );

    return {
        ...nfe,

        ...(natureOperation
            ? { natureza: natureOperation }
            : {}
        ),

        itens:
            Array.isArray(nfe?.itens)
                ? nfe.itens.map((item) => ({
                    ...item,

                    ...(forceCfop && operationCfop.length === 4
                        ? { cfop: operationCfop }
                        : {}
                    ),
                }))
                : [],
    };
}

export async function generateBudgetNfePreviewPdf(
    budget
) {
    const budgetId = Number(
        budget.budget_id ||
        budget.id
    );

    if (
        !Number.isSafeInteger(budgetId) ||
        budgetId <= 0
    ) {
        throw new Error(
            'ID do orçamento inválido.'
        );
    }

    const previewInput = {
        header: {
            ...budget,

            /*
             * Evita que buildNFeFromOrder considere
             * o orçamento como um pedido.
             */
            id: null,
            order_id: null,
            budget_id: budgetId,
            shipping:
                budget.shipping || null,
        },

        items:
            Array.isArray(budget.items)
                ? budget.items
                : [],
    };

    /*
     * Apenas monta os dados.
     * Não chama emitirNFe().
     */
    const builtNfe =
        await buildNFeFromOrder(
            previewInput,
            {
                preview: true,
            },
        );

    const nfe =
        applyBudgetFiscalOperationToPreview(
            builtNfe,
            budget
        );

    const draftXml =
        buildDraftNfeXml(
            nfe,
            budget
        );

    /*
     * Usa o layout já existente do DANFE CONSART.
     */
    const result =
        await generateDanfeFromXml({
            numero:
                String(budgetId),

            serie:
                '0',

            chave:
                '',

            xmlContent:
                draftXml,

            prot: {
                status:
                    'PREVIEW',
            },

            complementaryInfo:
                [
                    nfe.informacoesComplementares ||
                    budget.notes ||
                    '',

                    `PRÉ-VISUALIZAÇÃO DO ORÇAMENTO ${budgetId}.`,

                    'DOCUMENTO SEM VALOR FISCAL.',
                ]
                    .filter(Boolean)
                    .join(' | '),

            orderItems:
                budget.items || [],

            orderPayments:
                budget.payments || [],

            orderInstallments:
                budget.payment_installments || [],

            orderShipping:
                budget.shipping || null,

            preview:
                true,
        });

    console.log(
        '[BUDGET NFE][PREVIEW NUMBER]',
        {
            budgetId,
            nfeNumero: nfe.numero,
            previewNfeNumber:
                Number(nfe.numero) || null,
        },
    );

    return {
        ...result,

        previewNfeNumber:
            Number(nfe.numero) || null,

        filename:
            `DANFE PREVIEW ORCAMENTO ${budgetId}.pdf`,
    };
}

export default {
    generateBudgetNfePreviewPdf,
};