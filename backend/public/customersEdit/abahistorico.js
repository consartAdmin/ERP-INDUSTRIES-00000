document.addEventListener('DOMContentLoaded', () => {
  const campoHistorico = document.getElementById('campoHistorico');
  const btnSalvarHistorico = document.getElementById('btnSalvarHistorico');
  const listaHistorico = document.getElementById('listaHistorico');

  const idCliente = new URLSearchParams(window.location.search).get('id');

  // 🔄 Carregar histórico existente
  async function carregarHistorico() {
    try {
      const resposta = await fetch(`${window.apiBase}/api/historico/${idCliente}`);
      const historico = await resposta.json();

      listaHistorico.innerHTML = '';

      if (!historico.length) {
        listaHistorico.innerHTML = '<p>Nenhuma observação registrada.</p>';
        return;
      }

      historico.forEach(item => {
        const bloco = document.createElement('div');
        bloco.classList.add('bloco-observacao');

        const dataHora = new Date(item.data_hora).toLocaleString('pt-BR');
        bloco.innerHTML = `
          <p><strong>${dataHora}</strong></p>
          <p>${item.texto}</p>
        `;

        listaHistorico.appendChild(bloco);
      });
    } catch (erro) {
      console.error('❌ Erro ao carregar histórico:', erro);
      listaHistorico.innerHTML = '<p>Erro ao carregar histórico.</p>';
    }
  }

  // 💾 Salvar nova observação
  async function salvarObservacao() {
    const texto = campoHistorico.value.trim();
    if (!texto) return alert('Digite uma observação antes de salvar.');

    try {
      const resposta = await fetch(`${window.apiBase}/api/historico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente: idCliente, texto })
      });

      if (!resposta.ok) throw new Error('Erro ao salvar observação.');

      campoHistorico.value = '';
      await carregarHistorico();
    } catch (erro) {
      console.error('❌ Erro ao salvar observação:', erro);
      alert('Erro ao salvar observação.');
    }
  }

  // Evento do botão
  if (btnSalvarHistorico) {
    btnSalvarHistorico.addEventListener('click', salvarObservacao);
  }

  if (idCliente) carregarHistorico();

  // Expor função global se necessário (caso use onclick no HTML)
  window.salvarObservacao = salvarObservacao;
});
