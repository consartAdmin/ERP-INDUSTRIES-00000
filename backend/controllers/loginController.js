// ╔══════════════════════════════════════════════════════════════════╗
// ║ loginController.js — Autenticação JWT (tabela `users`)          ║
// ║ Padrão ESM + Postgres + bcrypt + JWT                            ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 🔐 Chave secreta (recomenda-se definir JWT_SECRET no .env)
//const SECRET_KEY = process.env.JWT_SECRET || "chave_secreta_segura";

export async function login(req, res) {
  const { login, password } = req.body || {};

  console.log(`\n[LOGIN] 🟡 Tentativa de login → "${login}"`);

  if (!login || !password) {
    console.warn("[LOGIN] ⚠️ Login ou senha ausentes");
    return res.status(400).json({ erro: "Login e senha são obrigatórios." });
  }

  try {
    // 🔎 Busca por name OU email (case-insensitive)
    const query = `
      SELECT
        user_id AS id,
        name,
        email,
        password_hash,
        access_level,
        is_active
      FROM public.users
      WHERE LOWER(name) = LOWER($1)
         OR LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    const result = await pool.query(query, [login]);

    if (result.rowCount === 0) {
      console.warn(`[LOGIN] ❌ Usuário "${login}" não encontrado.`);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const user = result.rows[0];

    // ⚠️ Verifica se o usuário está ativo
    if (!user.is_active) {
      console.warn(`[LOGIN] 🚫 Usuário "${login}" inativo.`);
      return res.status(403).json({ erro: "Usuário inativo." });
    }

    // 🔐 Verifica a senha
    const senhaOk = await bcrypt.compare(password, user.password_hash);
    if (!senhaOk) {
      console.warn(`[LOGIN] ❌ Senha incorreta para "${login}".`);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // 🧩 Monta payload JWT
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      access_level: user.access_level,
    };

    // ⏱ Tempo de expiração configurado (ex: 2h)
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '2h',
    });

    // Decodifica só para calcular datas amigáveis (não é verificação)
    const decoded = jwt.decode(token);
    let expiresAt = null;
    let expiresInSeconds = null;

    if (decoded && decoded.exp) {
      const nowSec = Math.floor(Date.now() / 1000);
      expiresAt = new Date(decoded.exp * 1000).toISOString();
      expiresInSeconds = decoded.exp - nowSec;
    }

    console.log(
      `[LOGIN] ✅ Acesso autorizado → ${user.name} (${user.access_level}) | expira em: ${expiresAt}`
    );

    // ✅ Resposta final
    return res.json({
      ok: true,
      token,
      user: payload,
      expiresAt,        // opcional: ISO string
      expiresInSeconds, // opcional: segundos restantes
    });
  } catch (err) {
    console.error("[LOGIN] 💥 Erro interno ao processar login:", err.message);
    console.error("[LOGIN] 📄 Stack Trace:", err.stack);

    return res.status(500).json({
      erro: "Erro interno ao processar o login.",
      detalhe: err.message,
    });
  }
}

export default { login };
