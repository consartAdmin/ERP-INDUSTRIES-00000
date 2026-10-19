// ╔═════════════════════════════════════════════════════════════════════╗
// ║ parametrosFiscais.js – carrega/salva Sequência e Ambiente da NF-e   ║
/* ║ Rotas usadas (definidas no backend):
   GET  /api/paramfiscais/sequencia
   PUT  /api/paramfiscais/sequencia
   GET  /api/paramfiscais/ambiente
   PUT  /api/paramfiscais/ambiente
*/
// ╚═════════════════════════════════════════════════════════════════════╝

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ============= Sequência =============
  async function carregarSequencia(){
    const r = await fetch('/api/paramfiscais/sequencia');
    const j = await r.json();
    if (!j.ok) { alert(j.message || 'Falha ao carregar sequência'); return; }
    const s = j.data || {};

    $('#empresa_id').value       = s.empresa_id ?? 1;
    $('#filial_id').value        = s.filial_id ?? 1;
    $('#modelo').value           = s.modelo ?? '55';
    $('#serie').value            = s.serie ?? 1;
    $('#proximo_numero').value   = s.proximo_numero ?? 1;
    $('#ultimo_autorizado').value= s.ultimo_autorizado ?? '';
    $('#ultimo_atualizado').value= s.ultimo_atualizado ? new Date(s.ultimo_atualizado).toLocaleString() : '';
  }

  async function salvarSequencia(ev){
    ev?.preventDefault();
    const payload = {
      empresa_id:       Number($('#empresa_id').value || 1),
      filial_id:        Number($('#filial_id').value || 1),
      modelo:           String($('#modelo').value || '55'),
      serie:            Number($('#serie').value || 1),
      proximo_numero:   Number($('#proximo_numero').value || 1),
      ultimo_autorizado: $('#ultimo_autorizado').value === '' ? null : Number($('#ultimo_autorizado').value),
    };

    const r = await fetch('/api/paramfiscais/sequencia', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!j.ok) { alert(j.message || 'Erro ao salvar sequência'); return; }
    await carregarSequencia();
    alert('Sequência salva com sucesso.');
  }

  // ============= Ambiente =============
  async function carregarAmbiente(){
    const r = await fetch('/api/paramfiscais/ambiente');
    const j = await r.json();
    if (!j.ok) { alert(j.message || 'Falha ao carregar ambiente'); return; }
    const a = j.data || {};

    $('#empresa_id_amb').value = a.empresa_id ?? 1;
    $('#motivo').value         = a.motivo ?? '';
    $('#updated_at').value     = a.updated_at ? new Date(a.updated_at).toLocaleString() : '';

    // marca rádio
    const v = String(a.tp_amb ?? '2'); // default homologação
    $$('input[name="tp_amb"]').forEach(r => r.checked = (r.value === v));
  }

  async function salvarAmbiente(ev){
    ev?.preventDefault();
    const checked = $$('input[name="tp_amb"]').find(r => r.checked);
    const tp_amb = checked ? Number(checked.value) : 2;

    const payload = {
      empresa_id: Number($('#empresa_id_amb').value || 1),
      tp_amb, // 1=Produção, 2=Homologação
      motivo: String($('#motivo').value || ''),
    };

    const r = await fetch('/api/paramfiscais/ambiente', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!j.ok) { alert(j.message || 'Erro ao salvar ambiente'); return; }
    await carregarAmbiente();
    alert('Ambiente salvo com sucesso.');
  }

  // Bind
  $('#formSequencia').addEventListener('submit', salvarSequencia);
  $('#btnRecarregarSequencia').addEventListener('click', carregarSequencia);

  $('#formAmbiente').addEventListener('submit', salvarAmbiente);
  $('#btnRecarregarAmbiente').addEventListener('click', carregarAmbiente);

  // Start
  carregarSequencia().catch(console.error);
  carregarAmbiente().catch(console.error);
})();
