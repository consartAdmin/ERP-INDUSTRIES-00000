const el = id => document.getElementById(id);
const fmtBRL = v => (isFinite(v)? v : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const onlyNum = s => (s||'').replace(/[^\d,.-]/g,'').replace(',', '.');
const parseMoney = input => {
  const n = Number(onlyNum(input?.value ?? input));
  return isNaN(n) ? 0 : n;
};
const todayISO = ()=> {
  const d = new Date();
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
};

const credor=el('credor'), nf=el('nf'), valorOriginal=el('valorOriginal');
const vencimento=el('vencimento'), dataCalculo=el('dataCalculo');
const jurosMes=el('jurosMes'), jurosDia=el('jurosDia');
const multaPerc=el('multaPerc'), usarMultaFixa=el('usarMultaFixa'), multaFixa=el('multaFixa');
const taxaCobranca=el('taxaCobranca'), taxasFixas=el('taxasFixas');
const kDias=el('kDias'), kAtualizado=el('kAtualizado'), kFinal=el('kFinal');
const outCredor=el('outCredor'), outNF=el('outNF'), outOriginal=el('outOriginal');
const outAtualizado=el('outAtualizado'), outFinal=el('outFinal'), documento=el('documento');

dataCalculo.value = todayISO();

function calcular(){
  const valor0 = parseMoney(valorOriginal);
  const dtV = new Date(vencimento.value);
  const dtC = new Date(dataCalculo.value || todayISO());
  const diasAtraso = Math.max(0, Math.ceil((dtC - dtV) / (1000*60*60*24)));

  const jMes = parseMoney(jurosMes);
  const jDia = jurosDia.value ? parseMoney(jurosDia) : (jMes/30);
  const valorJuros = valor0 * ((jDia/100) * diasAtraso);

  let valorMulta = 0;
  if(usarMultaFixa.checked){
    valorMulta = parseMoney(multaFixa);
  }else{
    valorMulta = valor0 * (parseMoney(multaPerc)/100);
  }

  const atualizado = valor0 + valorJuros + valorMulta;

  const valorTaxa = atualizado * (parseMoney(taxaCobranca)/100);
  const outras = parseMoney(taxasFixas);
  const final = atualizado + valorTaxa + outras;

  // KPIs
  kDias.textContent = diasAtraso;
  kAtualizado.textContent = fmtBRL(atualizado);
  kFinal.textContent = fmtBRL(final);

  // Documento
  outCredor.textContent = credor.value || '—';
  outNF.textContent = nf.value || '—';
  outOriginal.textContent = fmtBRL(valor0);
  outAtualizado.textContent = fmtBRL(atualizado);
  outFinal.textContent = fmtBRL(final);

  const hoje = new Date().toLocaleDateString('pt-BR');
  const l1 = `Assunto: Cobrança Extrajudicial – NF ${nf.value || '—'}`;
  const l2 = `${credor.value || 'CONSART'} comunica que o título referente à Nota Fiscal nº ${nf.value || '—'} encontra-se em atraso desde ${vencimento.value ? new Date(vencimento.value).toLocaleDateString('pt-BR') : '—'}.`;
  const l3 = `Valor original: ${fmtBRL(valor0)}. Após aplicação de juros (${jDia.toFixed(3)}%/dia por ${diasAtraso} dia(s)) e ${usarMultaFixa.checked ? 'multa fixa de ' + fmtBRL(valorMulta) : 'multa de ' + multaPerc.value + '%'}, o valor atualizado é ${fmtBRL(atualizado)}.`;
  const l4 = `Com taxa de cobrança de ${(taxaCobranca.value||0)}%${outras?` e despesas fixas de ${fmtBRL(outras)}`:''}, o valor final é ${fmtBRL(final)} para quitação até ${hoje}.`;
  const l5 = `Solicitamos regularização em até 48 horas. Persistindo inadimplência, adotaremos medidas legais cabíveis.`;
  const l6 = `Canal de negociação: Central de Cobranças CONSART.`;
  documento.textContent = [l1,'',l2,'',l3,l4,'',l5,'',l6].join('\n');
}

function limpar(){
  document.getElementById("formCobranca").reset();
  dataCalculo.value = todayISO();
  kDias.textContent=kAtualizado.textContent=kFinal.textContent='—';
  outCredor.textContent=outNF.textContent=outOriginal.textContent=outAtualizado.textContent=outFinal.textContent='—';
  documento.textContent='';
}

// botões
el('btnCalcular').addEventListener('click', e=>{e.preventDefault(); calcular();});
el('btnLimpar').addEventListener('click', e=>{e.preventDefault(); limpar();});
el('btnCopiar').addEventListener('click', async e=>{
  e.preventDefault();
  calcular();
  await navigator.clipboard.writeText(documento.textContent);
  alert('Texto copiado!');
});
el('btnImprimir').addEventListener('click', e=>{e.preventDefault(); calcular(); window.print();});
