// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ 🧾 fornecedores.js – Cadastro e Edição de Fornecedores                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const url = `${window.apiBase}/api/fornecedores`;
let fornecedores = [];

document.addEventListener('DOMContentLoaded', () => {
  carregarFornecedores();
  document.getElementById('formFornecedor').addEventListener('submit', salvarFornecedor);
  document.getElementById('btnNovoFornecedor').addEventListener('click', limparFormulario);
});

////////////////////////////////////////////////////////////////////////////////
// 📥 Carregar lista de fornecedores
////////////////////////////////////////////////////////////////////////////////
async function carregarFornecedores() {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`);
    fornecedores = await res.json();
    renderizarTabela();
  } catch (erro) {
    console.error('Erro ao carregar fornecedores:', erro);
    alert('Erro ao carregar lista de fornecedores.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// 📋 Renderizar tabela de fornecedores
////////////////////////////////////////////////////////////////////////////////
function renderizarTabela() {
  const corpo = document.getElementById('fornecedores');
  if (!corpo) {
    console.warn('⚠️ Elemento "fornecedores" não encontrado.');
    return;
  }

  corpo.innerHTML = '';

  fornecedores.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.cnpj_cpf || ''}</td>
      <td>${f.telefone || ''}</td>
      <td>${f.email || ''}</td>
      <td>${f.uf || ''}</td>
      <td>
        <button type="button" onclick="editarFornecedor(${f.id})">✏️</button>
        <button type="button" onclick="excluirFornecedor(${f.id})">🗑️</button>
      </td>
    `;
    corpo.appendChild(tr);
  });
}

////////////////////////////////////////////////////////////////////////////////
// 💾 Salvar fornecedor (criar ou atualizar)
////////////////////////////////////////////////////////////////////////////////
async function salvarFornecedor(event) {
  event.preventDefault();

  const fornecedor = {
    nome: document.querySelector('[name="nome"]').value,
    cnpj_cpf: document.querySelector('[name="cnpj_cpf"]').value,
    inscricao_estadual: document.querySelector('[name="ie"]').value,
    telefone: document.querySelector('[name="telefone"]').value,
    email: document.querySelector('[name="email"]').value,
    endereco: document.querySelector('[name="endereco"]').value,
    cidade: document.querySelector('[name="cidade"]').value,
    uf: document.querySelector('[name="uf"]').value,
    cep: document.querySelector('[name="cep"]').value,
    vendedor: document.querySelector('[name="vendedor"]').value,
    email_vendedor: document.querySelector('[name="email_vendedor"]').value,
    email_financeiro: document.querySelector('[name="email_financeiro"]').value
  };

  const id = document.getElementById('id')?.value;

  try {
    const resposta = await fetch(`${url}${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fornecedor),
    });

    if (!resposta.ok) {
  const erroTexto = await resposta.text();
  throw new Error(`Erro ao salvar fornecedor: ${erroTexto}`);
}

    limparFormulario();
    carregarFornecedores();
  } catch (erro) {
    console.error(erro);
    alert('Erro ao salvar fornecedor.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// ✏️ Editar fornecedor
////////////////////////////////////////////////////////////////////////////////
function editarFornecedor(id) {
  const f = fornecedores.find(f => f.id === id);
  if (!f) return;

  const set = (campo, valor) => {
    const el = document.getElementById(campo);
    if (el) el.value = valor || '';
  };

  set('id', f.id);
  set('nome', f.nome);
  set('cnpj_cpf', f.cnpj_cpf);
  set('ie', f.inscricao_estadual);
  set('telefone', f.telefone);
  set('email', f.email);
  set('endereco', f.endereco);
  set('cidade', f.cidade);
  set('uf', f.uf);
  set('cep', f.cep);
  set('vendedor', f.vendedor);
  set('email_vendedor', f.email_vendedor);
  set('email_financeiro', f.email_financeiro);
}

////////////////////////////////////////////////////////////////////////////////
// 🗑️ Excluir fornecedor
////////////////////////////////////////////////////////////////////////////////
async function excluirFornecedor(id) {
  if (!confirm('Deseja realmente excluir este fornecedor?')) return;

  try {
    const resposta = await fetch(`${url}/${id}`, { method: 'DELETE' });
    if (!resposta.ok) throw new Error('Erro ao excluir fornecedor');
    carregarFornecedores();
  } catch (erro) {
    console.error(erro);
    alert('Erro ao excluir fornecedor.');
  }
}

////////////////////////////////////////////////////////////////////////////////
// ♻️ Limpar formulário
////////////////////////////////////////////////////////////////////////////////
function limparFormulario() {
  document.getElementById('formFornecedor').reset();
  const campoId = document.getElementById('id');
  if (campoId) campoId.value = '';
}
