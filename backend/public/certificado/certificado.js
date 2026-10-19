// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 📦 certificado.js – Upload de Certificado .pfx com Validação Visual     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("formCertificado");
  const info = document.getElementById("infoCertificado");
  const erro = document.getElementById("erroCertificado");
  const bucketNameEl = document.getElementById("bucketName");

  // Mostra o bucket alvo (se backend expôs via env)
  try {
    const r = await fetch('/api/certificado/env');
    if (r.ok) {
      const env = await r.json();
      bucketNameEl.textContent = env.NFE_CERT_BUCKET || '(defina NFE_CERT_BUCKET)';
    }
  } catch {}

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    info.textContent = '';
    erro.textContent = '';

    const arquivo = document.getElementById("arquivo").files[0];
    const senha = document.getElementById("senha").value.trim();

    if (!arquivo || !senha) {
      erro.textContent = '⚠️ Preencha todos os campos antes de enviar.';
      return;
    }

    const formData = new FormData();
    formData.append("certificado", arquivo);
    formData.append("senha", senha);

    try {
      const resposta = await fetch('/api/certificado', {
        method: 'POST',
        body: formData
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        const { validade, emitente, gcsUri, bucket, object } = dados;
        const destino = gcsUri || (bucket && object ? `gs://${bucket}/${object}` : '—');
        info.textContent = `✔️ Certificado válido até ${validade} para ${emitente}. Salvo em: ${destino}`;
        form.reset();
      } else {
        erro.textContent = '❌ Erro: ' + (dados.erro || 'Falha ao salvar certificado.');
      }
    } catch (e) {
      console.error('Erro de comunicação:', e);
      erro.textContent = '❌ Erro de comunicação com o servidor.';
    }
  });
});
