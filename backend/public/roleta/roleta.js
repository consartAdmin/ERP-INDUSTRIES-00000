// ╔══════════════════════════════════════════════════════════════╗
// ║ roleta.js — Roleta Premiada (PRODNEX ERP)                    ║
// ║ Path: public/roleta/roleta.js                                ║
// ║ - Token via ?t=TOKEN                                         ║
// ║ - GET  /api/roleta/:token                                    ║
// ║ - POST /api/roleta/:token/spin                               ║
// ╚══════════════════════════════════════════════════════════════╝

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = $('spinBtn');
  const reloadBtn = $('reloadBtn');
  const resultEl = $('result');
  const campaignNameEl = $('campaignName');
  const campaignHintEl = $('campaignHint');

  // token via querystring ?t=...
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get('t');

  // estado
  let products = [];
  let spinning = false;
  let lastRotation = 0;

  // geometria
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) / 2;

  // cores alternadas (não usa libs)
  const colors = ['#1d4ed8', '#2563eb'];

  function setBlocked(msg) {
    campaignNameEl.innerText = 'Roleta Premiada';
    resultEl.innerText = msg;
    spinBtn.disabled = true;
    campaignHintEl.style.opacity = '1';
  }

  function setReady(msg) {
    if (msg) resultEl.innerText = msg;
    spinBtn.disabled = false;
    campaignHintEl.style.opacity = '.65';
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, W, H);
  }

  function drawWheel(rotation = 0) {
    clearCanvas();

    if (!products.length) {
      // desenha “placeholder”
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(148,163,184,.25)';
      ctx.lineWidth = 10;
      ctx.stroke();
      return;
    }

    const arc = (2 * Math.PI) / products.length;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const start = i * arc;
      const end = start + arc;

      // fatia
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 8, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % 2];
      ctx.fill();

      // texto
      ctx.save();
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';

      const labelRaw = (p.name || p.product_code || '').toString();
      const label = labelRaw.length > 22 ? labelRaw.slice(0, 22) + '…' : labelRaw;

      ctx.fillText(label, (radius - 8) * 0.55, 6);
      ctx.restore();
    }

    ctx.restore();

    // borda
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(2,6,23,.9)';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  async function apiGetCampaign() {
    const res = await fetch(`/api/roleta/${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Token inválido');
    return data;
  }

  async function apiSpin() {
    const res = await fetch(`/api/roleta/${encodeURIComponent(token)}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data?.error || 'Erro ao girar');
    return data;
  }

  async function load() {
    drawWheel(0);

    if (!token) {
      setBlocked('Token inválido: abra pelo link correto com ?t=SEU_TOKEN');
      return;
    }

    try {
      const data = await apiGetCampaign();

      campaignNameEl.innerText = data?.campaign?.name || 'Roleta Premiada';
      products = Array.isArray(data?.products) ? data.products : [];

      if (!products.length) {
        setBlocked('Nenhum produto disponível nesta campanha.');
        return;
      }

      setReady('Clique em GIRAR para participar.');
      drawWheel(lastRotation);

    } catch (err) {
      setBlocked(err.message || 'Token inválido');
    }
  }

  async function spin() {
    if (spinning) return;
    if (!token) return setBlocked('Token inválido.');

    spinning = true;
    spinBtn.disabled = true;
    resultEl.innerText = 'Girando...';

    try {
      const data = await apiSpin();
      const prize = data.prize;

      // acha o vencedor na lista carregada
      const idx = products.findIndex(p => p.product_code === prize.product_code);
      const winnerIndex = idx >= 0 ? idx : 0;

      const arc = (2 * Math.PI) / products.length;

      // ponteiro está no topo => alvo em 270° (1.5π)
      const pointerAngle = Math.PI * 1.5;

      // centro da fatia vencedora
      const sliceCenter = winnerIndex * arc + arc / 2;

      // rotação final para alinhar a fatia vencedora ao ponteiro
      // (com sinal invertido por causa do sentido da rotação)
      const targetAngle = pointerAngle - sliceCenter;

      // voltas extras para “efeito”
      const extraSpins = 6;
      const startRotation = lastRotation;
      const endRotation = startRotation + extraSpins * 2 * Math.PI + targetAngle;

      const duration = 3200;
      const start = performance.now();

      function anim(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(t);
        const rot = startRotation + (endRotation - startRotation) * eased;

        // animamos via redraw (mais consistente do que CSS rotate)
        drawWheel(rot);

        if (t < 1) {
          requestAnimationFrame(anim);
        } else {
          lastRotation = endRotation % (2 * Math.PI);
          resultEl.innerText = `🎉 Você ganhou: ${prize.name} (${prize.product_code})`;
          spinning = false;
        }
      }

      requestAnimationFrame(anim);

    } catch (err) {
      spinning = false;
      spinBtn.disabled = false;
      alert(err.message || 'Erro ao girar');
      resultEl.innerText = 'Falha ao girar.';
    }
  }

  // eventos
  spinBtn.addEventListener('click', spin);
  reloadBtn.addEventListener('click', () => window.location.reload());

  // init
  load();
})();