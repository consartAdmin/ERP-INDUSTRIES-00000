// backend/controllers/nfeDebugController.js
import { Storage } from "@google-cloud/storage";
import https from "https";
import fs from "fs";
import path from "path";

const CERTS_DIR = process.env.CERTS_DIR || "/tmp/certs";
const storage = new Storage(); // usa credencial padrão do Cloud Run

async function loadPfxBuffer() {
  const { NFE_CERT_BUCKET, NFE_CERT_OBJECT, NFE_CERT_PATH } = process.env;
  if (NFE_CERT_BUCKET && NFE_CERT_OBJECT) {
    const tmpPath = path.join(CERTS_DIR, "nfe_a1.pfx");
    await fs.promises.mkdir(CERTS_DIR, { recursive: true });
    const [buf] = await storage.bucket(NFE_CERT_BUCKET).file(NFE_CERT_OBJECT).download();
    await fs.promises.writeFile(tmpPath, buf);
    return { buf, origin: `gs://${NFE_CERT_BUCKET}/${NFE_CERT_OBJECT}`, tmpPath };
  }
  if (NFE_CERT_PATH && fs.existsSync(NFE_CERT_PATH)) {
    const buf = await fs.promises.readFile(NFE_CERT_PATH);
    return { buf, origin: NFE_CERT_PATH, tmpPath: NFE_CERT_PATH };
  }
  throw new Error("Certificado não encontrado (ENV).");
}

export const debugCertCheck = async (req, res) => {
  try {
    const { buf, origin, tmpPath } = await loadPfxBuffer();
    res.json({
      ok: true,
      mode: process.env.NFE_CERT_BUCKET ? "gcs" : "file",
      origin,
      size: buf.length,
      tmpPathExists: fs.existsSync(tmpPath),
      contentType: "application/x-pkcs12",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// Faz apenas o handshake TLS mTLS com client cert (não chama SOAP).
export const debugHandshakeTls = async (req, res) => {
  try {
    const passphrase = process.env.NFE_CERT_PASSWORD;
    if (!passphrase) throw new Error("NFE_CERT_PASSWORD não definido");

    const { buf } = await loadPfxBuffer();

    // Usa um host público que aceite mTLS de teste.
    // Para NFe, você pode apontar para o endpoint de STATUS da sua UF/SVRS (homologação).
    // Exemplo (SVRS H): sefaz.se.gov.br costuma exigir mTLS nos serviços NFe.
    const options = {
      host: "hom.sefazvirtual.fazenda.gov.br", // ajuste p/ seu provedor (SVRS/MG/SVAN…)
      port: 443,
      method: "GET",
      path: "/", // não importa; queremos só o handshake
      agent: new https.Agent({ pfx: buf, passphrase, rejectUnauthorized: false, keepAlive: true }),
      timeout: 8000,
    };

    const reqHttps = https.request(options, (resp) => {
      res.json({
        ok: true,
        statusCode: resp.statusCode,
        cipher: resp.socket.getCipher?.(),
        protocol: resp.socket.getProtocol?.(),
        authorized: resp.socket.authorized,
        authorizationError: resp.socket.authorizationError || null,
      });
    });

    reqHttps.on("error", (e) => res.status(502).json({ ok: false, error: String(e) }));
    reqHttps.end();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// Mock simples para checar wiring da rota de status
export const debugStatusMock = async (_req, res) => {
  res.json({ ok: true, note: "Rota de status disponível (implementar chamada SOAP real aqui)." });
};
