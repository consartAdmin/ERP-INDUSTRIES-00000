// ╔══════════════════════════════════════════════════════════════════╗
// ║ controllers/xmlSchemaController.js – Validação XML (xsd|wasm)   ║
// ║ • Evita crash: import dinâmico de xsd-schema-validator           ║
// ║ • "auto" prioriza WASM; "xsd" tenta dinâmico e cai p/ WASM      ║
// ╚══════════════════════════════════════════════════════════════════╝

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { validateXML as validateWithWasm } from "xmllint-wasm";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────
const SCHEMA_BASE_DIR = path.join(process.cwd(), "schemas");

// aliases usados pela UI (ajuste os nomes conforme sua pasta)
const SCHEMA_ALIAS = {
  auto: null,
  NFe: "nfe_v4.00.xsd",
  nfeProc: "procNFe_v4.00.xsd",
  distDFe: "distDFeInt_v1.01.xsd",
  // adicione outros aliases que existirão em /schemas
};

// cache de listagem de .xsd (nome → caminho)
let _xsdIndex = null;
async function indexXsds() {
  if (_xsdIndex) return _xsdIndex;
  const files = await fs.readdir(SCHEMA_BASE_DIR, { withFileTypes: true });
  const map = new Map();
  for (const ent of files) {
    if (ent.isFile() && ent.name.toLowerCase().endsWith(".xsd")) {
      map.set(ent.name, path.join(SCHEMA_BASE_DIR, ent.name));
    }
  }
  _xsdIndex = map;
  return map;
}

// (Opcional) leitor recursivo (subpastas) — comente se não quiser:
async function loadSchemasMapRecursive(dir) {
  const schemas = {};
  async function walk(d) {
    let entries = [];
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const fpath = path.join(d, ent.name);
      if (ent.isDirectory()) { await walk(fpath); continue; }
      if (ent.isFile() && ent.name.toLowerCase().endsWith(".xsd")) {
        schemas[ent.name] = await fs.readFile(fpath, "utf8");
      }
    }
  }
  await walk(dir);
  return schemas;
}

function streamFromString(s) {
  return Readable.from([Buffer.from(String(s))]);
}

// Normaliza entrada “xml” para tipos aceitos pelo xsd-schema-validator
function normalizeXmlInput(xmlRaw) {
  if (!xmlRaw) return null;

  if (typeof xmlRaw === "string") return xmlRaw;           // 1) String
  if (Buffer.isBuffer(xmlRaw)) return xmlRaw;              // 2) Buffer
  if (typeof xmlRaw === "object" && xmlRaw.file && typeof xmlRaw.file === "string") {
    return { file: xmlRaw.file };                          // 3) { file }
  }
  if (typeof xmlRaw === "object" && typeof xmlRaw.base64 === "string") {
    try { return Buffer.from(xmlRaw.base64, "base64"); } catch { return null; } // 4) base64
  }
  if (typeof xmlRaw === "object" && typeof xmlRaw.content === "string") {
    return xmlRaw.content;                                 // 5) { content }
  }
  if (typeof xmlRaw === "object" && typeof xmlRaw.read === "function") {
    return xmlRaw;                                         // 6) Readable
  }
  return null;
}

// 🔒 Normaliza schema vindo do cliente para **string**
function normalizeSchemaRef(schemaRefRaw) {
  if (schemaRefRaw == null) return "auto";
  if (typeof schemaRefRaw === "string") return schemaRefRaw;

  if (typeof schemaRefRaw === "object") {
    if (typeof schemaRefRaw.file  === "string") return schemaRefRaw.file;
    if (typeof schemaRefRaw.value === "string") return schemaRefRaw.value;
    if (typeof schemaRefRaw.name  === "string") return schemaRefRaw.name;
    if (Array.isArray(schemaRefRaw) && schemaRefRaw.length > 0) {
      const first = schemaRefRaw.find(v => typeof v === "string");
      if (first) return first;
    }
  }
  return String(schemaRefRaw);
}

// Resolve XSD a partir de alias, nome, ou caminho absoluto (argumento **string**)
async function resolveXsdSource(aliasOrNameRaw) {
  const key = normalizeSchemaRef(aliasOrNameRaw);   // força string
  const idx = await indexXsds();

  if (!key || key === "auto") {
    const def = SCHEMA_ALIAS.NFe;
    const p = idx.get(def);
    if (!p) throw new Error(`XSD default (${def}) não encontrado em ${SCHEMA_BASE_DIR}`);
    return { file: p };
  }

  if (SCHEMA_ALIAS[key]) {
    const f = SCHEMA_ALIAS[key];
    const p = idx.get(f);
    if (!p) throw new Error(`Alias "${key}" aponta para "${f}", mas o arquivo não foi achado.`);
    return { file: p };
  }

  if (idx.has(key)) return { file: idx.get(key) };
  if (path.isAbsolute(key)) return { file: key };

  return { file: path.join(SCHEMA_BASE_DIR, key) };
}

// Import dinâmico e opcional — evita crash sem o pacote
async function getXsdValidatorOrNull() {
  try {
    const mod = await import("xsd-schema-validator");
    return mod?.default || mod; // algumas distros exportam default
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// HTTP HANDLERS
// ────────────────────────────────────────────────────────────

export async function availableSchemasHttp(_req, res) {
  try {
    const idx = await indexXsds();
    const list = [...idx.keys()].sort();
    res.json({
      ok: true,
      baseDir: SCHEMA_BASE_DIR,
      count: list.length,
      files: list,
      aliases: SCHEMA_ALIAS,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

/**
 * POST /api/validar-xml  (ou conforme seu prefixo)
 * Aceita:
 *  - Content-Type: application/xml | text/xml → body como string
 *  - JSON: { xml: (string|buffer base64|{file}|{content}), schema: (alias|arquivo|caminho|objeto), engine?: "xsd"|"wasm"|"auto" }
 */
export async function validarXmlHttp(req, res) {
  const startedAt = Date.now();
  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();

    let xmlInput = null;
    let schemaRef = null;
    let engine = "auto"; // xsd | wasm | auto

    if (ct.includes("application/xml") || ct.includes("text/xml")) {
      xmlInput = req.body; // express.text() precisa estar ativo p/ esta rota
      schemaRef = (req.query.schema || req.headers["x-schema"] || "auto");
      engine = (req.query.engine || req.headers["x-engine"] || "auto");
    } else {
      const { xml, schema, engine: eng } = req.body || {};
      xmlInput = normalizeXmlInput(xml);
      schemaRef = normalizeSchemaRef(schema); // evita [object Object]
      engine = eng || "auto";
    }

    if (!xmlInput) {
      return res.status(400).json({
        ok: false,
        error:
          "Payload inválido: envie 'application/xml' no corpo OU JSON { xml: <String|Buffer|{file}|{base64}>, schema?: <alias|arquivo>, engine?: 'xsd'|'wasm'|'auto' }",
      });
    }

    const xsdSource = await resolveXsdSource(schemaRef);
    const xsdPath = xsdSource?.file;
    if (typeof xsdPath !== "string" || xsdPath.includes("[object Object]")) {
      return res.status(400).json({
        ok: false,
        error: `Schema inválido: "${String(xsdPath)}"`,
        hint: "Envie 'schema' como string (alias ou nome do arquivo) ou {file: '.../meu.xsd'}",
      });
    }

    // Estratégia de engine:
    // - 'auto': prioriza WASM (não exige binários no container)
    // - 'xsd': tenta usar xsd-schema-validator; se ausente, cai p/ WASM
    const wantXsd = engine === "xsd";
    const preferWasm = engine === "wasm" || engine === "auto";

    // 1) WASM direto (auto/wasm)
    if (preferWasm && !wantXsd) {
      const xmlStr = Buffer.isBuffer(xmlInput)
        ? xmlInput.toString("utf8")
        : (typeof xmlInput === "object" && xmlInput.file)
          ? await fs.readFile(xmlInput.file, "utf8")
          : String(xmlInput);

      // Carrega todos os XSDs (recursivo) para resolver import/include
      const schemaMap = await loadSchemasMapRecursive(SCHEMA_BASE_DIR);
      const mainXsdStr = await fs.readFile(xsdPath, "utf8");

      const wasmRes = await validateWithWasm({
        xml: xmlStr,
        schema: mainXsdStr,
        schemaMap, // ajuda na resolução de include/import
      });
      const isValid = !wasmRes?.errors || wasmRes.errors.length === 0;

      return res.status(200).json({
        ok: isValid,
        engine: "wasm",
        schema: { file: xsdPath },
        messages: isValid ? [] : wasmRes.errors,
        ms: Date.now() - startedAt,
      });
    }

    // 2) Tentar XSD (dinâmico). Se não existir, fallback p/ WASM.
    const xsdValidator = await getXsdValidatorOrNull();
    if (xsdValidator) {
      const xmlForValidator =
        (typeof xmlInput === "object" && xmlInput?.file)
          ? { file: xmlInput.file }  // mantém resolução de includes no disco
          : xmlInput;                // string | Buffer | Stream

      try {
        const result = await xsdValidator.validateXML(xmlForValidator, xsdPath);
        return res.status(200).json({
          ok: result.valid,
          engine: "xsd",
          schema: { file: xsdPath },
          messages: result.valid ? [] : (result.messages || []),
          ms: Date.now() - startedAt,
        });
      } catch (e) {
        if (e && e.valid === false && Array.isArray(e.messages)) {
          return res.status(200).json({
            ok: false,
            engine: "xsd",
            schema: { file: xsdPath },
            messages: e.messages,
            ms: Date.now() - startedAt,
          });
        }
        // se deu erro "real" no engine XSD, tenta WASM como fallback
      }
    }

    // 3) Fallback WASM (quando engine=xsd mas pacote não existe)
    {
      const xmlStr = Buffer.isBuffer(xmlInput)
        ? xmlInput.toString("utf8")
        : (typeof xmlInput === "object" && xmlInput.file)
          ? await fs.readFile(xmlInput.file, "utf8")
          : String(xmlInput);

      const schemaMap = await loadSchemasMapRecursive(SCHEMA_BASE_DIR);
      const mainXsdStr = await fs.readFile(xsdPath, "utf8");

      const wasmRes = await validateWithWasm({
        xml: xmlStr,
        schema: mainXsdStr,
        schemaMap,
      });
      const isValid = !wasmRes?.errors || wasmRes.errors.length === 0;

      return res.status(200).json({
        ok: isValid,
        engine: "wasm-fallback",
        schema: { file: xsdPath },
        messages: isValid ? [] : wasmRes.errors,
        ms: Date.now() - startedAt,
        hint: "xsd-schema-validator não encontrado; usando WASM como fallback",
      });
    }

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
      stack: process.env.NODE_ENV === "production" ? undefined : String(err?.stack || ""),
    });
  }
}
