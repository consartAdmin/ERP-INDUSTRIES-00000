// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImagesGenerate.repository.js — generate / preview             ║
// ║ Grava PNG em backend/public/promocoes                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { PROMO_DIR, LOGO_PATH } from './promoImages.constants.js';
import { normalizePriceId, escapeXml, sanitizeFileName } from './promoImages.sanitizers.js';
import { ensureDir, moneyBR, resolvePublicImagePath } from './promoImages.utils.js';
import { getProductForPromo } from './promoImagesQuery.repository.js';
import { createPlaceholderImage, buildPromoImageBuffer } from './promoImagesRender.repository.js';

export async function generatePromoImage({
  price_id = null,
  tabela_preco_id = null,
  product_code,
  title = 'PROMOÇÃO',
  subtitle = 'BH3 Distribuidora',
  old_price = null,
  promo_price = null,
  output_name = '',
} = {}) {
  const finalPriceId = normalizePriceId(price_id ?? tabela_preco_id);

  if (!finalPriceId) {
    const err = new Error('Informe price_id.');
    err.status = 400;
    throw err;
  }

  if (!product_code) {
    const err = new Error('Informe product_code.');
    err.status = 400;
    throw err;
  }

  ensureDir(PROMO_DIR);

  const product = await getProductForPromo({
    price_id: finalPriceId,
    product_code,
  });

  if (!product) {
    const err = new Error('Produto não encontrado para esta tabela de preço.');
    err.status = 404;
    throw err;
  }

  const finalPrice = Number(promo_price || product.price || 0);
  const oldPrice = old_price ? Number(old_price) : null;

  const imagePath = resolvePublicImagePath(product.image_url);

  let productImageBuffer;

  if (imagePath) {

    if (/^https?:\/\//i.test(imagePath)) {

      const response = await axios.get(imagePath, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      productImageBuffer = await sharp(
        Buffer.from(response.data)
      )
        .resize(520, 520, {
          fit: 'contain',
          background: '#ffffff',
        })
        .png()
        .toBuffer();

    } else {

      productImageBuffer = await sharp(imagePath)
        .resize(520, 520, {
          fit: 'contain',
          background: '#ffffff',
        })
        .png()
        .toBuffer();

    }

  } else {

    productImageBuffer = await createPlaceholderImage();

  }

  const logoExists = fs.existsSync(LOGO_PATH);

  const canvasW = 1080;
  const canvasH = 1350;

  const description = escapeXml(product.description || 'Produto');
  const sku = escapeXml(product.product_code);
  const unit = escapeXml(product.unit || 'UN');

  const svg = `
    <svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f4c81"/>
          <stop offset="55%" stop-color="#1368a8"/>
          <stop offset="100%" stop-color="#e5e7eb"/>
        </linearGradient>
      </defs>

      <rect width="1080" height="1350" fill="url(#bg)"/>
      <rect x="60" y="60" width="960" height="1230" rx="42" fill="#ffffff" opacity="0.97"/>
      <rect x="60" y="60" width="960" height="170" rx="42" fill="#0f4c81"/>

      <text x="540" y="165" font-size="74" fill="#ffffff" text-anchor="middle" font-family="Arial" font-weight="900">
        ${escapeXml(title)}
      </text>

      <text x="540" y="285" font-size="32" fill="#334155" text-anchor="middle" font-family="Arial" font-weight="700">
        ${escapeXml(subtitle)}
      </text>

      <rect x="110" y="330" width="860" height="560" rx="36" fill="#f8fafc" stroke="#e2e8f0" stroke-width="3"/>

      <text x="540" y="975" font-size="46" fill="#0f172a" text-anchor="middle" font-family="Arial" font-weight="800">
        ${description.substring(0, 34)}
      </text>

      <text x="540" y="1028" font-size="28" fill="#64748b" text-anchor="middle" font-family="Arial">
        SKU: ${sku} • ${unit}
      </text>

      ${oldPrice
      ? `<text x="540" y="1105" font-size="42" fill="#64748b" text-anchor="middle" font-family="Arial" text-decoration="line-through">
              De ${escapeXml(moneyBR(oldPrice))}
            </text>`
      : ''
    }

      <text x="540" y="${oldPrice ? 1195 : 1155}" font-size="86" fill="#dc2626" text-anchor="middle" font-family="Arial" font-weight="900">
        ${escapeXml(moneyBR(finalPrice))}
      </text>

      <rect x="185" y="1230" width="710" height="52" rx="26" fill="#16a34a"/>
      <text x="540" y="1267" font-size="28" fill="#ffffff" text-anchor="middle" font-family="Arial" font-weight="800">
        Consulte condições e disponibilidade
      </text>
    </svg>
  `;

  const composites = [
    {
      input: Buffer.from(svg),
      top: 0,
      left: 0,
    },
    {
      input: productImageBuffer,
      top: 350,
      left: 280,
    },
  ];

  if (logoExists) {
    const logoBuffer = await sharp(LOGO_PATH)
      .resize(180, 90, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    composites.push({
      input: logoBuffer,
      top: 78,
      left: 80,
    });
  }

  const filenameBase =
    sanitizeFileName(output_name) ||
    `promocao-${sanitizeFileName(product.product_code)}-${Date.now()}`;

  const filename = `${filenameBase}.png`;
  const fullPath = path.join(PROMO_DIR, filename);

  const buffer =
    await buildPromoImageBuffer({
      price_id: finalPriceId,
      product_code,
      title,
      subtitle,
      old_price,
      promo_price,
    });

  await fs.promises.writeFile(
    fullPath,
    buffer
  );

  return {
    ok: true,
    product,
    filename,
    path: fullPath,
    url: `/public/promocoes/${filename}`,
  };
}

export async function previewPromoImage(payload) {

  const buffer =
    await buildPromoImageBuffer(payload);

  return {
    preview:
      `data:image/png;base64,${buffer.toString('base64')}`
  };
}
