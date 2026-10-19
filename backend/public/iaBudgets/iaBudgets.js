(() => {
  'use strict';

  const API  = (window.apiBase || '') + '/api/ia-budgets';
  const APIV = API; // mesmo prefixo para /vinculos e /produtos

  // DOM (sugestões)
  const txtLinhas   = document.querySelector('#itensLivres');
  const inpTabela   = document.querySelector('#tabelaPrecoId');
  const inpUnidade  = document.querySelector('#unidadeVenda');
  const btnSugerir  = document.querySelector('#btnSugerir');
  const btnConfirm  = document.querySelector('#btnConfirmar');
  const btnLimpar   = document.querySelector('#btnLimpar');
  const boxSugestoes= document.querySelector('#sugestoes');
  const inpImagem   = document.querySelector('#imagemUpload');
  const preview     = document.querySelector('#previewImagem');

  // DOM (vínculos)
  const formNovo      = document.querySelector('#formNovoVinculo');
  const novoId        = document.querySelector('#novo_produto_id');
  const novoSku       = document.querySelector('#novo_produto_sku');
  const novoPalavras  = document.querySelector('#novo_palavras');
  const btnLimparNovo = document.querySelector('#btnLimparNovo');
  const filtro        = document.querySelector('#filtroVinculos');
  const btnReload     = document.querySelector('#btnRecarregarVinculos');
  const gridVinculos  = document.querySelector('#gridVinculos');

  // DOM (busca de produto)
  const buscaInp   = document.querySelector('#busca_produto');
  const buscaBox   = document.querySelector('#busca_resultados');

  // Estado
  let TABELAS = [];
  let UNIDADES = [];
  let CARDS = [];
  let VINCULOS = [];

  // Locks para evitar 429 por estouro de RPM
  let LOCK_UPLOAD = false;
  let LOCK_SUGERIR = false;
  let LOCK_SALVAR = false;

  // Helpers genéricos
  const toast = (m) => (window.mostrarToast ? mostrarToast(m) : alert(m));
  const fmt = (n) => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});

  const debounce = (fn, ms=300) => {
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  };

  function setLoading(btn, on=true){
    if (!btn) return;
    if (on){
      btn.dataset.oldText = btn.textContent;
      btn.textContent = 'Processando...';
      btn.setAttribute('disabled','disabled');
    } else {
      if (btn.dataset.oldText) btn.textContent = btn.dataset.oldText;
      btn.removeAttribute('disabled');
      delete btn.dataset.oldText;
    }
  }

  function startCooldown(btn, secs=20){
    if (!btn) return;
    let remaining = Math.max(1, Math.floor(secs));
    btn.setAttribute('disabled','disabled');
    const original = btn.dataset.oldText || btn.textContent || 'Aguarde';
    const tick = () => {
      btn.textContent = `${original} (${remaining}s)`;
      remaining -= 1;
      if (remaining < 0){
        btn.textContent = original;
        btn.removeAttribute('disabled');
      } else {
        setTimeout(tick, 1000);
      }
    };
    tick();
  }

  async function handleFetchJson(promise){
    const r = await promise;
    let j;
    try { j = await r.json(); } catch { j = {}; }
    if (!r.ok || j?.ok === false){
      const code = r.status;
      if (code === 401) throw Object.assign(new Error('Não autorizado (401). Verifique sua OPENAI_API_KEY / sessão.'), { status: 401 });
      if (code === 429) {
        const ra = r.headers.get('retry-after');
        const secs = ra ? Number(ra) : 20;
        const err = new Error(`Limite de uso atingido (429). Tente novamente em ~${secs}s.`);
        err.status = 429;
        err.retryAfter = secs;
        throw err;
      }
      const err = new Error(j?.erro || j?.error || `Falha HTTP ${code}`);
      err.status = code;
      throw err;
    }
    return j;
  }

  /* ====== Init combos ====== */
  async function carregarTabelas() {
    const r = await fetch(`${API}/tabelas-preco`);
    if (!r.ok) throw new Error('Falha ao carregar tabelas');
    TABELAS = await r.json();
    inpTabela.innerHTML = `<option value="">Selecione...</option>`;
    TABELAS.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.nome} ${t.descricao?`(${t.descricao})`:''}`;
      inpTabela.appendChild(o);
    });
  }

  async function carregarUnidades() {
    const r = await fetch(`${API}/unidades`);
    if (!r.ok) throw new Error('Falha ao carregar unidades');
    UNIDADES = await r.json();
    inpUnidade.innerHTML = `<option value="">Selecione...</option>`;
    UNIDADES.forEach(u => {
      const o = document.createElement('option');
      o.value = u.unidade;
      o.textContent = `${u.unidade} - ${u.descricao||''}`;
      inpUnidade.appendChild(o);
    });
  }

  /* ====== Upload / OCR+IA ====== */
  inpImagem?.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    await enviarImagem(e.target.files[0]);
  });

  document.addEventListener('paste', (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        enviarImagem(file);
      }
    }
  });

  async function enviarImagem(file) {
    if (LOCK_UPLOAD) return;
    LOCK_UPLOAD = true;
    setLoading(btnSugerir, true); // usa o mesmo visual

    const formData = new FormData();
    formData.append('file', file); // campo tem que se chamar "file"
    const tabela_preco_id = Number(inpTabela.value || 0);
    if (tabela_preco_id) formData.append('tabela_preco_id', String(tabela_preco_id));

    // preview (com revoke para não vazar memória)
    const objUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${objUrl}" style="max-height:120px;border:1px solid #ccc;border-radius:6px;">`;

    try {
      const j = await handleFetchJson(fetch(`${API}/upload-imagem`, { method: 'POST', body: formData }));

      // compat: preencher textarea
      txtLinhas.value = j.textoExtraido || '';

      // se vieram itens+matches, converte e renderiza
      if (Array.isArray(j.itens) && j.itens.length) {
        CARDS = itensComMatchesParaCards(j.itens);
        const unidadeDefault = inpUnidade.value || null;
        if (unidadeDefault) {
          CARDS = CARDS.map(c => ({ ...c, unidade: c.unidade || unidadeDefault }));
        }
        CARDS = mergePorSKU(CARDS);
        renderCards();
        toast('✅ Itens detectados e sugestões aplicadas.');
      } else {
        renderCards();
        toast('✅ Texto extraído. Você pode clicar em "Sugerir Itens".');
      }
    } catch (err) {
      console.error(err);
      toast(`❌ Falha ao processar imagem. ${err.message || ''}`);
      if (err.status === 429) startCooldown(btnSugerir, err.retryAfter || 20);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      setLoading(btnSugerir, false);
      LOCK_UPLOAD = false;
    }
  }

  /* ====== Helpers p/ matches → CARDS ====== */
  function escolherMelhorMatch(matches = []) {
    if (!matches.length) return null;
    const m = [...matches].sort((a,b) => (b.score||0) - (a.score||0))[0];
    return m || null;
  }

  function itensComMatchesParaCards(itens = []) {
    const cards = [];
    for (const it of itens) {
      const best = escolherMelhorMatch(it.matches || []);
      if (!best) continue; // sem match → usuário pode usar /sugerir depois

      const qtd = Number(it.quantidade || 1);
      cards.push({
        sku: best.sku || '',
        descricao: best.descricao || (it.descricao || '(produto)'),
        unidade: (it.unidade || 'UN'),
        qtd: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
        preco_unit: Number(best.preco_unit || 0)
      });
    }
    return cards;
  }

  function mergePorSKU(cards = []) {
    const acc = new Map();
    for (const c of cards) {
      const key = c.sku || `${c.descricao}|${c.unidade}`;
      if (!acc.has(key)) {
        acc.set(key, { ...c });
      } else {
        const cur = acc.get(key);
        cur.qtd = Number(cur.qtd || 0) + Number(c.qtd || 0);
        if (Number(c.preco_unit || 0) > Number(cur.preco_unit || 0)) {
          cur.preco_unit = Number(c.preco_unit || 0);
        }
      }
    }
    return Array.from(acc.values());
  }

  /* ========== SUGESTÕES / RENDER: tabela (linhas) OU cards (fallback) ========== */
  const isTableBody = (el) => {
    if (!el) return false;
    return el.tagName === 'TBODY' || !!el.closest?.('tbody');
  };

  function renderEmptyRow() {
    if (!isTableBody(boxSugestoes)) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center;color:#777;padding:16px">Nenhuma sugestão no momento.</td>`;
    boxSugestoes.appendChild(tr);
  }

  function renderAsTableRows() {
    boxSugestoes.innerHTML = '';
    if (!CARDS.length) { renderEmptyRow(); return; }
    CARDS.forEach((c, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.sku || ''}</strong></td>
        <td>${c.descricao || ''}</td>
        <td>${c.unidade || 'UN'}</td>
        <td>
          <input type="number" min="1" step="1"
                 value="${Number(c.qtd||1)}" data-k="qtd" data-i="${idx}"
                 class="input sug-qtd" style="width:90px;text-align:right">
        </td>
        <td class="sug-money">R$ <span data-id="unit-${idx}">${fmt(c.preco_unit)}</span></td>
        <td class="sug-money"><strong>R$ <span data-id="sub-${idx}">${fmt((Number(c.qtd||1)) * (Number(c.preco_unit||0)))}</span></strong></td>
      `;
      boxSugestoes.appendChild(tr);
    });
  }

  function renderAsCards() {
    boxSugestoes.innerHTML = '';
    if (!CARDS.length) return;
    CARDS.forEach((c, idx) => {
      const el = document.createElement('div');
      el.className = 'sug-card';
      el.innerHTML = `
        <header><span class="sku">SKU ${c.sku || ''}</span><span class="badge">${c.unidade || 'UN'}</span></header>
        <div class="desc">${c.descricao || ''}</div>
        <dl class="meta">
          <dt>Qtd</dt>
          <dd><input type="number" min="1" step="1" value="${Number(c.qtd||1)}" data-k="qtd" data-i="${idx}" class="qtd"></dd>
          <dt>Unitário</dt>
          <dd>R$ <span data-id="unit-${idx}">${fmt(c.preco_unit)}</span></dd>
          <dt>Total</dt>
          <dd><strong>R$ <span data-id="sub-${idx}">${fmt((Number(c.qtd||1)) * (Number(c.preco_unit||0)))}</span></strong></dd>
        </dl>`;
      boxSugestoes.appendChild(el);
    });
  }

  function renderCards() {
    if (isTableBody(boxSugestoes)) renderAsTableRows();
    else renderAsCards();
  }

  /* ====== Eventos de edição de quantidade ====== */
  boxSugestoes?.addEventListener('input', (ev) => {
    const k = ev.target?.dataset?.k;
    const i = Number(ev.target?.dataset?.i);
    if (k !== 'qtd' || Number.isNaN(i)) return;
    const qtd = Math.max(1, parseInt(ev.target.value || '1', 10));
    CARDS[i].qtd = qtd;
    const subEl = boxSugestoes.querySelector(`[data-id="sub-${i}"]`);
    if (subEl) subEl.textContent = fmt(qtd * Number(CARDS[i].preco_unit||0));
  });

  // Enter confirma edição no input de quantidade
  boxSugestoes?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target?.dataset?.k === 'qtd') {
      ev.preventDefault();
      ev.target.blur();
    }
  });

  /* ====== Sugerir por texto ====== */
  btnSugerir?.addEventListener('click', async () => {
    if (LOCK_SUGERIR) return;
    LOCK_SUGERIR = true;
    setLoading(btnSugerir, true);

    const linhas = (txtLinhas?.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const tabela_preco_id = Number(inpTabela.value);
    const unidade_venda   = inpUnidade.value || null;

    if (!linhas.length) { toast('Digite ao menos uma linha.'); setLoading(btnSugerir,false); LOCK_SUGERIR=false; return; }
    if (!tabela_preco_id) { toast('Escolha a Tabela de Preço válida.'); setLoading(btnSugerir,false); LOCK_SUGERIR=false; return; }

    try {
      const j = await handleFetchJson(fetch(`${API}/sugerir`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ linhas, tabela_preco_id, unidade_venda })
      }));

      // Normaliza formato esperado
      const unidadeDefault = inpUnidade.value || 'UN';
      CARDS = (Array.isArray(j) ? j : []).map(x => ({
        sku: String(x.sku || ''),
        descricao: String(x.descricao || '(produto)'),
        unidade: String(x.unidade || unidadeDefault),
        qtd: Number(x.qtd || 1),
        preco_unit: Number(x.preco_unit || 0)
      }));
      CARDS = mergePorSKU(CARDS);
      renderCards();
    } catch (e) {
      console.error(e);
      toast(`Falha ao sugerir itens. ${e.message||''}`);
      if (e.status === 429) startCooldown(btnSugerir, e.retryAfter || 20);
    } finally {
      setLoading(btnSugerir, false);
      LOCK_SUGERIR = false;
    }
  });

  /* ====== Confirmar (salvar orçamento) ====== */
  btnConfirm?.addEventListener('click', async () => {
    if (LOCK_SALVAR) return;
    LOCK_SALVAR = true;
    setLoading(btnConfirm, true);

    const tabela_preco_id = Number(inpTabela.value);
    if (!tabela_preco_id) { toast('Escolha a Tabela de Preço válida.'); setLoading(btnConfirm,false); LOCK_SALVAR=false; return; }
    if (!CARDS.length)    { toast('Nenhum item na lista.'); setLoading(btnConfirm,false); LOCK_SALVAR=false; return; }

    try {
      const j = await handleFetchJson(fetch(`${API}/salvar`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          tabela_preco_id,
          itens: CARDS.map(c => ({
            sku: c.sku,
            descricao: c.descricao,
            unidade: c.unidade,
            qtd: Number(c.qtd || 1),
            preco_unit: Number(c.preco_unit || 0)
          }))
        })
      }));
      toast(`Budget #${j.id} criado com sucesso!`);
      CARDS = []; renderCards(); txtLinhas.value = ''; preview.innerHTML = '';
    } catch (e) {
      console.error(e);
      toast(`Falha ao salvar orçamento. ${e.message||''}`);
    } finally {
      setLoading(btnConfirm, false);
      LOCK_SALVAR = false;
    }
  });

  /* ====== Limpar ====== */
  btnLimpar?.addEventListener('click', () => {
    txtLinhas.value = '';
    CARDS = [];
    renderCards();
    preview.innerHTML = '';
  });

  /* ====== CRUD VÍNCULOS (iaBudgetsVinculos) ====== */
  async function carregarVinculos() {
    const q = (filtro.value || '').trim();
    const qs = q ? `?ilike=${encodeURIComponent(q)}` : '';
    const r = await fetch(`${APIV}/vinculos${qs}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || 'Falha ao listar vínculos');
    VINCULOS = j.data || j; // compat
    renderVinculos();
  }

  function renderVinculos() {
    gridVinculos.innerHTML = '';
    (VINCULOS || []).forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.id}</td>
        <td><input class="input input-sm" data-k="produto_id"  data-id="${v.id}" value="${v.produto_id ?? ''}"></td>
        <td><input class="input input-sm" data-k="produto_sku" data-id="${v.id}" value="${v.produto_sku ?? ''}"></td>
        <td><input class="input input-sm" data-k="palavras_chave" data-id="${v.id}" value="${v.palavras_chave ?? ''}"></td>
        <td class="right">
          <button class="btn btn-outline btn-xs" data-act="save" data-id="${v.id}">💾 Salvar</button>
          <button class="btn btn-ghost  btn-xs" data-act="del"  data-id="${v.id}">🗑 Excluir</button>
        </td>
      `;
      gridVinculos.appendChild(tr);
    });
  }

  gridVinculos?.addEventListener('click', async (ev) => {
    const act = ev.target?.dataset?.act;
    const id  = ev.target?.dataset?.id;
    if (!act || !id) return;

    if (act === 'save') {
      const row = gridVinculos.querySelectorAll(`[data-id="${id}"]`);
      const data = {};
      row.forEach(inp => { data[inp.dataset.k] = inp.value; });
      try {
        const r = await fetch(`${APIV}/vinculos/${id}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Erro ao atualizar');
        toast('✅ Vínculo atualizado.');
        await carregarVinculos();
      } catch (e) {
        console.error(e); toast('Falha ao atualizar vínculo.');
      }
    }

    if (act === 'del') {
      if (!confirm('Confirma excluir este vínculo?')) return;
      try {
        const r = await fetch(`${APIV}/vinculos/${id}`, { method:'DELETE' });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Erro ao excluir');
        toast('🗑 Vínculo removido.');
        await carregarVinculos();
      } catch (e) {
        console.error(e); toast('Falha ao excluir vínculo.');
      }
    }
  });

  formNovo?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = {
      produto_id:   novoId.value ? Number(novoId.value) : undefined,
      produto_sku:  (novoSku.value || undefined),
      palavras_chave: novoPalavras.value || ''
    };
    if (!payload.produto_id && !payload.produto_sku) return toast('Informe produto por ID ou por SKU.');
    if (!payload.palavras_chave.trim()) return toast('Informe as palavras-chave.');
    try {
      const r = await fetch(`${APIV}/vinculos`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro ao criar vínculo');
      toast('➕ Vínculo criado.');
      formNovo.reset();
      await carregarVinculos();
    } catch (e) {
      console.error(e); toast('Falha ao criar vínculo.');
    }
  });

  btnLimparNovo?.addEventListener('click', () => formNovo.reset());
  filtro?.addEventListener('input', () => carregarVinculos());
  btnReload?.addEventListener('click', () => carregarVinculos());

  /* ====== BUSCA DE PRODUTOS NO BANCO (autocomplete) ====== */
  async function buscarProdutos(q){
    if (!q || q.length < 2) { buscaBox.style.display='none'; buscaBox.innerHTML=''; return; }
    try{
      const r = await fetch(`${APIV}/produtos?query=${encodeURIComponent(q)}&limit=20`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Falha ao buscar produtos');
      renderResultadosBusca(j.data || []);
    }catch(e){
      console.error(e);
      renderResultadosBusca([]);
    }
  }

  function renderResultadosBusca(list){
    if (!list.length){ buscaBox.style.display='none'; buscaBox.innerHTML=''; return; }
    buscaBox.innerHTML = list.map(p => `
      <div class="busca-item" data-id="${p.id}" data-sku="${p.sku||''}">
        <span class="sku">${p.sku || '—'}</span>
        <span class="desc">${p.descricao || '(sem descrição)'}</span>
        <span class="price">${(Number(p.preco_venda||0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
      </div>
    `).join('');
    buscaBox.style.display = 'block';
  }

  const doSearch = debounce((e)=> buscarProdutos(e.target.value.trim()), 300);
  buscaInp?.addEventListener('input', doSearch);
  buscaBox?.addEventListener('click', (ev)=>{
    const item = ev.target.closest('.busca-item');
    if (!item) return;
    novoId.value  = item.dataset.id || '';
    novoSku.value = item.dataset.sku || '';
    buscaBox.style.display='none';
  });

  // Fechar a caixa com ESC ou clique fora
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { buscaBox.style.display='none'; }
  });
  document.addEventListener('click', (ev) => {
    if (!buscaBox.contains(ev.target) && ev.target !== buscaInp) {
      buscaBox.style.display='none';
    }
  });

  // Navegação com setas + Enter
  let buscaIndex = -1;
  buscaInp?.addEventListener('keydown', (ev) => {
    const items = Array.from(buscaBox.querySelectorAll('.busca-item'));
    if (!items.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      buscaIndex = (buscaIndex + 1) % items.length;
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      buscaIndex = (buscaIndex - 1 + items.length) % items.length;
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (buscaIndex >= 0) items[buscaIndex].click();
      return;
    } else {
      return;
    }

    items.forEach((it, i) => it.style.background = (i === buscaIndex ? '#eef3ff' : 'transparent'));
  });

  /* ====== Boot ====== */
  (async function boot(){
    try {
      await Promise.all([carregarTabelas(), carregarUnidades()]);
      renderCards(); // mostra placeholder vazio na tabela
      await carregarVinculos();
    } catch (e) {
      console.error(e); toast('Falha ao iniciar a página.');
    }
  })();
})();
