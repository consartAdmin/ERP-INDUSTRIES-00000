// routes/sessionConfig.js (ESM, com fallback)
import { Router } from "express";

const router = Router();

// Defaults bem conservadores (minutos)
let cfg = {
  ok: true,
  idleMinutes: Number(process.env.SESSION_IDLE_MIN || 30),
  warningMinutes: Number(process.env.SESSION_WARN_MIN || 3),
};

// Tenta carregar controller “real” (opcional)
let ctrl = null;
for (const rel of ["../Controllers/sessionConfigController.js", "../controllers/sessionConfigController.js"]) {
  try {
    const mod = await import(new URL(rel, import.meta.url));
    ctrl = mod.default ?? mod;
    console.log(`[sessionConfig] controller carregado de ${rel}`);
    break;
  } catch {}
}

if (!ctrl) {
  console.warn("[sessionConfig] controller real não encontrado. Usando fallback em memória.");
  ctrl = {
    getSessionConfig: (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.json(cfg);
    },
    putSessionConfig: (req, res) => {
      const b = req.body ?? {};
      const idle = Number(b.idleMinutes);
      const warn = Number(b.warningMinutes);
      if (Number.isFinite(idle) && idle > 0) cfg.idleMinutes = idle;
      if (Number.isFinite(warn) && warn > 0 && warn < cfg.idleMinutes) cfg.warningMinutes = warn;
      cfg.ok = true;
      res.set("Cache-Control", "no-store");
      res.json(cfg);
    },
  };
}

// Ping de diagnóstico
router.get("/session-config/_ping", (_req, res) => res.json({ ok: true }));

// Endpoints oficiais
router.get("/session-config", ctrl.getSessionConfig);
router.put("/session-config", ctrl.putSessionConfig);
router.options("/session-config", (_req, res) => res.sendStatus(204));

export default router;
