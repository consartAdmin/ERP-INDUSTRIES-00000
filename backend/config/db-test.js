// ╔══════════════════════════════════════════════════════════════╗
// ║ db-test.js — Teste de conexão PostgreSQL (CONSART ERP)       ║
// ╚══════════════════════════════════════════════════════════════╝

import "dotenv/config";
import pool from "./db.js";

async function testConnection() {
  try {
    console.log("🔄 Testando conexão com o banco...");

    const result = await pool.query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        inet_server_addr() AS host,
        inet_server_port() AS port,
        NOW() AS server_time
    `);

    console.log("✅ Conectado com sucesso!");
    console.table(result.rows);
  } catch (err) {
    console.error("❌ Erro na conexão:");
    console.error(err);
  } finally {
    await pool.end();
  }
}

testConnection();