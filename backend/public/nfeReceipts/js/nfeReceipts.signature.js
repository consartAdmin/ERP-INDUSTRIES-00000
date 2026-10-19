// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.signature.js — Área de assinatura (canvas)              ║
// ║ PRODNEX ERP                                                         ║
// ║                                                                     ║
// ║ • Pointer Events: dedo, caneta e mouse com o mesmo código.          ║
// ║ • Os traços ficam guardados em memória (px CSS) e são redesenhados  ║
// ║   sempre que o tamanho muda — teclado abrindo, barra de endereço,   ║
// ║   rotação da tela ou o canvas aparecendo depois de estar oculto.    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  SIGNATURE_STYLE,
  SIGNATURE_MIN_POINTS,
  SIGNATURE_EXPORT_MAX_SCALE
} from './nfeReceipts.config.js';

export function createSignaturePad(canvas, { onChange } = {}) {
  const ctx = canvas.getContext('2d');
  const strokes = [];          // [[{x, y}, ...], ...] em px CSS
  let current = null;          // traço em andamento
  let activePointerId = null;  // ignora um segundo dedo
  let cssWidth = 0;
  let cssHeight = 0;

  // ────────────────────────────────────────────────────────────────
  // Desenho
  // ────────────────────────────────────────────────────────────────

  function applyStyle(context) {
    context.lineWidth = SIGNATURE_STYLE.lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = SIGNATURE_STYLE.color;
    context.fillStyle = SIGNATURE_STYLE.color;
  }

  function drawStroke(context, points) {
    if (!points.length) return;

    if (points.length === 1) {
      // Toque sem arrastar vira um ponto visível.
      context.beginPath();
      context.arc(points[0].x, points[0].y, SIGNATURE_STYLE.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      context.lineTo(points[i].x, points[i].y);
    }
    context.stroke();
  }

  function redraw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (const points of strokes) drawStroke(ctx, points);
  }

  // ────────────────────────────────────────────────────────────────
  // Tamanho (resolução acompanha o tamanho real na tela)
  // ────────────────────────────────────────────────────────────────

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    // Oculto (display:none) ou sem mudança real: não mexe no canvas.
    if (!width || !height) return;
    if (width === cssWidth && height === cssHeight) return;

    // Mantém os traços proporcionais se a largura mudar (ex.: rotação).
    if (cssWidth && cssHeight) {
      const sx = width / cssWidth;
      const sy = height / cssHeight;
      for (const points of strokes) {
        for (const p of points) {
          p.x *= sx;
          p.y *= sy;
        }
      }
    }

    cssWidth = width;
    cssHeight = height;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    // Alterar width/height zera o contexto: reaplica escala e estilo.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    applyStyle(ctx);
    redraw();
  }

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => resize())
    : null;

  if (resizeObserver) {
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  // ────────────────────────────────────────────────────────────────
  // Entrada (Pointer Events)
  // ────────────────────────────────────────────────────────────────

  // Captura mantém o traço mesmo se o dedo sair da área; alguns WebViews
  // lançam exceção aqui — a assinatura não pode depender disso.
  function safePointerCapture(method, pointerId) {
    try {
      canvas[method]?.(pointerId);
    } catch {
      /* segue sem captura */
    }
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
    };
  }

  function onPointerDown(event) {
    if (activePointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    resize(); // garante resolução correta antes do primeiro traço

    activePointerId = event.pointerId;
    safePointerCapture('setPointerCapture', event.pointerId);

    current = [getPoint(event)];
    strokes.push(current);
    drawStroke(ctx, current);
  }

  function onPointerMove(event) {
    if (event.pointerId !== activePointerId || !current) return;
    event.preventDefault();

    // Eventos agrupados deixam o traço liso em telas de alta frequência.
    const events = typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [event];

    for (const e of (events.length ? events : [event])) {
      const point = getPoint(e);
      const last = current[current.length - 1];

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();

      current.push(point);
    }
  }

  function onPointerEnd(event) {
    if (event.pointerId !== activePointerId) return;

    safePointerCapture('releasePointerCapture', event.pointerId);
    activePointerId = null;
    current = null;
    onChange?.();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);

  // Impede rolagem/zoom da página enquanto assina (reforço ao touch-action: none).
  canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

  resize();

  // ────────────────────────────────────────────────────────────────
  // API pública
  // ────────────────────────────────────────────────────────────────

  function pointCount() {
    return strokes.reduce((total, points) => total + points.length, 0);
  }

  return {
    resize,

    clear() {
      strokes.length = 0;
      current = null;
      activePointerId = null;
      redraw();
      onChange?.();
    },

    isEmpty() {
      return pointCount() === 0;
    },

    hasEnoughInk() {
      return pointCount() >= SIGNATURE_MIN_POINTS;
    },

    /** PNG com fundo branco, em escala limitada (tamanho de upload previsível). */
    toDataUrl() {
      const scale = Math.min(window.devicePixelRatio || 1, SIGNATURE_EXPORT_MAX_SCALE);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(cssWidth * scale));
      out.height = Math.max(1, Math.round(cssHeight * scale));

      const outCtx = out.getContext('2d');
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, out.width, out.height);
      outCtx.setTransform(scale, 0, 0, scale, 0, 0);
      applyStyle(outCtx);

      for (const points of strokes) drawStroke(outCtx, points);

      return out.toDataURL('image/png');
    }
  };
}
