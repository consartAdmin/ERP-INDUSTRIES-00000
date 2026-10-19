// ╔══════════════════════════════════════════════════════════════════╗
// ║ defaultSignature.js — Email Signature Template (ESM)             ║
// ║ CONSART ERP • BH3 Distribuidora                                  ║
// ║ Centralizes BH3 signature + helpers                              ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Single source of truth for BH3 signature data
 */
export const BH3_SIGNATURE_PROFILE = Object.freeze({
  name: 'Renato Moreira',
  role: 'CEO — BH3 Distribuidora de Produtos de Limpeza',
  phone: '(31) 3566-0070 / 3566-8888',
  whatsapp: '(31) 98467-6552',
  email: 'vendas1@bh3distribuidora.com.br',
  site: 'https://www.bh3distribuidora.com.br',
});

/**
 * CID used to embed the logo inline in the email.
 * smtpHostingerClient.js will attach an image using this CID.
 */
export const BH3_LOGO_CID = 'bh3-logo';

/**
 * Build the HTML signature for outgoing emails
 * @param {object} overrides - allows overriding some fields per email/user
 * @returns {string}
 */
export function getSignatureHTML(overrides = {}) {
  const data = { ...BH3_SIGNATURE_PROFILE, ...overrides };
  const { name, role, phone, whatsapp, email, site } = data;

  const logoUrl = `cid:${BH3_LOGO_CID}`;

  return `
<div style="font-family: Arial, sans-serif; padding-top: 16px; border-top: 1px solid #e3e3e3; margin-top: 28px;">

  <!-- FIXED WIDTH table to prevent Gmail from stretching -->
  <table style="width: 480px; border-collapse: collapse;">
    <tr>

      <!-- LEFT BLOCK -->
      <td style="vertical-align: top; padding-right: 16px;">

        <div style="font-size: 17px; font-weight: bold; color: #1a237e;">
          ${name}
        </div>

        <div style="font-size: 14px; color: #444; margin-bottom: 8px;">
          ${role}
        </div>

        <div style="font-size: 14px; color: #333; line-height: 1.45;">
          <strong>📞 Telefone:</strong> ${phone}<br>
          <strong>📱 WhatsApp:</strong> ${whatsapp}<br>
          <strong>✉️ E-mail:</strong> ${email}<br>
          <strong>🌐 Site:</strong>
            <a href="${site}" style="color:#1a4beb; text-decoration:none;">
              ${site}
            </a>
        </div>

        <div style="font-size: 12px; color: #888; margin-top: 10px;">
          AV. BIAS FORTES 784, LOURDES — Belo Horizonte — MG<br>
          CNPJ: 34.363.337/0001-85
        </div>

      </td>

      <!-- RIGHT LOGO BLOCK (beside signature) -->
      <td style="vertical-align: middle; padding-left: 0;">
        <img src="${logoUrl}"
             alt="BH3 Logo"
             style="width: 120px; display: block;" />
      </td>

    </tr>
  </table>

</div>
`;
}

/**
 * Build the TEXT version signature (fallback for plain-text emails)
 * @param {object} overrides
 * @returns {string}
 */
export function getSignatureTEXT(overrides = {}) {
  const data = {
    ...BH3_SIGNATURE_PROFILE,
    ...overrides,
  };

  const {
    name,
    role,
    phone,
    whatsapp,
    email,
    site,
  } = data;

  return `
${name}
${role}

Telefone: ${phone}
WhatsApp: ${whatsapp}
E-mail: ${email}
Site: ${site}

AV. BIAS FORTES 784, LOURDES — Belo Horizonte — MG
CNPJ: 34.363.337/0001-85
  `.trim();
}

/**
 * Helper: receives baseText/baseHtml and returns finalHtml/finalText
 * already with BH3 signature appended.
 *
 * @param {object} params
 * @param {string|null} params.baseText
 * @param {string|null} params.baseHtml
 * @param {string} [params.from] - optional "from" e-mail to inject in signature
 * @returns {{ html: string, text: string }}
 */
export function buildEmailWithSignature({ baseText, baseHtml, from }) {
  // if from is provided, override only the e-mail field in the profile
  const overrides = from ? { email: from } : {};

  const htmlSignature = getSignatureHTML(overrides);
  const textSignature = getSignatureTEXT(overrides);

  const finalHtml = baseHtml
    ? `${baseHtml}${htmlSignature}`
    : `<p>${(baseText || '').replace(/\n/g, '<br>')}</p>${htmlSignature}`;

  const finalText = `${baseText || ''}\n\n${textSignature}`;

  return { html: finalHtml, text: finalText };
}
