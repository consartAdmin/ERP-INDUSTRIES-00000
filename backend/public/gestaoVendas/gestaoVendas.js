(() => {
  'use strict';

  // ========== Config ========== //
  const API = '/api/gestao-vendas';

  // Estado lista
  let page = 1;
  const pageSize = 20;
  let totalReg = 0;

  // ========== Utils ========== //
  const qs  = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => [...el.querySelectorAll(sel)];

  const fmtBRL = (n) => {
    const v = Number(n || 0);
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const parseBR = (s) => {
    if (s == null || s === '') return null;
    const n = Number(String(s).replace(/\./g,'').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const toISO = (input) => input ? String(input).slice(0,10) : '';

  function notif(msg, type='info'){
    console.log(`[GV][${type}]`, msg);
  }

  // ========== Tabs ========== //
  function initTabs(){
    const btns = qsa('.tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        qsa('.tab-content').forEach(s => s.classList.remove('active'));
        qs('#'+tab).classList.add('active');
      });
    });
  }

  // ========== Form Lançamento ========== //
  function initForm(){
    // defaults
    qs('#data').value = new Date().toISOString().slice(0,10);
    qs('#desconto').value = '0,00';

    // recomputar total se mudar itens_total/desc
    const itens = qs('#itens_total');
    const desc  = qs('#desconto');
    const total = qs('#total');
    function recompute(){
      const vi = parseBR(itens.value) || 0;
      const vd = parseBR(desc.value)  || 0;
      const tt = Math.max(0, vi - vd);
      total.value = tt.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    itens.addEventListener('input', recompute);
    desc.addEventListener('input', recompute);

    qs('#btnLimpar').addEventListener('click', () => {
      qs('#formVenda').reset();
      qs('#data').value = new Date().toISOString().slice(0,10);
      qs('#desconto').value = '0,00';
    });

    qs('#formVenda').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        data: qs('#data').value,
        cliente_nome: qs('#cliente_nome').value.trim(),
        documento: qs('#documento').value.trim() || null,
        itens_total: parseBR(qs('#itens_total').value),
        desconto: parseBR(qs('#desconto').value) || 0,
        total: parseBR(qs('#total').value),
        forma_pagamento: qs('#forma_pagamento').value,
        status: qs('#status').value,
        observacao: qs('#observacao').value || null,
        origem: 'MANUAL'
      };
      // validações simples
      if (!payload.data || !payload.cliente_nome || !payload.total || !payload.forma_pagamento) {
        notif('Preencha os campos obrigatórios.', 'warn');
        return;
      }
      try{
        const r = await fetch(API, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        await r.json();
        notif('Venda lançada com sucesso!', 'ok');
        qs('#formVenda').reset();
        qs('#data').value = new Date().toISOString().slice(0,10);
        qs('#desconto').value = '0,00';
        loadLista(); // recarrega
      }catch(err){
        console.error(err);
        notif('Erro ao salvar venda.', 'err');
      }
    });
  }

  // ========== Lista / Filtros / Paginação ========== //
  async function loadLista(goPage=page){
    page = goPage;
    const p = new URLSearchParams();
    const de   = qs('#f_de').value;
    const ate  = qs('#f_ate').value;
    const q    = qs('#f_busca').value.trim();
    const st   = qs('#f_status').value;
    const fp   = qs('#f_fp').value;

    if(de) p.set('de', de);
    if(ate) p.set('ate', ate);
    if(q)   p.set('q', q);
    if(st)  p.set('status', st);
    if(fp)  p.set('forma', fp);
    p.set('page', page);
    p.set('pageSize', pageSize);

    try{
      const r = await fetch(`${API}?${p.toString()}`);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      totalReg = Number(js.total || 0);
      renderLista(js.data || []);
      renderPaginacao();
    }catch(err){
      console.error(err);
      notif('Erro ao carregar lista.', 'err');
    }
  }

  function renderLista(rows){
    const tbody = qs('#tbodyVendas');
    tbody.innerHTML = rows.map(row => {
      return `<tr data-id="${row.id}">
        <td>${row.id}</td>
        <td>${toISO(row.data)}</td>
        <td>${row.cliente_nome ?? ''}</td>
        <td>${row.documento ?? ''}</td>
        <td>${fmtBRL(row.itens_total)}</td>
        <td>${fmtBRL(row.desconto)}</td>
        <td><b>${fmtBRL(row.total)}</b></td>
        <td>${row.forma_pagamento}</td>
        <td>${row.status}</td>
        <td class="col-acoes">
          <button class="btn btn--secondary btn-editar" title="Editar">✏️</button>
          <button class="btn btn--secondary btn-excluir" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    // ações
    qsa('.btn-excluir', tbody).forEach(btn=>{
      btn.addEventListener('click', async (ev)=>{
        const tr = ev.currentTarget.closest('tr');
        const id = tr?.dataset?.id;
        if(!id) return;
        if(!confirm('Excluir este registro?')) return;
        try{
          const r = await fetch(`${API}/${id}`, { method:'DELETE' });
          if(!r.ok) throw new Error(`HTTP ${r.status}`);
          notif('Excluído com sucesso!', 'ok');
          loadLista();
        }catch(err){
          console.error(err);
          notif('Erro ao excluir.', 'err');
        }
      });
    });

    qsa('.btn-editar', tbody).forEach(btn=>{
      btn.addEventListener('click', async (ev)=>{
        const tr = ev.currentTarget.closest('tr');
        const id = tr?.dataset?.id;
        if(!id) return;
        try{
          const r = await fetch(`${API}/${id}`);
          if(!r.ok) throw new Error(`HTTP ${r.status}`);
          const row = await r.json();
          // carrega no form para edição simples (overwrite)
          qs('#data').value = toISO(row.data);
          qs('#cliente_nome').value = row.cliente_nome || '';
          qs('#documento').value = row.documento || '';
          qs('#itens_total').value = Number(row.itens_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});
          qs('#desconto').value = Number(row.desconto || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});
          qs('#total').value = Number(row.total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});
          qs('#forma_pagamento').value = row.forma_pagamento || '';
          qs('#status').value = row.status || 'CONCLUIDA';
          qs('#observacao').value = row.observacao || '';

          // troca submit para PUT temporariamente
          const form = qs('#formVenda');
          const handler = async (e) => {
            e.preventDefault();
            const payload = {
              data: qs('#data').value,
              cliente_nome: qs('#cliente_nome').value.trim(),
              documento: qs('#documento').value.trim() || null,
              itens_total: parseBR(qs('#itens_total').value),
              desconto: parseBR(qs('#desconto').value) || 0,
              total: parseBR(qs('#total').value),
              forma_pagamento: qs('#forma_pagamento').value,
              status: qs('#status').value,
              observacao: qs('#observacao').value || null,
              origem: 'MANUAL'
            };
            try{
              const r = await fetch(`${API}/${id}`, {
                method:'PUT', headers:{'Content-Type':'application/json'},
                body: JSON.stringify(payload)
              });
              if(!r.ok) throw new Error(`HTTP ${r.status}`);
              await r.json();
              notif('Registro atualizado!', 'ok');
              form.removeEventListener('submit', handler);
              form.reset();
              qs('#data').value = new Date().toISOString().slice(0,10);
              qs('#desconto').value = '0,00';
              loadLista();
            }catch(err){
              console.error(err);
              notif('Erro ao atualizar.', 'err');
            }
          };
          // garante que não duplica handlers
          form.replaceWith(form.cloneNode(true));
          // rebind + recoloca handlers padrão:
          initForm();
          qs('#formVenda').addEventListener('submit', handler);
        }catch(err){
          console.error(err);
          notif('Erro ao carregar registro.', 'err');
        }
      });
    });
  }

  function renderPaginacao(){
    const totalPages = Math.max(1, Math.ceil(totalReg / pageSize));
    qs('#pageInfo').textContent = `Página ${page}/${totalPages}`;
    qs('#prevPage').disabled = page <= 1;
    qs('#nextPage').disabled = page >= totalPages;
  }

  function initPaginacao(){
    qs('#prevPage').addEventListener('click', ()=> page>1 && loadLista(page-1));
    qs('#nextPage').addEventListener('click', ()=> loadLista(page+1));
    qs('#btnFiltrar').addEventListener('click', ()=> loadLista(1));
    // enter no campo busca
    qs('#f_busca').addEventListener('keydown', (e)=> { if(e.key==='Enter'){ e.preventDefault(); loadLista(1); }});
  }

  // ========== Exportar CSV ========== //
  function exportCSV(rows){
    const cols = ['ID','Data','Cliente','Documento','Itens','Desconto','Total','Forma','Status'];
    const header = cols.join(';');
    const body = rows.map(r => [
      r.id, toISO(r.data),
      (r.cliente_nome||'').replaceAll(';',','), (r.documento||''),
      String(r.itens_total).replace('.',','), String(r.desconto).replace('.',','), String(r.total).replace('.',','),
      r.forma_pagamento, r.status
    ].join(';')).join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gestaoVendas_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initExportar(){
    qs('#btnExportarCSV').addEventListener('click', async ()=>{
      // exporta os registros filtrados (até 2000 para não pesar)
      const p = new URLSearchParams();
      const de   = qs('#f_de').value;
      const ate  = qs('#f_ate').value;
      const q    = qs('#f_busca').value.trim();
      const st   = qs('#f_status').value;
      const fp   = qs('#f_fp').value;
      if(de) p.set('de', de);
      if(ate) p.set('ate', ate);
      if(q)   p.set('q', q);
      if(st)  p.set('status', st);
      if(fp)  p.set('forma', fp);
      p.set('page', 1);
      p.set('pageSize', 2000);
      try{
        const r = await fetch(`${API}?${p.toString()}`);
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        exportCSV(js.data || []);
      }catch(err){
        console.error(err);
        notif('Erro ao exportar CSV.', 'err');
      }
    });
  }

  // ========== Relatório ========== //
  function initRelatorio(){
    qs('#btnRelatorio').addEventListener('click', loadRelatorio);
  }

  async function loadRelatorio(){
    const de = qs('#r_de').value;
    const ate = qs('#r_ate').value;
    const st = qs('#r_status').value;
    const p = new URLSearchParams();
    if(de) p.set('de', de);
    if(ate) p.set('ate', ate);
    if(st) p.set('status', st);

    try{
      const r = await fetch(`${API}/relatorio/diario?${p.toString()}`);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      renderRelatorio(js);
    }catch(err){
      console.error(err);
      notif('Erro ao gerar relatório.', 'err');
    }
  }

  function renderRelatorio(data){
    const { grupos = [], totais = {} } = data || {};
    // Tabela
    const tbody = qs('#tbodyRelatorio');
    tbody.innerHTML = grupos.map(g => `
      <tr>
        <td>${toISO(g.data)}</td>
        <td>${g.status}</td>
        <td>${g.qtde_vendas}</td>
        <td>${fmtBRL(g.soma_itens)}</td>
        <td>${fmtBRL(g.soma_descontos)}</td>
        <td><b>${fmtBRL(g.soma_total)}</b></td>
      </tr>
    `).join('');

    // KPIs
    qs('#kpiItens').textContent = fmtBRL(totais.soma_itens || 0);
    qs('#kpiDesc').textContent  = fmtBRL(totais.soma_descontos || 0);
    qs('#kpiTotal').textContent = fmtBRL(totais.soma_total || 0);
  }

  // ========== Boot ========== //
  function boot(){
    initTabs();
    initForm();
    initPaginacao();
    initExportar();
    initRelatorio();
    loadLista(1);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
