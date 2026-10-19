(() => {
  'use strict';

  const $ = (sel, el=document) => el.querySelector(sel);
  const api = {
    info: '/api/test-certificado/pfx-info',
    signText: '/api/test-certificado/sign-text',
    signXml: '/api/test-certificado/sign-xml'
  };

  const inpPfx = $('#inpPfx');
  const inpPass = $('#inpPass');
  const infoStatus = $('#infoStatus');
  const infoCert = $('#infoCert');

  const btnInfo = $('#btnInfo');
  const btnSignTxt = $('#btnSignTxt');
  const btnSignXml = $('#btnSignXml');

  function clearUI(){
    infoStatus.textContent = '';
    infoCert.innerHTML = '';
    $('#outTxtSig').textContent = '';
    $('#outXmlSig').textContent = '';
  }

  function withLock(btn, fn){
    return async (...args) => {
      if (btn.disabled) return;
      btn.disabled = true;
      try { await fn(...args); } finally { btn.disabled = false; }
    };
  }

  $('#btnClear').addEventListener('click', () => {
    inpPfx.value = '';
    inpPass.value = '';
    clearUI();
  });

  btnInfo.addEventListener('click', withLock(btnInfo, async () => {
    clearUI();
    const f = inpPfx.files?.[0];
    const pass = inpPass.value || '';
    if (!f) { infoStatus.innerHTML = '<span class="err">Selecione um .pfx</span>'; return; }
    const fd = new FormData();
    fd.append('pfx', f);
    fd.append('pass', pass);
    try {
      infoStatus.textContent = 'Lendo...';
      const res = await fetch(api.info, { method:'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao ler PFX');
      infoStatus.innerHTML = '<span class="ok">PFX lido com sucesso</span>';
      infoCert.innerHTML = `
        <div><strong>Common Name</strong><div>${data.subjectCN||''}</div></div>
        <div><strong>Subject</strong><div>${data.subject||''}</div></div>
        <div><strong>Issuer</strong><div>${data.issuer||''}</div></div>
        <div><strong>Nº Série</strong><div>${data.serialNumber||''}</div></div>
        <div><strong>Válido de</strong><div>${data.notBefore||''}</div></div>
        <div><strong>Válido até</strong><div>${data.notAfter||''}</div></div>
        <div><strong>Algoritmo</strong><div>${data.keyAlgorithm||''}</div></div>
        <div><strong>SHA1 (thumbprint)</strong><div>${data.thumbprintSha1||''}</div></div>
      `;
    } catch (e) {
      infoStatus.innerHTML = `<span class="err">${e.message}</span>`;
    }
  }));

  btnSignTxt.addEventListener('click', withLock(btnSignTxt, async () => {
    const f = inpPfx.files?.[0];
    const pass = inpPass.value || '';
    const text = $('#txtToSign').value || '';
    const alg = $('#selAlgTxt').value;
    if (!f) return alert('Selecione o PFX');
    if (!text) return alert('Informe um texto');

    const fd = new FormData();
    fd.append('pfx', f);
    fd.append('pass', pass);
    fd.append('payload', text);
    fd.append('alg', alg);

    const res = await fetch(api.signText, { method:'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || 'Falha na assinatura');
    $('#outTxtSig').textContent = data.signatureBase64 || '';
  }));

  $('#btnCopyTxt').addEventListener('click', async () => {
    const txt = $('#outTxtSig').textContent.trim();
    if (!txt) return;
    await navigator.clipboard.writeText(txt);
    alert('Copiado!');
  });

  $('#btnDownloadTxt').addEventListener('click', () => {
    const content = $('#outTxtSig').textContent.trim();
    if (!content) return;
    const blob = new Blob([content], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'assinatura-base64.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnSignXml.addEventListener('click', withLock(btnSignXml, async () => {
    const f = inpPfx.files?.[0];
    const pass = inpPass.value || '';
    const xml = $('#xmlToSign').value || '';
    const refId = $('#inpRefId').value || '';
    const alg = $('#selAlgXml').value;
    if (!f) return alert('Selecione o PFX');
    if (!xml) return alert('Cole um XML');
    if (!refId) return alert('Informe o Reference Id (ex.: NFe123)');

    const fd = new FormData();
    fd.append('pfx', f);
    fd.append('pass', pass);
    fd.append('xml', xml);
    fd.append('referenceId', refId);
    fd.append('alg', alg);

    const res = await fetch(api.signXml, { method:'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || 'Falha na assinatura XML');
    $('#outXmlSig').textContent = data.signedXml || '';
  }));

  $('#btnCopyXml').addEventListener('click', async () => {
    const txt = $('#outXmlSig').textContent.trim();
    if (!txt) return;
    await navigator.clipboard.writeText(txt);
    alert('Copiado!');
  });

  $('#btnDownloadXml').addEventListener('click', () => {
    const content = $('#outXmlSig').textContent.trim();
    if (!content) return;
    const blob = new Blob([content], { type:'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'xml-assinado.xml';
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
