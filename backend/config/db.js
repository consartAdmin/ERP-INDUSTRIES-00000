// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/config/db.js                                                ║
// ║ PostgreSQL Pool — Local / Cloud SQL                                 ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Pool } from "pg";

const DB_MODE = String(process.env.DB_MODE || "local").toLowerCase();

const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME || "";

const isCloudRun =
  !!process.env.K_SERVICE ||
  !!process.env.CLOUD_RUN_JOB ||
  process.env.FORCE_CLOUD_SQL_SOCKET === "true" ||
  DB_MODE === "cloud";

const useCloudSqlSocket =
  isCloudRun &&
  DB_MODE !== "local" &&
  !!INSTANCE_CONNECTION_NAME;

const dbHost = useCloudSqlSocket
  ? `/cloudsql/${INSTANCE_CONNECTION_NAME}`
  : process.env.DB_HOST || "127.0.0.1";

const dbConfig = {
  host: dbHost,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "prodnex",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",

  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 8000),

  ssl: false,
};

const pool = new Pool(dbConfig);

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║ [DB] PostgreSQL Pool — CONSART ERP                          ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("[DB] MODE =", useCloudSqlSocket ? "CLOUD_SQL_SOCKET" : "LOCAL_TCP");
console.log("[DB] DB_MODE =", DB_MODE);
console.log("[DB] HOST =", dbHost);
console.log("[DB] PORT =", dbConfig.port);
console.log("[DB] NAME =", dbConfig.database);
console.log("[DB] USER =", dbConfig.user);
console.log("[DB] CLOUD_RUN =", isCloudRun ? "YES" : "NO");
console.log("[DB] INSTANCE_CONNECTION_NAME =", INSTANCE_CONNECTION_NAME || "(not set)");

pool.on("connect", () => {
  console.log("[DB] ✅ PostgreSQL conectado com sucesso.");
});

pool.on("error", (err) => {
  console.error("[DB] ❌ PostgreSQL Pool Error:", {
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });
});

export async function testDatabaseConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        inet_server_addr() AS host,
        inet_server_port() AS port,
        NOW() AS connected_at
    `);

    console.log("[DB] ✅ Test connection OK:", result.rows[0]);
    return result.rows[0];
  } catch (err) {
    console.error("[DB] ❌ Test connection failed:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });

    throw err;
  } finally {
    client.release();
  }
}

export default pool;