SPED FISCAL — ARQUIVOS FRONTEND
===============================

Copie os 10 arquivos spedFiscal.*.js para a mesma pasta do frontend.

No HTML, remova o import/script do spedFiscal.js antigo e deixe somente:

<script type="module" src="/CAMINHO/spedFiscal.init.js"></script>

No <head>, carregue também o CSS padrão de resumos:

<link rel="stylesheet" href="/public/includes/css/summary.css">

Exemplo, se os arquivos estiverem em /public/includes/js/spedFiscal/:

<script type="module" src="/public/includes/js/spedFiscal/spedFiscal.init.js"></script>

O HTML não deve importar actions, api, config, form, modal, render, state,
utils ou validation. O spedFiscal.init.js carrega automaticamente todas as
dependências necessárias.

IMPORTANTE
----------
O arquivo spedFiscal.render.js agora utiliza somente as classes padrão
.summary e .summary-pill para toda a área de Prévia. As antigas classes
.sf-company-bar, .sf-company-item, .sf-kpis, .sf-kpi, .sf-layout-bar e
.sf-layout-item não são mais necessárias para o resumo.
