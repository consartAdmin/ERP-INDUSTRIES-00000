// controllers/testCertificadoController.js (ESM)

import crypto from 'node:crypto';
import forge from 'node-forge';

import xmlCrypto from 'xml-crypto';
const { SignedXml, xpath } = xmlCrypto;

import { DOMParser } from '@xmldom/xmldom';

/** Normaliza XML (remove BOM e caracteres de controle inválidos) */
function normalizeXml(xml) {
  if (!xml) return xml;
  return String(xml)
    .replace(/\uFEFF/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

/** Lê PFX DER e extrai { privateKey, certificate, meta } */
function parsePfxBuffer(pfxBuf, pass) {
  try {
    if (!Buffer.isBuffer(pfxBuf)) throw new Error('PFX deve ser um Buffer');

    // node-forge trabalha com binary string
    const raw = pfxBuf.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(raw);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pass || '');

    const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];

    if (!keyBags.length || !certBags.length) {
      throw new Error('Chave ou certificado não encontrados no PFX.');
    }

    const keys = keyBags.map(b => ({
      pem: forge.pki.privateKeyToPem(b.key),
      id : b.attributes?.localKeyId?.[0]?.value || null,
    }));

    const certs = certBags.map(b => ({
      pem: forge.pki.certificateToPem(b.cert),
      obj: b.cert,
      id : b.attributes?.localKeyId?.[0]?.value || null,
    }));

    // Pareia por localKeyId quando disponível
    let pair = null;
    for (const k of keys) {
      const m = certs.find(c => c.id && k.id && c.id === k.id);
      if (m) { pair = { privateKey: k.pem, certObj: m.obj, certificate: m.pem }; break; }
    }
    if (!pair) pair = { privateKey: keys[0].pem, certObj: certs[0].obj, certificate: certs[0].pem };

    const certObj = pair.certObj;
    const subject = certObj.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
    const issuer  = certObj.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
    const serialNumber = certObj.serialNumber;
    const notBefore = certObj.validity.notBefore.toISOString();
    const notAfter  = certObj.validity.notAfter.toISOString();

    const keyAlgorithm =
      certObj.signatureOid === forge.pki.oids.sha256WithRSAEncryption ? 'RSA-SHA256' : 'RSA-SHA1';

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
    const thumbprintSha1 = crypto.createHash('sha1')
      .update(Buffer.from(der, 'binary')).digest('hex').toUpperCase();

    const subjectCN = certObj.subject.getField('CN')?.value || '';

    return {
      privateKey: pair.privateKey,
      certificate: pair.certificate,
      meta: { subject, issuer, serialNumber, notBefore, notAfter, keyAlgorithm, thumbprintSha1, subjectCN },
    };
  } catch (e) {
    const msg = /pkcs12FromAsn1/.test(String(e)) ? 'Senha incorreta ou PFX inválido' : e.message;
    throw new Error(msg);
  }
}

/** POST /api/test-certificado/pfx-info */
export async function pfxInfo(req, res) {
  try {
    const pass = (req.body?.pass ?? '');
    const pfx = req.file?.buffer;
    if (!pfx) return res.status(400).json({ error: 'Envie o arquivo PFX em multipart/form-data (campo "pfx").' });
    const { meta } = parsePfxBuffer(pfx, pass);
    return res.json(meta);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

/** POST /api/test-certificado/sign-text */
export async function signText(req, res) {
  try {
    const pass = (req.body?.pass ?? '');
    const payload = req.body?.payload;
    const alg = (String(req.body?.alg || 'sha256').toLowerCase() === 'sha1') ? 'sha1' : 'sha256';

    const pfx = req.file?.buffer;
    if (!pfx) return res.status(400).json({ error: 'Envie o PFX' });
    if (typeof payload !== 'string' || payload.length === 0) {
      return res.status(400).json({ error: 'payload vazio' });
    }

    const { privateKey } = parsePfxBuffer(pfx, pass);
    const signer = crypto.createSign(alg === 'sha256' ? 'RSA-SHA256' : 'RSA-SHA1');
    signer.update(payload, 'utf8');
    const signatureBase64 = signer.sign(privateKey).toString('base64');

    return res.json({ algorithm: alg, signatureBase64 });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

/** POST /api/test-certificado/sign-xml */
export async function signXml(req, res) {
  try {
    const pass = (req.body?.pass ?? '');
    const xml = normalizeXml(req.body?.xml);
    const referenceId = req.body?.referenceId;
    const alg = (String(req.body?.alg || 'sha256').toLowerCase() === 'sha1') ? 'sha1' : 'sha256';

    const pfx = req.file?.buffer;
    if (!pfx) return res.status(400).json({ error: 'Envie o PFX' });
    if (!xml) return res.status(400).json({ error: 'XML vazio' });
    if (!referenceId) return res.status(400).json({ error: 'Reference Id não informado' });

    const { privateKey, certificate } = parsePfxBuffer(pfx, pass);

    // Garante que o elemento com Id exista
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const target = xpath(doc, `//*[@Id='${referenceId}']`);
    if (!target || !target.length) {
      return res.status(400).json({ error: `Elemento com Id='${referenceId}' não encontrado no XML.` });
    }

    const sig = new SignedXml({
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    // Algoritmo de assinatura
    sig.signatureAlgorithm = (alg === 'sha256')
      ? 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
      : 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'; // (corrigido: rsa-sha1)

    // Referência ao elemento com Id
    sig.addReference(
      `#${referenceId}`,
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      (alg === 'sha256')
        ? 'http://www.w3.org/2001/04/xmlenc#sha256'
        : 'http://www.w3.org/2000/09/xmldsig#sha1',
      '', '', '', true
    );

    sig.signingKey = privateKey;
    sig.keyInfoProvider = {
      getKeyInfo: () =>
        `<X509Data><X509Certificate>${
          certificate.replace(/-----[^-]+-----/g, '').replace(/\r?\n/g, '')
        }</X509Certificate></X509Data>`,
    };

    sig.computeSignature(xml);
    const signedXml = sig.getSignedXml();

    return res.json({ algorithm: alg, signedXml });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
