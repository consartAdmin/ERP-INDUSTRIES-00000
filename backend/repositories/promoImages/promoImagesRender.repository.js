// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImagesRender.repository.js — Placeholder e buffer da imagem   ║
// ║ (sharp + axios)                                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';
import { LOGO_PATH } from './promoImages.constants.js';
import { normalizePriceId, escapeXml } from './promoImages.sanitizers.js';
import { resolvePublicImagePath } from './promoImages.utils.js';
import { getProductForPromo } from './promoImagesQuery.repository.js';

export async function createPlaceholderImage() {
  return sharp({
    create: {
      width: 520,
      height: 520,
      channels: 4,
      background: '#f3f4f6',
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="520" height="520" xmlns="http://www.w3.org/2000/svg">
            <rect width="520" height="520" fill="#f3f4f6"/>
            <text x="260" y="250" font-size="34" fill="#9ca3af" text-anchor="middle" font-family="Arial">SEM IMAGEM</text>
          </svg>
        `),
      },
    ])
    .png()
    .toBuffer();
}

export async function buildPromoImageBuffer({
  price_id = null,
  tabela_preco_id = null,
  product_code,
  title = 'PROMOÇÃO',
  subtitle = 'BH3 Distribuidora',
  old_price = null,
  promo_price = null,
} = {}) {

  const finalPriceId =
    normalizePriceId(price_id ?? tabela_preco_id);

  const product = await getProductForPromo({
    price_id: finalPriceId,
    product_code,
  });

  if (!product) {
    throw new Error(
      'Produto não encontrado para esta tabela de preço.'
    );
  }

  const finalPrice =
    Number(promo_price || product.price || 0);

  const oldPriceValue =
    old_price ? Number(old_price) : null;

  const imagePath =
    resolvePublicImagePath(product.image_url);

  let productImageBuffer;

  try {

    if (imagePath) {

      if (/^https?:\/\//i.test(imagePath)) {

        const response =
          await axios.get(imagePath, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });

        productImageBuffer =
          await sharp(
            Buffer.from(response.data)
          )
            .resize(520, 520, {
              fit: 'contain',
              background: '#ffffff',
            })
            .png()
            .toBuffer();

      } else {

        productImageBuffer =
          await sharp(imagePath)
            .resize(520, 520, {
              fit: 'contain',
              background: '#ffffff',
            })
            .png()
            .toBuffer();

      }

    } else {

      productImageBuffer =
        await createPlaceholderImage();

    }

  } catch {

    productImageBuffer =
      await createPlaceholderImage();

  }

  const logoExists =
    fs.existsSync(LOGO_PATH);

  const canvasW = 1080;
  const canvasH = 1350;

  const description =
    escapeXml(product.description || 'Produto');

  const sku =
    escapeXml(product.product_code);

  const unit =
    escapeXml(product.unit || 'UN');

  const svg = `SEU SVG ATUAL AQUI`;

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

    const logoBuffer =
      await sharp(LOGO_PATH)
        .resize(180, 90, {
          fit: 'contain',
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 0,
          },
        })
        .png()
        .toBuffer();

    composites.push({
      input: logoBuffer,
      top: 78,
      left: 80,
    });

  }

  return await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
