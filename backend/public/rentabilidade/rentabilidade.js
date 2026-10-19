// 📁 rentabilidade.js

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBuscar').addEventListener('click', buscarRentabilidade);
});

async function buscarRentabilidade() {
  const orcamentoId = document.getElementById('orcamentoId').value.trim();
  if (!orcamentoId) {
    alert('Informe o número do orçamento.');
    return;
  }

  try {
    const resposta = await fetch(`/api/rentabilidade/orcamento/${orcamentoId}`);
    const dados = await resposta.json();

    if (!resposta.ok) throw new Error(dados.erro || 'Erro ao buscar rentabilidade.');

    preencherTabela(dados);
  } catch (erro) {
    console.error('[RENTABILIDADE] Erro:', erro);
    alert('Erro ao buscar rentabilidade. Verifique o console.');
  }
}

function preencherTabela(itens) {
  const corpo = document.querySelector('#tabelaRentabilidade tbody');
  corpo.innerHTML = '';

  let lucroTotal = 0;
  let somaMargens = 0;

  itens.forEach(item => {
    const tr = document.createElement('tr');

    const lucroItem = (item.preco_final - item.preco_custo) * item.quantidade;
    const margem = item.preco_final > 0
      ? ((item.preco_final - item.preco_custo) / item.preco_final) * 100
      : 0;

    tr.innerHTML = `
      <td>${item.sku}</td>
      <td>${item.descricao}</td>
      <td>${item.quantidade}</td>
      <td>${item.unidade}</td>
      <td>R$ ${item.preco_custo.toFixed(2)}</td>
      <td>R$ ${item.preco_tabela.toFixed(2)}</td>
      <td>R$ ${item.desconto.toFixed(2)}</td>
      <td>R$ ${item.preco_final.toFixed(2)}</td>
      <td>R$ ${lucroItem.toFixed(2)}</td>
      <td>${margem.toFixed(1)}%</td>
    `;

    corpo.appendChild(tr);
    lucroTotal += lucroItem;
    somaMargens += margem;
  });

  const margemMedia = itens.length > 0 ? somaMargens / itens.length : 0;

  document.getElementById('lucroTotal').textContent = `R$ ${lucroTotal.toFixed(2)}`;
  document.getElementById('margemMedia').textContent = `${margemMedia.toFixed(1)}%`;
}
