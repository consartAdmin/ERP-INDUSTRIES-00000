// ╔══════════════════════════════════════════════════════╗
// ║ trackingManager.js — UI Gerenciador de Trackeamento  ║
// ║ Front-end para /api/tracking/*                       ║
// ╚══════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin)
  .replace(/\/$/, "");

const $ = (sel) => document.querySelector(sel);

function fmtStatus(ok) {
  if (ok === true) return "Configurado";
  if (ok === false) return "Não configurado";
  return "—";
}

/**
 * fetchJson(path, options)
 * - Força cache: 'no-store'
 * - Para GET, adiciona _ts na query para evitar 304 (cache do navegador)
 */
async function fetchJson(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  let url = API_BASE + path;

  // Evita 304 / cache em GET
  if (method === "GET") {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}_ts=${Date.now()}`;
  }

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status}: ${text}`);
  }

  return res.json();
}

// -------------------------------------------------------------------
// 1. Carregar configuração (GET /api/tracking/config)
// -------------------------------------------------------------------
async function loadTrackingConfig() {
  const previewEl = $("#trk-config-preview");
  const testsOutput = $("#trk-tests-output");

  try {
    if (previewEl) previewEl.textContent = "Carregando configurações…";

    const json = await fetchJson("/api/tracking/config");

    // Campos GTM
    $("#gtmContainerId").value = json.gtmContainerId || "";
    $("#gtmEnabled").checked = !!json.gtmEnabled;

    // Campos GA4
    $("#ga4MeasurementId").value = json.ga4MeasurementId || "";
    // Por segurança, se vier secret, só indica com asterisco
    $("#ga4ApiSecret").value = json.ga4ApiSecret ? "********" : "";
    $("#ga4Enabled").checked = !!json.ga4Enabled;

    // Campos Google Ads
    $("#adsConversionId").value = json.adsConversionId || "";
    $("#adsConversionLabel").value = json.adsConversionLabel || "";
    $("#adsEnabled").checked = !!json.adsEnabled;

    // Campos Meta Pixel
    $("#metaPixelId").value = json.metaPixelId || "";
    $("#metaEnabled").checked = !!json.metaEnabled;

    // Status cards
    $("#trk-status-gtm").textContent = fmtStatus(
      !!json.gtmEnabled && !!json.gtmContainerId
    );
    $("#trk-status-ga4").textContent = fmtStatus(
      !!json.ga4Enabled && !!json.ga4MeasurementId
    );
    $("#trk-status-ads").textContent = fmtStatus(
      !!json.adsEnabled &&
        !!json.adsConversionId &&
        !!json.adsConversionLabel
    );
    $("#trk-status-meta").textContent = fmtStatus(
      !!json.metaEnabled && !!json.metaPixelId
    );

    // Preview JSON
    if (previewEl) {
      previewEl.textContent = JSON.stringify(json, null, 2);
    }

    // Limpa área de testes na carga (se já tiver mensagem padrão, deixa)
    if (testsOutput && testsOutput.textContent.startsWith("Nenhum teste")) {
      // mantém
    }
  } catch (err) {
    console.error("[loadTrackingConfig] erro:", err);
    if (previewEl) {
      previewEl.textContent = `Erro ao carregar configurações:\n${err.message}`;
    }
  }
}

// -------------------------------------------------------------------
// 2. Montar payload a partir do formulário
// -------------------------------------------------------------------
function buildConfigFromForm() {
  const ga4SecretField = $("#ga4ApiSecret");
  const ga4SecretValue = ga4SecretField?.value || "";

  return {
    gtmContainerId: $("#gtmContainerId")?.value.trim() || "",
    gtmEnabled: !!$("#gtmEnabled")?.checked,

    ga4MeasurementId: $("#ga4MeasurementId")?.value.trim() || "",
    // Se o campo tiver "********", assume que não mudou
    ga4ApiSecret:
      ga4SecretValue && ga4SecretValue !== "********"
        ? ga4SecretValue
        : undefined,
    ga4Enabled: !!$("#ga4Enabled")?.checked,

    adsConversionId: $("#adsConversionId")?.value.trim() || "",
    adsConversionLabel: $("#adsConversionLabel")?.value.trim() || "",
    adsEnabled: !!$("#adsEnabled")?.checked,

    metaPixelId: $("#metaPixelId")?.value.trim() || "",
    metaEnabled: !!$("#metaEnabled")?.checked,
  };
}

// -------------------------------------------------------------------
// 3. Salvar configurações (PUT /api/tracking/config)
// -------------------------------------------------------------------
async function saveTrackingConfig() {
  const btn = $("#trk-save-btn");
  const previewEl = $("#trk-config-preview");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Salvando…";

  try {
    const payload = buildConfigFromForm();

    const json = await fetchJson("/api/tracking/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    // Atualiza preview com retorno do backend
    if (previewEl) {
      previewEl.textContent = JSON.stringify(json, null, 2);
    }

    // Atualiza status cards com o que voltou salvo
    $("#trk-status-gtm").textContent = fmtStatus(
      !!json.gtmEnabled && !!json.gtmContainerId
    );
    $("#trk-status-ga4").textContent = fmtStatus(
      !!json.ga4Enabled && !!json.ga4MeasurementId
    );
    $("#trk-status-ads").textContent = fmtStatus(
      !!json.adsEnabled &&
        !!json.adsConversionId &&
        !!json.adsConversionLabel
    );
    $("#trk-status-meta").textContent = fmtStatus(
      !!json.metaEnabled && !!json.metaPixelId
    );

    btn.textContent = "✔ Salvo com sucesso";
  } catch (err) {
    console.error("[saveTrackingConfig] erro:", err);
    alert("Erro ao salvar configurações de trackeamento:\n" + err.message);
    btn.textContent = "⚠ Erro ao salvar";
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    }, 1500);
  }
}

// -------------------------------------------------------------------
// 4. Executar testes (POST /api/tracking/test)
// -------------------------------------------------------------------
async function runTrackingTests() {
  const btn = $("#trk-run-tests-btn");
  const outputEl = $("#trk-tests-output");
  if (!btn || !outputEl) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Testando…";

  try {
    const payload = buildConfigFromForm();

    outputEl.textContent = "Executando testes com as configurações atuais…";

    const json = await fetchJson("/api/tracking/test", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    outputEl.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    console.error("[runTrackingTests] erro:", err);
    outputEl.textContent =
      "Erro ao executar testes de trackeamento:\n" + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// -------------------------------------------------------------------
// 5. Bootstrap da página
// -------------------------------------------------------------------
function initTrackingManagerPage() {
  const reloadBtn = $("#trk-reload-btn");
  const saveBtn = $("#trk-save-btn");
  const testBtn = $("#trk-run-tests-btn");

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadTrackingConfig();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveTrackingConfig();
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", () => {
      runTrackingTests();
    });
  }

  // Carrega config ao abrir
  loadTrackingConfig();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTrackingManagerPage);
} else {
  initTrackingManagerPage();
}
