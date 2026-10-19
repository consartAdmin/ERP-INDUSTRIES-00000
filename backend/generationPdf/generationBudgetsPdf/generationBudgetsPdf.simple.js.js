import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetPdfFilename, contentDisposition } from './generationBudgetsPdf.filename.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE = { size: 'A4', layout: 'portrait', margin: 28 };
const COLOR = { text: '#171717', border: '#666666', fill: '#F3F3F3' };

// Emitente solicitado. Os valores ainda podem ser sobrescritos por options.company.
export const DEFAULT_COMPANY = {
    cnpj: '68.123.137/0001-77',
    legalName: 'LLV SOLUCOES COMERCIAIS LTDA',
    tradeName: 'LLV SOLUCOES COMERCIAIS LTDA',
    streetType: 'RUA',
    streetName: 'ARISTIDES NOGUEIRA DE OLIVEIRA',
    streetNumber: '62',
    neighborhood: 'N SRA DO ROSARIO',
    city: 'MATHEUS LEME',
    state: 'MG',
    postalCode: '35670-000',
};

const first = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return '';
};

const number = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

    const raw = String(value).trim();
    const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) => number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const quantity = (value) => number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
});

function dateBR(value) {
    if (!value) return '';

    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

    const parsed = new Date(raw);

    if (Number.isNaN(parsed.getTime())) return raw;

    return new Intl.DateTimeFormat('pt-BR').format(parsed);
}

function sanitizeFilename(value) {
    return String(value || 'ORCAMENTO.pdf').replace(/[\/\\:*?"<>|]+/g, '-');
}

function defaultFilename(budget) {
    return budgetPdfFilename(budget);
}

function itemsOf(budget) {
    return [
        budget?.items,
        budget?.budget_items,
        budget?.budgetItens,
        budget?.budget_itens,
        budget?.itens,
        budget?.rows
    ].find(Array.isArray) || [];
}

function paymentsOf(budget) {
    return [
        budget?.payments,
        budget?.budget_payments,
        budget?.payment_lines,
        budget?.budgetPayments,
        budget?.budgets_payments
    ].find(Array.isArray) || [];
}

function installmentsOf(budget) {
    return [
        budget?.payment_installments,
        budget?.installments,
        budget?.budget_payment_installments,
        budget?.budgetPaymentInstallments,
        budget?.budgets_payment_installments,
        budget?.budgetsPaymentInstallments
    ].find(Array.isArray) || [];
}

function companyAddress(company) {
    const line1 =
        [company.streetType, company.streetName].filter(Boolean).join(' ') +
        (company.streetNumber ? `, ${company.streetNumber}` : '');

    const line2 =
        [company.neighborhood, company.city, company.state].filter(Boolean).join(' - ') +
        (company.postalCode ? ` - CEP: ${company.postalCode}` : '');

    return [line1, line2].filter(Boolean);
}

function customerAddress(budget) {
    const street = [
        first(
            budget?.street_type,
            budget?.tipo_logradouro,
            budget?.address_type
        ),
        first(
            budget?.street_name,
            budget?.logradouro,
            budget?.address,
            budget?.endereco
        )
    ].filter(Boolean).join(' ');

    const no = first(
        budget?.street_number,
        budget?.numero,
        budget?.address_number
    );

    const complement = first(
        budget?.address_complement,
        budget?.complemento,
        budget?.complement
    );

    const line1 =
        `${street}${no ? `, ${no}` : ''}${complement ? ` - ${complement}` : ''}`;

    const line2 = [
        first(
            budget?.neighborhood,
            budget?.bairro,
            budget?.district
        ),
        first(
            budget?.city,
            budget?.cidade
        ),
        first(
            budget?.state,
            budget?.uf,
            budget?.estado
        )
    ].filter(Boolean).join(' - ');

    return {
        line1: line1 || '---',
        line2: line2 || '---',
    };
}

function paymentText(budget) {
    const payments = paymentsOf(budget);

    if (payments.length) {
        return payments.map((payment) => {
            const name = first(
                payment?.payment_method_name,
                payment?.payment_form_name,
                payment?.method_name,
                payment?.name,
                payment?.forma_pagamento,
                'NÃO INFORMADO'
            );

            const amount = number(
                first(
                    payment?.amount,
                    payment?.valor
                )
            );

            const due = dateBR(
                first(
                    payment?.manual_due_date,
                    payment?.due_date,
                    payment?.data_vencimento,
                    payment?.vencimento
                )
            );

            return (
                `${name}` +
                `${amount ? ` - R$ ${money(amount)}` : ''}` +
                `${due ? ` - Venc. ${due}` : ''}`
            );
        }).join(' | ');
    }

    return first(
        budget?.payment_method_name,
        budget?.payment_form_name,
        budget?.forma_pagamento_nome,
        budget?.forma_pagamento,
        budget?.condicao_pagamento,
        '---'
    );
}

function paymentInstallmentsText(budget) {
    const payments = paymentsOf(budget);
    const installments = installmentsOf(budget);

    const lines = [];

    // ============================================================
    // FORMAS DE PAGAMENTO
    // ============================================================

    if (payments.length) {
        lines.push('PAGAMENTO:');

        payments.forEach((payment) => {
            const name = first(
                payment?.payment_method_name,
                payment?.payment_form_name,
                payment?.method_name,
                payment?.name,
                payment?.forma_pagamento,
                'NÃO INFORMADO'
            );

            const amount = number(
                first(
                    payment?.amount,
                    payment?.valor
                )
            );

            const text =
                `${name}` +
                `${amount ? ` - R$ ${money(amount)}` : ''}`;

            lines.push(text);
        });
    } else {
        const fallbackMethod = first(
            budget?.payment_method_name,
            budget?.payment_form_name,
            budget?.forma_pagamento_nome,
            budget?.forma_pagamento,
            budget?.condicao_pagamento
        );

        if (fallbackMethod) {
            lines.push('PAGAMENTO:');
            lines.push(fallbackMethod);
        }
    }

    // ============================================================
    // PARCELAS
    // ============================================================

    if (installments.length) {
        if (lines.length) {
            lines.push('');
        }

        lines.push('PARCELAS:');

        const sorted = [...installments].sort((a, b) => {
            return number(
                first(
                    a?.installment_number,
                    a?.parcela,
                    a?.number,
                    0
                )
            ) - number(
                first(
                    b?.installment_number,
                    b?.parcela,
                    b?.number,
                    0
                )
            );
        });

        const totalInstallments = sorted.length;

        sorted.forEach((installment, index) => {
            const installmentNumber = number(
                first(
                    installment?.installment_number,
                    installment?.parcela,
                    installment?.number,
                    index + 1
                ),
                index + 1
            );

            const dueDate = dateBR(
                first(
                    installment?.due_date,
                    installment?.manual_due_date,
                    installment?.data_vencimento,
                    installment?.vencimento
                )
            );

            const amount = number(
                first(
                    installment?.amount,
                    installment?.valor,
                    installment?.installment_amount
                )
            );

            const methodName = first(
                installment?.payment_method_name,
                installment?.payment_form_name,
                installment?.method_name,
                installment?.name
            );

            let text =
                `${installmentNumber}/${totalInstallments}`;

            if (methodName) {
                text += ` - ${methodName}`;
            }

            if (dueDate) {
                text += ` - Venc. ${dueDate}`;
            }

            text += ` - R$ ${money(amount)}`;

            lines.push(text);
        });
    }

    return lines.join('\n');
}

function freightText(budget) {
    const mode = number(
        first(
            budget?.freight_mode,
            budget?.modalidade_frete,
            budget?.frete_modalidade,
            budget?.shipping_mode
        ),
        NaN
    );

    return ({
        0: 'Emitente',
        1: 'Destinatário',
        2: 'Terceiros',
        9: 'Sem frete'
    })[mode] || '---';
}

function itemValues(item) {
    const qty = number(
        first(
            item?.quantity,
            item?.quantidade,
            item?.qty,
            item?.qtd
        )
    );

    const unitPrice = number(
        first(
            item?.unit_price,
            item?.valor_unitario,
            item?.price,
            item?.valor,
            item?.preco_unitario
        )
    );

    const discount = number(
        first(
            item?.discount_value,
            item?.desconto_valor,
            item?.valor_desconto,
            item?.discount_amount,
            item?.desconto
        )
    );

    const explicitTotal = first(
        item?.total,
        item?.valor_total,
        item?.total_value,
        item?.line_total,
        item?.total_liquido,
        item?.net_total
    );

    const total =
        explicitTotal === ''
            ? Math.max(0, qty * unitPrice - discount)
            : number(explicitTotal);

    return {
        code: first(
            item?.sku,
            item?.product_code,
            item?.codigo,
            item?.code
        ),

        manufacturerRef: first(
            item?.manufacturer_ref,
            item?.manufacturerRef,
            item?.ref_fab,
            item?.refFab,
            item?.referencia_fabricante,
            item?.manufacturer_reference
        ),

        description: first(
            item?.description,
            item?.descricao,
            item?.product_name,
            item?.product_description,
            item?.nome
        ),

        unit: first(
            item?.unit,
            item?.unidade,
            item?.un,
            item?.unit_name
        ),

        qty,
        unitPrice,
        discount,
        total,
    };
}

function totalsOf(budget, calculatedSubtotal) {
    const subtotalRaw = first(
        budget?.subtotal,
        budget?.subtotal_products,
        budget?.subtotal_produtos,
        budget?.products_subtotal,
        budget?.items_subtotal
    );

    const discountRaw = first(
        budget?.total_discount,
        budget?.discount_total,
        budget?.desconto_total,
        budget?.valor_desconto_total,
        budget?.global_discount_amount,
        budget?.discount_amount
    );

    const freightRaw = first(
        budget?.freight_value,
        budget?.valor_frete,
        budget?.frete_valor,
        budget?.frete,
        budget?.shipping_value
    );

    const totalRaw = first(
        budget?.total_amount,
        budget?.total,
        budget?.valor_total,
        budget?.grand_total,
        budget?.final_total
    );

    const subtotal =
        subtotalRaw === ''
            ? calculatedSubtotal
            : number(subtotalRaw);

    const discount = number(discountRaw);
    const freight = number(freightRaw);

    const total =
        totalRaw === ''
            ? Math.max(0, subtotal - discount + freight)
            : number(totalRaw);

    return {
        subtotal,
        discount,
        freight,
        total
    };
}

function line(doc, y, left, right, width = 0.5) {
    doc
        .lineWidth(width)
        .strokeColor(COLOR.border)
        .moveTo(left, y)
        .lineTo(right, y)
        .stroke();
}

function sectionTitle(doc, title, x, y, width) {
    doc.save()
        .rect(x, y, width, 19)
        .fill(COLOR.fill)
        .restore();

    doc
        .rect(x, y, width, 19)
        .lineWidth(0.5)
        .strokeColor(COLOR.border)
        .stroke();

    doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLOR.text)
        .text(
            title,
            x + 7,
            y + 5,
            {
                width: width - 14
            }
        );

    return y + 19;
}

function cells(doc, y, x, widths, values, height = 30) {
    let cursor = x;

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        const width = widths[i];

        doc
            .rect(cursor, y, width, height)
            .lineWidth(0.35)
            .strokeColor(COLOR.border)
            .stroke();

        doc
            .font('Helvetica')
            .fontSize(6.6)
            .fillColor('#555555')
            .text(
                value.label,
                cursor + 5,
                y + 4,
                {
                    width: width - 10,
                    lineBreak: false,
                    ellipsis: true
                }
            );

        doc
            .font(value.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7.8)
            .fillColor(COLOR.text)
            .text(
                value.value || '---',
                cursor + 5,
                y + 15,
                {
                    width: width - 10,
                    height: height - 17,
                    ellipsis: true,
                    lineBreak: false
                }
            );

        cursor += width;
    }

    return y + height;
}

function drawHeader(doc, company, budget) {
    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const width = right - left;

    let y = 25;

    // ============================================================
    // NÚMERO DO ORÇAMENTO
    // ============================================================

    doc
        .font('Helvetica-Bold')
        .fontSize(20) // Size of "ORÇAMENTO Nº"
        .fillColor(COLOR.text)
        .text(
            `ORÇAMENTO Nº ${first(
                budget?.number,
                budget?.budget_number,
                budget?.budget_num,
                budget?.orcamento_num,
                budget?.id,
                '---'
            )}`,
            left,
            y,
            {
                width,
                align: 'center',
                lineBreak: false
            }
        );

    y += 31;

    line(
        doc,
        y,
        left,
        right,
        0.8
    );

    y += 12;

    // Guarda a posição vertical da barra.
    const budgetTitleY = y;

    y = sectionTitle(
        doc,
        'DADOS DO ORÇAMENTO',
        left,
        budgetTitleY,
        width
    );

    // ============================================================
    // DATA DENTRO DA BARRA "DADOS DO ORÇAMENTO"
    // ============================================================

    const budgetDate =
        dateBR(
            first(
                budget?.issue_date,
                budget?.created_at,
                budget?.budget_date
            )
        ) || dateBR(new Date());

    doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR.text)
        .text(
            `Data: ${budgetDate}`,
            left + width * 0.60,
            budgetTitleY + 5,
            {
                width: width * 0.38 - 7,
                align: 'right',
                lineBreak: false
            }
        );

    y = cells(
        doc,
        y,
        left,
        [
            width * 0.23,
            width * 0.31,
            width * 0.23,
            width * 0.23
        ],
        [
            {
                label: 'Vendedor',
                value: first(
                    budget?.seller_name,
                    budget?.vendedor
                )
            },
            {
                label: 'Forma de pagamento',
                value: paymentText(budget)
            },
            {
                label: 'Frete por conta',
                value: freightText(budget)
            },
            {
                label: 'Validade',
                value: first(
                    budget?.validity,
                    budget?.validade,
                    budget?.valid_until
                )
            }
        ],
        31
    );

    y += 7;

    y = sectionTitle(
        doc,
        'DADOS DO CLIENTE',
        left,
        y,
        width
    );

    y = cells(
        doc,
        y,
        left,
        [
            width * 0.46,
            width * 0.24,
            width * 0.30
        ],
        [
            {
                label: 'Nome / Razão Social',
                value: first(
                    budget?.customer_name,
                    budget?.nome_razao_social,
                    budget?.trade_name,
                    budget?.legal_name
                ),
                bold: true
            },
            {
                label: 'CPF / CNPJ',
                value: first(
                    budget?.customer_tax_id,
                    budget?.cnpj_cpf
                )
            },
            {
                label: 'Contato',
                value: first(
                    budget?.contact_name,
                    budget?.contato,
                    budget?.customer_phone,
                    budget?.telefone_cliente,
                    budget?.telefone
                )
            }
        ]
    );

    const address = customerAddress(budget);

    y = cells(
        doc,
        y,
        left,
        [
            width * 0.58,
            width * 0.22,
            width * 0.20
        ],
        [
            {
                label: 'Endereço',
                value: address.line1
            },
            {
                label: 'Bairro',
                value: first(
                    budget?.neighborhood,
                    budget?.bairro,
                    budget?.district
                )
            },
            {
                label: 'CEP',
                value: first(
                    budget?.postal_code,
                    budget?.cep,
                    budget?.zipcode
                )
            }
        ]
    );

    y = cells(
        doc,
        y,
        left,
        [
            width * 0.56,
            width * 0.10,
            width * 0.34
        ],
        [
            {
                label: 'Município',
                value: first(
                    budget?.city,
                    budget?.cidade
                )
            },
            {
                label: 'UF',
                value: first(
                    budget?.state,
                    budget?.uf,
                    budget?.estado
                )
            },
            {
                label: 'E-mail / Telefone',
                value: first(
                    budget?.customer_email,
                    budget?.email_cliente,
                    budget?.email,
                    budget?.customer_phone,
                    budget?.telefone_cliente,
                    budget?.telefone
                )
            }
        ]
    );

    return y + 9;
}

// A4 retrato:
// largura aproximada 595 pt
// margem 28 pt de cada lado => ~539 pt úteis
// soma das colunas abaixo = 539 pt
const TABLE = {
    widths: [
        52,  // Código / SKU
        58,  // Ref.Fab.
        181, // Descrição dos produtos
        38,  // Un.
        45,  // Quant.
        56,  // Vlr. unit.
        51,  // Desconto
        58   // Total
    ],

    headers: [
        'Código',
        'Ref.Fab.',
        'Descrição dos produtos',
        'Un.',
        'Quant.',
        'Vlr. unit.',
        'Desconto',
        'Total'
    ]
};

function drawTableHeader(doc, x, y) {
    let cursor = x;

    TABLE.headers.forEach((header, index) => {
        const width = TABLE.widths[index];

        doc.save()
            .rect(cursor, y, width, 22)
            .fill(COLOR.fill)
            .restore();

        doc
            .rect(cursor, y, width, 22)
            .lineWidth(0.4)
            .strokeColor(COLOR.border)
            .stroke();

        const align =
            index >= 3
                ? 'center'
                : 'left';

        doc
            .font('Helvetica-Bold')
            .fontSize(6.7)
            .fillColor(COLOR.text)
            .text(
                header,
                cursor + 3,
                y + 7,
                {
                    width: width - 6,
                    align,
                    lineBreak: false,
                    ellipsis: true
                }
            );

        cursor += width;
    });

    return y + 22;
}

function drawItemRow(doc, x, y, item) {
    const values = itemValues(item);

    doc
        .font('Helvetica')
        .fontSize(7.2);

    const descHeight =
        doc.heightOfString(
            values.description || '---',
            {
                width: TABLE.widths[2] - 8
            }
        );

    const height =
        Math.max(
            24,
            Math.min(
                44,
                Math.ceil(descHeight + 10)
            )
        );

    const texts = [
        values.code,
        values.manufacturerRef,
        values.description,
        values.unit,
        quantity(values.qty),
        money(values.unitPrice),
        money(values.discount),
        money(values.total)
    ];

    let cursor = x;

    texts.forEach((text, index) => {
        const width = TABLE.widths[index];

        doc
            .rect(cursor, y, width, height)
            .lineWidth(0.3)
            .strokeColor(COLOR.border)
            .stroke();

        let align = 'left';

        if (index === 3) {
            align = 'center';
        }

        if (index >= 4) {
            align = 'right';
        }

        doc
            .font(index === 7 ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7.2)
            .fillColor(COLOR.text)
            .text(
                text || '---',
                cursor + 4,
                y + 7,
                {
                    width: width - 8,
                    height: height - 10,
                    align,
                    ellipsis: true
                }
            );

        cursor += width;
    });

    return {
        bottom: y + height,
        total: values.total,
        qty: values.qty
    };
}

function newItemsPage(doc, company, budget) {
    doc.addPage({
        size: PAGE.size,
        layout: PAGE.layout,
        margin: PAGE.margin
    });

    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;

    let y = 28;

    doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor(COLOR.text)
        .text(
            company.tradeName || company.legalName,
            left,
            y,
            {
                width: (right - left) * 0.62
            }
        );

    doc.text(
        `ORÇAMENTO Nº ${first(
            budget?.number,
            budget?.budget_number,
            budget?.id,
            '---'
        )}`,
        left,
        y,
        {
            width: right - left,
            align: 'right'
        }
    );

    y += 20;

    y = sectionTitle(
        doc,
        'DADOS DOS PRODUTOS',
        left,
        y,
        TABLE.widths.reduce(
            (sum, width) => sum + width,
            0
        )
    );

    return drawTableHeader(
        doc,
        left,
        y
    );
}

function drawSummary(doc, budget, calculatedSubtotal, totalQty, y) {
    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const width = right - left;

    const totals =
        totalsOf(
            budget,
            calculatedSubtotal
        );

    const originalNotes = first(
        budget?.notes,
        budget?.observation,
        budget?.observations,
        budget?.observacao,
        budget?.observacoes
    );

    const paymentDetails = paymentInstallmentsText(budget);

    const notes = [
        originalNotes,
        paymentDetails
    ]
        .filter(Boolean)
        .join('\n\n') || '---';

    const installments = installmentsOf(budget);

    const boxHeight = Math.max(
        100,
        100 + Math.max(0, installments.length - 1) * 13
    );

    if (
        y + boxHeight >
        doc.page.height - PAGE.margin
    ) {
        doc.addPage({
            size: PAGE.size,
            layout: PAGE.layout,
            margin: PAGE.margin
        });

        y = PAGE.margin;
    }

    const notesW = width * 0.57;
    const gap = 10;

    const totalsX =
        left + notesW + gap;

    const totalsW =
        width - notesW - gap;

    doc
        .rect(
            left,
            y,
            notesW,
            boxHeight
        )
        .lineWidth(0.5)
        .strokeColor(COLOR.border)
        .stroke();

    doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
            'OBSERVAÇÕES',
            left + 7,
            y + 7
        );

    doc
        .font('Helvetica')
        .fontSize(8)
        .text(
            notes,
            left + 7,
            y + 23,
            {
                width: notesW - 14,
                height: boxHeight - 30,
                ellipsis: true
            }
        );

    doc
        .rect(
            totalsX,
            y,
            totalsW,
            boxHeight
        )
        .lineWidth(0.5)
        .strokeColor(COLOR.border)
        .stroke();

    const rows = [
        [
            'Quantidade total',
            quantity(totalQty),
            false
        ],
        [
            'Subtotal',
            `R$ ${money(totals.subtotal)}`,
            false
        ],
        [
            'Desconto',
            `R$ ${money(totals.discount)}`,
            false
        ],
        [
            'Frete',
            `R$ ${money(totals.freight)}`,
            false
        ],
        [
            'TOTAL DO ORÇAMENTO',
            `R$ ${money(totals.total)}`,
            true
        ]
    ];

    rows.forEach(([label, value, bold], index) => {
        const rowY =
            y + 7 + index * 18;

        doc
            .font(
                bold
                    ? 'Helvetica-Bold'
                    : 'Helvetica'
            )
            .fontSize(
                bold
                    ? 9.5
                    : 8.2
            )
            .text(
                label,
                totalsX + 8,
                rowY,
                {
                    width: totalsW * 0.60
                }
            );

        doc.text(
            value,
            totalsX + totalsW * 0.58,
            rowY,
            {
                width: totalsW * 0.38 - 8,
                align: 'right'
            }
        );
    });
}

function finalize(doc, output, dir, filename, fileStream, chunks) {
    if (
        output === 'response' ||
        output === 'stream'
    ) {
        return Promise.resolve();
    }

    if (output === 'file') {
        const fullPath =
            path.join(
                dir,
                sanitizeFilename(filename)
            );

        return new Promise((resolve, reject) => {
            fileStream.on(
                'finish',
                () => resolve(fullPath)
            );

            fileStream.on(
                'error',
                reject
            );
        });
    }

    return new Promise(
        (resolve) =>
            doc.on(
                'end',
                () =>
                    resolve(
                        Buffer.concat(chunks)
                    )
            )
    );
}

export async function generateBudgetPdf(
    budget = {},
    options = {}
) {
    const {
        company: companyOverride = {},
        output = 'response',
        res = null,
        stream = null,
        filename = defaultFilename(budget),
        dir = path.resolve(
            __dirname,
            '../../public/pdfs'
        )
    } = options;

    const company = {
        ...DEFAULT_COMPANY,
        ...companyOverride
    };

    const doc =
        new PDFDocument({
            size: PAGE.size,
            layout: PAGE.layout,
            margin: PAGE.margin,
            info: { Title: filename.replace(/\.pdf$/i, '') }
        });

    const chunks = [];
    let fileStream = null;

    if (output === 'response') {
        if (!res?.setHeader) {
            throw new Error(
                'Para output="response", informe { res }.'
            );
        }

        res.setHeader(
            'Content-Type',
            'application/pdf'
        );

        res.setHeader(
            'Content-Disposition',
            contentDisposition(filename)
        );

        doc.pipe(res);

    } else if (output === 'file') {
        fs.mkdirSync(
            dir,
            {
                recursive: true
            }
        );

        fileStream =
            fs.createWriteStream(
                path.join(
                    dir,
                    sanitizeFilename(filename)
                )
            );

        doc.pipe(fileStream);

    } else if (output === 'stream') {
        const writable =
            stream || res;

        if (!writable?.write) {
            throw new Error(
                'Para output="stream", informe { stream } ou { res }.'
            );
        }

        doc.pipe(writable);

    } else {
        doc.on(
            'data',
            (chunk) =>
                chunks.push(chunk)
        );
    }

    const left =
        PAGE.margin;

    const tableWidth =
        TABLE.widths.reduce(
            (sum, width) =>
                sum + width,
            0
        );

    let y =
        drawHeader(
            doc,
            company,
            budget
        );

    y =
        sectionTitle(
            doc,
            'DADOS DOS PRODUTOS',
            left,
            y,
            tableWidth
        );

    y =
        drawTableHeader(
            doc,
            left,
            y
        );

    let calculatedSubtotal = 0;
    let totalQty = 0;

    const items =
        itemsOf(budget);

    if (!items.length) {
        doc
            .rect(
                left,
                y,
                tableWidth,
                28
            )
            .lineWidth(0.3)
            .strokeColor(COLOR.border)
            .stroke();

        doc
            .font('Helvetica')
            .fontSize(8.5)
            .text(
                'Nenhum item informado.',
                left + 6,
                y + 9,
                {
                    width:
                        tableWidth - 12,
                    align: 'center'
                }
            );

        y += 28;

    } else {
        for (const item of items) {
            const preview =
                itemValues(item);

            doc
                .font('Helvetica')
                .fontSize(7.2);

            const estimatedHeight =
                Math.max(
                    24,
                    Math.min(
                        44,
                        Math.ceil(
                            doc.heightOfString(
                                preview.description || '---',
                                {
                                    width:
                                        TABLE.widths[2] - 8
                                }
                            ) + 10
                        )
                    )
                );

            if (
                y + estimatedHeight >
                doc.page.height -
                PAGE.margin -
                116
            ) {
                y =
                    newItemsPage(
                        doc,
                        company,
                        budget
                    );
            }

            const drawn =
                drawItemRow(
                    doc,
                    left,
                    y,
                    item
                );

            y =
                drawn.bottom;

            calculatedSubtotal +=
                drawn.total;

            totalQty +=
                drawn.qty;
        }
    }

    drawSummary(
        doc,
        budget,
        calculatedSubtotal,
        totalQty,
        y + 10
    );

    doc.end();

    return finalize(
        doc,
        output,
        dir,
        filename,
        fileStream,
        chunks
    );
}

export default {
    generateBudgetPdf,
    DEFAULT_COMPANY
};
