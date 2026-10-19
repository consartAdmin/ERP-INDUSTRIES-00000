CONSART ERP - inboundInvoices + PRODUCT_STOCK_MODE
==================================================

Este pacote preserva o modulo inboundInvoices e aplica PRODUCT_STOCK_MODE como
fonte unica das regras de lote/estoque no backend.

ARQUITETURA
-----------
- *.repository.js: persistencia / DAL.
- *.service.js: regra de negocio PRODUCT_STOCK_MODE.
- inboundInvoices.stockMode.js: helper de frontend para o modal.
- appFeaturesApi.resolveFeature(): fonte de verdade do modo ativo no backend.

ARQUIVOS PRINCIPAIS ATUALIZADOS
-------------------------------
- inboundStockMode.service.js
  Resolve PRODUCT_STOCK_MODE diretamente em appFeatures.

- markInvoicePostedWithStockMode.service.js
  Antes de postar a entrada, resolve/persiste os lotes quando STOCK_WITH_LOT.

- ensureInboundItemLots.repository.js
  Novo repository responsável por:
  * validar lot_id já selecionado;
  * localizar lote pela origem NF-e;
  * localizar lote pelo código do XML;
  * reutilizar LOTE PADRÃO do produto/grade quando aplicável;
  * criar lote quando necessário;
  * gravar inboundInvoiceItems.lot_id antes da movimentação.

- index.js
  Exporta os novos helpers de resolução de lote.

FONTE DE VERDADE DO STOCK MODE
------------------------------
Feature:
  PRODUCT_STOCK_MODE

Opções suportadas:
  STOCK_SIMPLE
  STOCK_WITH_LOT

Escopo padrão:
  GLOBAL / 1

O backend não usa mais productsStock.manager.js para decidir o modo do Inbound.
A resolução é feita por appFeaturesApi.resolveFeature().

REGRAS - STOCK_SIMPLE
---------------------
- item.lot_id é convertido para NULL antes da persistência via index.
- antes de postar a NF-e, lot_id antigos da nota são limpos no backend.
- a postagem não exige lote.

REGRAS - STOCK_WITH_LOT
-----------------------
- importar/criar item da NF-e ainda pode ocorrer sem lote.
- no momento da postagem/aplicação ao estoque, o backend resolve o lote.
- se o item já possui lot_id, o lote é validado contra product_stock_id e grade.
- se lot_id estiver vazio, a resolução segue esta ordem:
  1) lote já vinculado à mesma nfe_key + nfe_item_seq;
  2) lote informado no XML/raw_product_payload (nLote/lot/lote);
  3) LOTE PADRÃO para o mesmo product_stock_id + product_grade_id;
  4) criação de um novo lote.
- o lot_id final é persistido em inboundInvoiceItems antes de registrar a
  movimentação da entrada.

LOTE CRIADO AUTOMATICAMENTE
---------------------------
Quando a NF-e não informa nLote e nenhum lote compatível existe, o código usa:
  LOTE PADRÃO

O lote novo é criado com:
- product_stock_id do product_code;
- product_grade_id do item, quando existente;
- qty_on_hand = 0;
- qty_reserved = 0;
- cost_unit = unit_price, quando disponível;
- nfe_key e nfe_item_seq como metadados de origem;
- is_active = TRUE.

A quantidade do lote NÃO é incrementada neste repository. A atualização física
do estoque continua pertencendo ao fluxo de postagem/estoque já existente,
evitando dupla contabilização.

FRONTEND
--------
Use inboundInvoices.stockMode.js no código do modal. Ele não altera classes,
HTML ou CSS; apenas habilita/desabilita campos de lote existentes e normaliza
o payload.

IMPORTANTE
----------
Este pacote não altera HTML/CSS/layout.

BACKFILL DE DADOS HISTÓRICOS
----------------------------
O arquivo backfillInboundInvoiceItemLots.sql corrige itens antigos que já
existiam com inboundInvoiceItems.lot_id NULL. Ele prioriza a origem exata da
NF-e e, na ausência dela, vincula LOTE PADRÃO da mesma grade/produto.

Para bases já em produção, execute esse SQL uma vez após publicar o backend
atualizado e revise o SELECT final para os itens que permanecerem sem lote.
