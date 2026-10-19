(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  function preencherTabela(rows) {
    const { tbody } = app.state.elements;
    tbody.innerHTML = '';

    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'Nenhum usuário encontrado.';
      td.style.textAlign = 'center';
      td.style.opacity = '0.8';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach((user) => {
      const tr = document.createElement('tr');
      [user.user_id, user.name || '', user.email || '', user.access_level || ''].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });

      const tdAtivo = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${user.is_active ? 'badge--ativo' : 'badge--inativo'}`;
      badge.textContent = user.is_active ? 'Ativo' : 'Inativo';
      tdAtivo.appendChild(badge);
      tr.appendChild(tdAtivo);

      const tdCriado = document.createElement('td');
      tdCriado.textContent = app.utils.formatDate(user.created_at);
      tr.appendChild(tdCriado);

      const tdAcoes = document.createElement('td');
      tdAcoes.classList.add('col-acoes');
      const div = document.createElement('div');
      div.classList.add('users-actions');
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'btn btn-new btn-sm btn-gap-3';
      editar.textContent = '✏️';
      editar.addEventListener('click', () => app.modal.abrirEdicao(user));
      const excluir = document.createElement('button');
      excluir.type = 'button';
      excluir.className = 'btn btn-new btn-sm';
      excluir.textContent = '🗑️';
      excluir.addEventListener('click', () => app.actions.excluirUsuario(user.user_id, user.name));
      div.append(editar, excluir);
      tdAcoes.appendChild(div);
      tr.appendChild(tdAcoes);
      tbody.appendChild(tr);
    });
  }

  function atualizarResumo(total, page, lim) {
    const e = app.state.elements;
    const inicio = total === 0 ? 0 : (page - 1) * lim + 1;
    const fim = Math.min(total, page * lim);
    e.resumo.textContent = `${total} usuário(s) — exibindo ${inicio}–${fim}`;
    app.state.totalPaginas = total > 0 ? Math.ceil(total / lim) : 1;
    app.state.paginaAtual = page;
    e.paginaInfo.textContent = `Página ${page} de ${app.state.totalPaginas}`;
    e.btnAnterior.disabled = page <= 1;
    e.btnProxima.disabled = page >= app.state.totalPaginas;
  }

  app.render = { preencherTabela, atualizarResumo };
})();
