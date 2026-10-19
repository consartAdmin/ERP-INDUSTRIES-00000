// 📄 produtosFiscalLote.js – Script Fiscal em Lote (com logs detalhados)

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 [INICIALIZAÇÃO] Página carregada');
  await carregarGrupos();
  await carregarClassificacoesFiscais();
  configurarSelectGrupo();
  configurarSelectClassificacao();
  configurarBotaoAplicar();
});

// 🔹 Carrega Grupos
async function carregarGrupos() {
  try {
    const res = await fetch(`/api/grupos`);
    const grupos = await res.json();

    const selectGrupo = document.getElementById('grupo');
    selectGrupo.innerHTML = '<option value="">Todos</option>';
    grupos.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.nome;
      selectGrupo.appendChild(opt);
    });

    console.log(`✅ [GRUPOS] ${grupos.length} grupo(s) carregado(s)`);
  } catch (err) {
    console.error('❌ [ERRO] ao carregar grupos:', err);
    alert('Erro ao carregar grupos. Verifique sua conexão.');
  }
}

// 🔹 Carrega Subgrupos com base no Grupo
function configurarSelectGrupo() {
  const selectGrupo = document.getElementById('grupo');

  selectGrupo.addEventListener('change', async () => {
    const grupoId = selectGrupo.value;
    const selectSubgrupo = document.getElementById('subgrupo');
    selectSubgrupo.innerHTML = '<option value="">Todos</option>';

    if (!grupoId) return;

    try {
      const res = await fetch(`/api/subgrupos/por-grupo/${grupoId}`);
      const subgrupos = await res.json();

      subgrupos.forEach(sg => {
        const opt = document.createElement('option');
        opt.value = sg.id;
        opt.textContent = sg.nome;
        selectSubgrupo.appendChild(opt);
      });

      console.log(`✅ [SUBGRUPOS] ${subgrupos.length} subgrupo(s) carregado(s) para grupo ${grupoId}`);
    } catch (err) {
      console.error(`❌ [ERRO] ao carregar subgrupos para grupo ${grupoId}:`, err);
      alert('Erro ao carregar subgrupos. Tente novamente.');
    }
  });
}

// 🔹 Carrega Classificações Fiscais
async function carregarClassificacoesFiscais() {
  try {
    const res = await fetch(`/api/classificacao-fiscal`);
    const classificacoes = await res.json();

    const select = document.getElementById('classificacao_fiscal_id');
    select.innerHTML = '<option value="">Selecione...</option>';
    classificacoes.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.descricao} (${item.ncm})`;
      select.appendChild(opt);
    });

    console.log(`✅ [CLASSIFICAÇÕES] ${classificacoes.length} classificação(ões) carregada(s)`);
  } catch (err) {
    console.error('❌ [ERRO] ao carregar classificações fiscais:', err);
    alert('Erro ao carregar classificações fiscais. Verifique a conexão.');
  }
}

// 🔹 Carrega Perfil Fiscal vinculado à Classificação
function configurarSelectClassificacao() {
  const selectClassificacao = document.getElementById('classificacao_fiscal_id');
  const selectPerfil = document.getElementById('perfil_fiscal_id');

  selectClassificacao.addEventListener('change', async () => {
    const classificacaoId = selectClassificacao.value;
    selectPerfil.innerHTML = '<option value="">Selecione...</option>';

    if (!classificacaoId) return;

    try {
      const res = await fetch(`/api/classificacao-fiscal/${classificacaoId}`);
      const classificacao = await res.json();

      if (classificacao.perfil_fiscal_id) {
        const resPerfil = await fetch(`/api/perfil-fiscal/${classificacao.perfil_fiscal_id}`);
        const perfil = await resPerfil.json();

        const opt = document.createElement('option');
        opt.value = perfil.id;
        opt.textContent = perfil.nome_perfil;
        opt.selected = true;
        selectPerfil.appendChild(opt);

        console.log(`✅ [PERFIL] "${perfil.nome_perfil}" carregado para a classificação`);
      } else {
        console.warn('⚠️ Classificação selecionada não possui perfil vinculado');
      }
    } catch (err) {
      console.error(`❌ [ERRO] ao carregar perfil fiscal da classificação ${classificacaoId}:`, err);
      alert('Erro ao carregar perfil fiscal vinculado.');
    }
  });
}

// 🔘 Botão Aplicar Lote
function configurarBotaoAplicar() {
  const btn = document.getElementById('btnAplicar');

  btn.addEventListener('click', async () => {
    const grupo = document.getElementById('grupo').value || null;
    const subgrupo = document.getElementById('subgrupo')?.value || null;
    const classificacao_fiscal_id = document.getElementById('classificacao_fiscal_id').value;
    const perfil_fiscal_id = document.getElementById('perfil_fiscal_id').value;

    if (!classificacao_fiscal_id || !perfil_fiscal_id) {
      alert('⚠️ Preencha a Classificação Fiscal e Perfil Fiscal antes de aplicar.');
      return;
    }

    const payload = {
      grupo_id: grupo,
      subgrupo_id: subgrupo,
      classificacao_fiscal_id,
      perfil_fiscal_id
    };

    console.log('[🔁 ENVIO] Payload para atualização fiscal:', payload);

    try {
      const res = await fetch('/api/produtos/fiscal-lote', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok) {
        console.warn('[⛔ ERRO BACKEND]', json);
        throw new Error(json.erro || 'Erro desconhecido ao aplicar lote');
      }

      console.log('✅ [SUCESSO] Backend retornou:', json);
      alert(json.mensagem);

      // Exibe mensagem
      const resultado = document.getElementById('resultado');
      resultado.textContent = json.mensagem;
      resultado.style.display = 'block';

      // Exibe SKUs atualizados
      const divSkus = document.getElementById('skus-atualizados');
      if (json.skus_atualizados?.length) {
        divSkus.innerHTML = `
          <h3>📦 Produtos Atualizados:</h3>
          <ul>${json.skus_atualizados.map(sku => `<li><code>${sku}</code></li>`).join('')}</ul>
        `;
        divSkus.style.display = 'block';
        console.log(`📦 ${json.skus_atualizados.length} SKU(s) atualizados`, json.skus_atualizados);
      } else {
        divSkus.innerHTML = '';
        divSkus.style.display = 'none';
      }

    } catch (err) {
      console.error('❌ [FALHA NA REQUISIÇÃO]', err);
      alert(`❌ ${err.message || 'Erro inesperado ao aplicar alterações em lote.'}`);
    }
  });
}
