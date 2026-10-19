// /backend/public/customers/customerRegistration.js
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerRegistration.js — Cadastro de Clientes (PRODNEX ERP | ESM)  ║
// ║ Integração com API Pública de CNPJ (/api/public-cnpj/:cnpj)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const ROUTES = Object.freeze({
  // Novo endpoint “oficial” (campo name)
  customersNew: `${API_BASE}/api/customers/new`,
  // Endpoint legado (trade_name / legal_name) – usado como fallback
  customersLegacy: `${API_BASE}/api/customers`,
  customerById: id => `${API_BASE}/api/customers/${encodeURIComponent(id)}`,
  segmentos: `${API_BASE}/api/segmentos`,
  classificacoes: `${API_BASE}/api/classificacoes`,
  vendedores: `${API_BASE}/api/vendedores`,
  // 🔄 Agora usando a rota pública que criamos no backend
  consultaCnpj: cnpj => `${API_BASE}/api/public-cnpj/${cnpj}` 
});

const $  = (s, r=document) => r.querySelector(s);
const get = id => document.getElementById(id)?.value ?? '';
const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v??''; };

document.addEventListener('DOMContentLoaded', async () => {
  bindUI();
  masks();
  await loadSelects();
});

function bindUI(){
  $('#btnVoltar')?.addEventListener('click',()=> history.back());
  $('#btnCancelar')?.addEventListener('click',()=> history.back());
  $('#formCliente')?.addEventListener('submit', onSubmit);
  $('#postal_code')?.addEventListener('blur', buscarCEP);
  $('#btnBuscarCNPJ')?.addEventListener('click', buscarCNPJ);
}

function onlyDigits(s){ return String(s??'').replace(/\D+/g,''); }
function trimOrNull(s){ const v=String(s??'').trim(); return v||null; }

async function onSubmit(e){
  e.preventDefault();

  // Campo único
  const name = trimOrNull(get('name'));

  const basePayload = {
    name, // novo padrão do backend
    person_type: get('person_type') || null,
    tax_id: onlyDigits(get('tax_id')),
    business_segment: trimOrNull(get('business_segment')),
    classification: trimOrNull(get('classification')),
    salesperson: trimOrNull(get('salesperson')),
    is_active: String(get('is_active')).toLowerCase()==='true',
    email: trimOrNull(get('email')),
    postal_code: trimOrNull(onlyDigits(get('postal_code'))),
    street_type: trimOrNull(get('street_type')),
    street_name: trimOrNull(get('street_name')),
    street_number: trimOrNull(get('street_number')),
    address_complement: trimOrNull(get('address_complement')),
    neighborhood: trimOrNull(get('neighborhood')),
    city: trimOrNull(get('city')),
    state: trimOrNull(get('state')),
    contact_name: trimOrNull(get('contact_name')),
    phone_number: trimOrNull(get('phone_number')),
    mobile_number: trimOrNull(get('mobile_number')),
    asaas_id: trimOrNull(get('asaas_id')),
    state_registration: trimOrNull(get('state_registration')),
    municipal_registration: trimOrNull(get('municipal_registration'))
  };

  if (!basePayload.name)
    return showCenterModal({variant:'warning',title:'Validação',message:'Informe o Nome.'});
  if (!basePayload.tax_id)
    return showCenterModal({variant:'warning',title:'Validação',message:'Informe o CNPJ/CPF.'});

  try{
    // 1) Tenta novo endpoint (usa "name")
    const r1 = await fetch(ROUTES.customersNew, {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(basePayload)
    });

    let js;
    if (r1.ok) {
      js = await r1.json().catch(()=> ({}));
    } else {
      // 2) Fallback: endpoint legado
      const legacyPayload = {
        ...basePayload,
        // compatibilidade: preenche os dois com o mesmo "name"
        trade_name: basePayload.name,
        legal_name: basePayload.name
      };
      const r2 = await fetch(ROUTES.customersLegacy, {
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(legacyPayload)
      });
      js = await r2.json().catch(()=> ({}));
      if (!r2.ok) throw new Error(js?.error || `HTTP ${r2.status}`);
    }

    showCenterModal({
      variant:'success',
      title:'Cliente criado',
      message:'Cadastro realizado com sucesso!',
      timeoutMs:2200
    });

    const id = js?.customer_id || js?.id || js?.data?.id;
    if (id) setTimeout(()=> location.replace(`./customersEdit.html?id=${id}`), 300);

  }catch(err){
    console.error(err);
    showCenterModal({
      variant:'error',
      title:'Falha ao salvar',
      message:'Não foi possível salvar o cliente.'
    });
  }
}

async function loadSelects(){
  await Promise.all([
    fillSelect('business_segment', ROUTES.segmentos),
    fillSelect('classification',   ROUTES.classificacoes),
    fillSelect('salesperson',      ROUTES.vendedores),
  ]).catch(console.warn);
}
async function fillSelect(id, url){
  const el = document.getElementById(id);
  if (!el) return;
  try{
    const r = await fetch(url, { headers:{'Accept':'application/json'}});
    const arr = await r.json();
    el.innerHTML = '<option value="">Selecione…</option>';
    (Array.isArray(arr)?arr:[]).forEach(it=>{
      const v = it?.id ?? it?.nome ?? it?.descricao ?? it?.name ?? '';
      const t = it?.nome ?? it?.descricao ?? it?.name ?? String(v);
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      el.appendChild(o);
    });
  }catch(e){ console.warn('fillSelect', id, e); }
}

async function buscarCEP(){
  const cep = onlyDigits(get('postal_code'));
  if (cep.length !== 8) return;
  try{
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d?.erro) throw new Error('CEP não encontrado');
    const log = (d.logradouro||'').trim();
    let tipo='', nome=log;
    const m = log.match(/^([A-Za-zÀ-ÿ\.]{2,12})\s+(.*)$/);
    if (m){ tipo = m[1].replace('.','').toUpperCase(); nome = m[2]; }
    set('street_type', tipo);
    set('street_name', nome);
    set('neighborhood', d.bairro||'');
    set('city', d.localidade||'');
    set('state', d.uf||'');
  }catch(e){
    showCenterModal({variant:'warning',title:'CEP',message:'Erro ao buscar CEP.'});
  }
}

/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ Consulta CNPJ (API Pública / Backend CONSART)                        ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */
async function buscarCNPJ(){
  const raw = get('tax_id');
  const cnpj = onlyDigits(raw);

  if (cnpj.length !== 14) {
    return showCenterModal({
      variant:'warning',
      title:'CNPJ inválido',
      message:'Informe 14 dígitos.'
    });
  }

  const btn = document.getElementById('btnBuscarCNPJ');
  if (btn){
    btn.disabled = true;
    btn.textContent = 'Buscando…';
  }

  try{
    // 🔄 Chama a rota pública que criamos: /api/public-cnpj/:cnpj
    const r = await fetch(ROUTES.consultaCnpj(cnpj), {
      headers:{'Accept':'application/json'}
    });
    const js = await r.json();

    if (!r.ok) {
      throw new Error(js?.message || `HTTP ${r.status}`);
    }

    // Pode vir direto (publica.cnpj.ws) ou envelopado (futuro)
    const d   = js.dados || js.data || js;
    const est = d.estabelecimento || {};

    // Único campo de nome (prioriza fantasia)
    const nome =
      est.nome_fantasia ||
      d.razao_social ||
      est.razao_social ||
      '';

    set('name', nome);

    // CEP / endereço
    if (est.cep) {
      set('postal_code', String(est.cep).replace(/\D/g,''));
    }
    set('address_complement', est.complemento || '');
    set('neighborhood', est.bairro || '');

    // Cidade / estado (objetos aninhados)
    const cidade = est.cidade || {};
    const estado = est.estado || {};
    set('city',  cidade.nome || '');
    set('state', estado.sigla || '');

    // E-mail
    set('email', est.email || '');

    // Telefone básico (usa ddd1 + telefone1)
    let telefone = '';
    if (est.ddd1 && est.telefone1) {
      telefone = `(${est.ddd1}) ${est.telefone1}`;
    } else if (est.telefone1) {
      telefone = est.telefone1;
    }
    set('phone_number', telefone);

    // IE (primeira inscrição estadual, se existir)
    const ieArr = Array.isArray(est.inscricoes_estaduais)
      ? est.inscricoes_estaduais
      : [];
    if (ieArr.length > 0) {
      set('state_registration', ieArr[0].inscricao_estadual || '');
    }

    // Logradouro: separa em tipo + nome (ex: "AVENIDA BIAS FORTES")
    const log = est.logradouro || '';
    if (log){
      const m = String(log).trim().match(/^([A-Za-zÀ-ÿ\.]{2,15})\s+(.*)$/);
      if (m){
        set('street_type', m[1].replace('.','').toUpperCase());
        set('street_name', m[2]);
      } else {
        set('street_name', log);
      }
    }

    showCenterModal({
      variant:'success',
      title:'CNPJ encontrado',
      message:'Dados preenchidos a partir da consulta pública.',
      timeoutMs:2000
    });
  }catch(e){
    console.error(e);
    showCenterModal({
      variant:'error',
      title:'Consulta CNPJ',
      message:'Não foi possível consultar.'
    });
  }finally{
    if (btn){
      btn.disabled = false;
      btn.textContent = 'Buscar CNPJ';
    }
  }
}

function masks(){
  const tax=$('#tax_id'), tel=$('#phone_number'), cel=$('#mobile_number'), cep=$('#postal_code');

  tax?.addEventListener('input', ()=>{
    let v=onlyDigits(tax.value).slice(0,14);
    if (v.length<=11){
      v=v.replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    } else {
      v=v.replace(/^(\d{2})(\d)/,'$1.$2')
         .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
         .replace(/\.(\d{3})(\d)/,'.$1/$2')
         .replace(/(\d{4})(\d)/,'$1-$2');
    }
    tax.value=v;
  });

  tel?.addEventListener('input', ()=>{
    tel.value=onlyDigits(tel.value)
      .slice(0,10)
      .replace(/^(\d{2})(\d)/,'($1) $2')
      .replace(/(\d{4})(\d)/,'$1-$2');
  });

  cel?.addEventListener('input', ()=>{
    cel.value=onlyDigits(cel.value)
      .slice(0,11)
      .replace(/^(\d{2})(\d)/,'($1) $2')
      .replace(/(\d{5})(\d)/,'$1-$2');
  });

  cep?.addEventListener('input', ()=>{
    cep.value=onlyDigits(cep.value)
      .slice(0,8)
      .replace(/(\d{5})(\d)/,'$1-$2');
  });
}
