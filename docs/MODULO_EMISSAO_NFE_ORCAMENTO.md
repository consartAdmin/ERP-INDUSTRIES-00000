# Módulo de Emissão de NF-e — do Orçamento ao `invoicesIssued`

> **Escopo**: fluxo completo de emissão de NF-e a partir de um orçamento
> (`budgets`), desde a pré-visualização do DANFE até o registro final em
> `invoicesIssued`, incluindo baixa de estoque, geração de contas a
> receber/boletos e cancelamento.
>
> **Sistema**: CONSART ERP — backend Node.js (ESM) + Express + PostgreSQL
> **Atualizado em**: 16/09/2026
> **Arquivo central**: `backend/services/apis/nfeIssuanceApi.js`

---

## Sumário

1. [Visão geral do fluxo](#1-visão-geral-do-fluxo)
2. [Mapa de arquivos e responsabilidades](#2-mapa-de-arquivos-e-responsabilidades)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Endpoints REST](#4-endpoints-rest)
5. [Fluxo A — Pré-visualização do DANFE](#5-fluxo-a--pré-visualização-do-danfe)
6. [Fluxo B — Emissão da NF-e](#6-fluxo-b--emissão-da-nf-e)
7. [Fluxo C — Reconciliação de status](#7-fluxo-c--reconciliação-de-status)
8. [Enriquecimento fiscal dos itens (Fiscal V2)](#8-enriquecimento-fiscal-dos-itens-fiscal-v2)
9. [ICMS-ST retido anteriormente (CST 60)](#9-icms-st-retido-anteriormente-cst-60)
10. [Operação fiscal e CFOP](#10-operação-fiscal-e-cfop)
11. [Numeração fiscal da NF-e](#11-numeração-fiscal-da-nf-e)
12. [Baixa e estorno de estoque](#12-baixa-e-estorno-de-estoque)
13. [Financeiro — contas a receber e Asaas](#13-financeiro--contas-a-receber-e-asaas)
14. [Registro final em `invoicesIssued`](#14-registro-final-em-invoicesissued)
15. [Máquina de estados (`nfeStatusMap`)](#15-máquina-de-estados-nfestatusmap)
16. [Idempotência e concorrência](#16-idempotência-e-concorrência)
17. [Catálogo de erros](#17-catálogo-de-erros)
18. [Variáveis de ambiente](#18-variáveis-de-ambiente)
19. [Logs e observabilidade](#19-logs-e-observabilidade)
20. [Caminho paralelo — NF-e de Pedidos (`orders`)](#20-caminho-paralelo--nf-e-de-pedidos-orders)
21. [Pontos de atenção e limitações conhecidas](#21-pontos-de-atenção-e-limitações-conhecidas)
22. [Guia de troubleshooting](#22-guia-de-troubleshooting)

---

## 1. Visão geral do fluxo

O módulo transforma um **orçamento** em uma **NF-e autorizada** e em todos os
seus efeitos colaterais (estoque, financeiro, nota registrada). O processo é
**assíncrono**: a emissão apenas *transmite* o documento e a autorização é
confirmada depois, por consulta ao provedor.

```
┌──────────────┐
│   budgets    │  orçamento com itens, pagamentos, frete e operação fiscal
└──────┬───────┘
       │
       │  GET /nfe-preview.pdf  ──────────────►  DANFE de conferência (não fiscal)
       │
       │  POST /issue  { confirm: true }
       ▼
┌────────────────────────────────────────────────────────────────┐
│ 1. Monta dados do orçamento + cliente + operação fiscal        │
│ 2. Enriquece itens (Fiscal V2 + ICMS-ST de CST 60)             │
│ 3. Valida (itens existem? têm configuração fiscal ativa?)      │
│ 4. TRANSAÇÃO: trava o orçamento, cria a TENTATIVA e reserva    │
│    o número da NF-e  →  budgetsNfeAttempts (+ AttemptItems)    │
│ 5. Monta o payload e transmite ao provedor (PlugNotas)         │
│ 6. Grava provider_id / protocolo / status = PROCESSANDO        │
└──────────────────────────┬─────────────────────────────────────┘
                           │  (o provedor processa junto à SEFAZ)
                           │
       │  GET /status   (polling — chamado pela tela ou manualmente)
       ▼
┌────────────────────────────────────────────────────────────────┐
│ reconcileBudgetNfe: consulta o provedor e aplica o resultado   │
│                                                                │
│  ├─ AUTORIZADA ─► estoque ─► invoicesIssued ─► budgets         │
│  │                                   │          = 'FATURADO'   │
│  │                                   └─► Asaas / boletos       │
│  │                                                             │
│  ├─ CANCELADA ──► invoicesIssued cancelada ─► estorno estoque  │
│  │                              └─► budgets = 'CANCELADO'      │
│  │                                                             │
│  └─ REJEITADA / DENEGADA / ERRO ─► tentativa marcada com erro  │
│                                    (permite nova tentativa)    │
└────────────────────────────────────────────────────────────────┘
       │
       │  GET /xml   ,  GET /danfe.pdf
       ▼
  Documentos fiscais obtidos sob demanda no provedor
```

**Princípio central**: nada é gravado como definitivo antes da autorização.
O orçamento só vira `FATURADO`, o estoque só baixa e a nota só entra em
`invoicesIssued` quando o provedor confirma `AUTORIZADA`.

---

## 2. Mapa de arquivos e responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `backend/routes/budgetsIssuedsRoutes.js` | Rotas HTTP (`/api/budgets-issued`) |
| `backend/controllers/budgetsIssuedsController.js` | Tradução HTTP ↔ serviço, cabeçalhos, códigos de status |
| **`backend/services/apis/nfeIssuanceApi.js`** | **Orquestrador do módulo** — preparação, emissão, reconciliação, XML/DANFE |
| `backend/services/budgetsNfePreviewService.js` | Gera o PDF de pré-visualização do DANFE |
| `backend/services/apis/tecnoSpeedNfeApi.js` | Cliente do provedor fiscal: `buildNFeFromOrder`, `emitirNFe`, `consultarNFe`, `listarNFe`, `obterXml`, `obterPdf` |
| `backend/services/apis/productsFiscalV2.api.js` | Vínculo fiscal vigente do produto (`getCurrent`) |
| `backend/services/stockFromBudgetsService.js` | `applyStockFromBudget` / `rollbackStockFromBudget` |
| `backend/services/apis/nfeAsaasSyncApi.js` | `syncAuthorizedBudgetNfe` — contas a receber e boletos |
| `backend/services/apis/invoicesIssued/invoicesIssuedApi.js` | `upsertFromBudget` — registro final da nota |
| `backend/services/apis/ordersNfeAttempts/ordersNfeAttemptsApi.js` | Mesmo fluxo para **pedidos** (`orders`) |
| `backend/controllers/budgetsController.js` | `getBudgetObjectById` — objeto completo do orçamento |
| `backend/services/apis/customersApi.js` | Dados cadastrais/fiscais do cliente |
| `backend/routes/budgetsNfeAttemptsRoutes.js` | CRUD administrativo das tentativas (`/api/budgets-nfe-attempts`) |

> **Nota sobre o nome do provedor**: o arquivo chama-se `tecnoSpeedNfeApi.js`,
> mas a API efetivamente consumida é a **PlugNotas**
> (`https://api.plugnotas.com.br`) — produto da TecnoSpeed. Os logs de boot
> aparecem como `[PlugNotasNFe]`.

---

## 3. Modelo de dados

### 3.1 Tabelas de origem (orçamento)

| Tabela | Papel no fluxo |
|---|---|
| `budgets` | Cabeçalho: cliente, `operation_type_id`, totais, `status` |
| `budgetsItems` | Itens: `product_code`, `quantity`, `unit_price`, `discount_value`, `conversion_factor`, `grade_id`, `lot_id`, `barcode_id` |
| `budgetsShipping` | Frete / transportadora |
| `budgetsPayments` + `budgetsPaymentInstallments` | Formas de pagamento e parcelas (base do financeiro) |

### 3.2 Tabelas de controle da emissão

| Tabela | Papel no fluxo |
|---|---|
| **`budgetsNfeAttempts`** | Uma linha por **tentativa** de emissão. Guarda `nfe_number`, `provider_id`, `integration_id`, `protocol`, `access_key`, status, datas (`authorized_at`, `rejected_at`, `cancelled_at`, `stock_applied_at`, `stock_reversed_at`) e o payload enviado |
| **`budgetsNfeAttemptItems`** | **Snapshot fiscal imutável** de cada item no momento da tentativa (NCM, CEST, CST, alíquotas, CFOP, ICMS-ST, reforma tributária). É a memória de cálculo da nota |
| `nfeStatusMap` | Dicionário de status: `code`, `name`, `is_final`, `is_authorized`, `is_active` |
| `nfeOperationTypes` | Operações fiscais: `code`, `nature_operation`, `cfop_internal`, `cfop_interstate`, `generates_receivable`, `moves_stock` |
| `nfe` | **Sequência de numeração fiscal** — a linha com `is_active = TRUE` guarda o último número reservado em `sequence_number` |

**Restrições relevantes de `budgetsNfeAttempts`:**

```sql
PRIMARY KEY (attempt_id)
UNIQUE (budget_id, attempt_number)            -- uq_budget_nfe_attempt_number
UNIQUE (access_key)  WHERE access_key  IS NOT NULL AND BTRIM(access_key) <> ''
UNIQUE (provider_id) WHERE provider_id IS NOT NULL
-- nfe_number BIGINT: NÃO possui restrição de unicidade (permite reaproveitamento)
```

### 3.3 Tabelas fiscais do produto (Fiscal V2)

| Tabela | Conteúdo |
|---|---|
| `products_fiscal_v2` | Vínculo produto → classificação fiscal (`is_current`, `is_active`, `version`) |
| `fiscal_classification_v2` | NCM, CEST, EX-TIPI, dados da reforma tributária (IBS/CBS/IS) |
| `fiscal_profile_v2` | CST/CSOSN de ICMS, alíquotas, CFOP entrada/saída, origem, PIS/COFINS, código de benefício |

### 3.4 Tabelas de destino

| Tabela | Papel no fluxo |
|---|---|
| **`invoicesIssued`** | Registro definitivo da nota emitida (`source_type = 'BUDGET'`, `budget_id`) |
| `productsStock`, `productsStockLots`, `productMovements` | Efeitos da baixa/estorno de estoque |
| `accountsReceivable`, `accountsReceivableAsaas` | Contas a receber e ponte com a cobrança Asaas |
| `inboundInvoiceItems` | **Fonte** do ICMS-ST retido para itens CST 60 |
| `customersIbge` | Código IBGE do município do cliente (tabela auxiliar opcional) |

---

## 4. Endpoints REST

Base: **`/api/budgets-issued`** — todas as rotas exigem autenticação
(`requireAuth`).

| Método | Rota | Função | Resposta |
|---|---|---|---|
| `GET` | `/:budgetId/nfe-preview.pdf` | Pré-visualização do DANFE | `200` PDF (`inline`) + header `X-NFE-Preview-Number` |
| `POST` | `/:budgetId/issue` | Emite a NF-e | `202` JSON com a tentativa criada |
| `GET` | `/:budgetId/status` | Reconcilia com o provedor | `200` JSON com status e efeitos aplicados |
| `GET` | `/:budgetId/xml` | XML da NF-e | `200` `application/xml` (`attachment`) |
| `GET` | `/:budgetId/danfe.pdf` | DANFE oficial | `200` PDF (`inline`) |

### 4.1 `POST /:budgetId/issue`

**Confirmação obrigatória** — sem ela a requisição é recusada:

```json
{ "confirm": true }
```

```
400  ISSUE_CONFIRMATION_REQUIRED — "Confirme explicitamente a emissão da NF-e."
```

**Resposta de sucesso (`202 Accepted`):**

```json
{
  "ok": true,
  "message": "NF-e enviada para processamento.",
  "data": {
    "budget_id": 123,
    "attempt_id": 456,
    "provider_id": "6712ab...",
    "id_integracao": "BUD-123-A1",
    "protocol": "135240000123456",
    "status": "PROCESSANDO",
    "environment": "producao",
    "recovered": false
  }
}
```

`recovered: true` indica que a NF-e **já existia no provedor** e foi apenas
revinculada, sem nova transmissão (ver [§6.6](#66-recuperação-idempotência-de-transmissão)).
A mensagem muda para *"NF-e localizada no provedor e vinculada ao orçamento."*.

### 4.2 `GET /:budgetId/status`

Retorna o estado consolidado e o resultado de cada efeito colateral:

```json
{
  "ok": true,
  "data": {
    "budget_id": 123,
    "provider_id": "6712ab...",
    "status": "AUTORIZADA",
    "protocol": "135240000123456",
    "access_key": "31250912345678000199550010000001231234567890",
    "cancelled": false,
    "environment": "producao",
    "xml_url": "/api/budgets-issued/123/xml",
    "danfe_url": "/api/budgets-issued/123/danfe.pdf",
    "stock_sync":       { "ok": true, "applied": true,  "moved": 5 },
    "stock_rollback":   null,
    "invoices_issued":  { "invoice_id": 789, "nfe_number": 1042 },
    "cancellation_sync": null,
    "boleto_sync":      { "ok": true, "created": 3, "reused": 0 }
  }
}
```

### 4.3 CRUD administrativo das tentativas

Base: **`/api/budgets-nfe-attempts`**

| Método | Rota |
|---|---|
| `GET` | `/` · `/budget/:budgetId` · `/:attemptId` |
| `POST` | `/` |
| `PATCH` | `/:attemptId` · `/:attemptId/status` · `/:attemptId/link-invoice` |
| `DELETE` | `/:attemptId` |

> ⚠️ Estas rotas são de manutenção e **não aplicam `requireAuth`**
> (ver [§21](#21-pontos-de-atenção-e-limitações-conhecidas)).

---

## 5. Fluxo A — Pré-visualização do DANFE

```
GET /api/budgets-issued/:budgetId/nfe-preview.pdf
   │
   ├─► getBudgetNfePreparedData(budgetId)        [nfeIssuanceApi.js]
   │      ├─ getBudgetIssuedData()  → orçamento + cliente + operação fiscal
   │      ├─ getBudgetFiscalItems() → itens enriquecidos (Fiscal V2 + ICMS-ST)
   │      └─ assertBudgetItemsAreIssuable()
   │
   └─► generateBudgetNfePreviewPdf(budget)       [budgetsNfePreviewService.js]
          └─ PDF "DANFE PREVIEW ORCAMENTO <id>.pdf"
```

Características importantes:

- **Não cria tentativa, não reserva número e não chama o provedor.** É um
  documento de conferência interno.
- O número exibido é apenas **indicativo** (`previewNfeNumber`, devolvido também
  no header `X-NFE-Preview-Number`). O número fiscal real só é reservado na
  emissão.
- Usa **exatamente as mesmas validações** da emissão
  (`assertBudgetItemsAreIssuable`). Consequência prática desejada: **se o
  preview falha, a emissão falharia igual** — o preview é o teste barato.
- Como o enriquecimento é o mesmo, um item CST 60 sem origem de ICMS-ST **também
  derruba o preview** com `BUDGET_ITEM_ICMS_ST_ORIGIN_NOT_FOUND`.
- Resposta sempre com `Cache-Control: no-store`.

---

## 6. Fluxo B — Emissão da NF-e

Função: `issueBudgetNfe(budgetId, { userId })`

### 6.1 Etapa 1 — Dados do orçamento (`getBudgetIssuedData`)

1. Valida o `budgetId` (inteiro positivo) → `400` se inválido.
2. `getBudgetObjectById(id)` → `404` se não existir.
3. `getCustomerFiscalData(customer_id)`:
   - busca o cliente via `customersApi.getById` (falha é apenas logada);
   - busca o código IBGE em `customersIbge` (se a tabela não existir — erro
     `42P01` — é silenciosamente ignorada, pois algumas instalações retornam o
     IBGE direto pelo `customersApi`);
   - o IBGE é procurado em 8 nomes de campo alternativos e aceito somente com
     **7 dígitos**.
4. `getSelectedFiscalOperation(operation_type_id, uf_cliente)` → ver [§10](#10-operação-fiscal-e-cfop).

Campos do cliente que estejam `null`/`''` **não sobrescrevem** os do orçamento
(filtro aplicado no merge).

### 6.2 Etapa 2 — Itens fiscais (`getBudgetFiscalItems`)

Um `SELECT` único junta `budgetsItems` com:

| Join | Finalidade |
|---|---|
| `grades` | descrição da grade |
| `products` | `product_id`, `product_stock_id` |
| `productsBarCode` | código de barras do item |
| `products_fiscal_v2` (**LATERAL, `LIMIT 1`**) | vínculo fiscal vigente |
| `fiscal_classification_v2` | NCM, CEST, EX-TIPI, IBS/CBS/IS |
| `fiscal_profile_v2` | CST, alíquotas, CFOP, PIS/COFINS |

> O join de `products_fiscal_v2` é **LATERAL com `ORDER BY version DESC LIMIT 1`**
> de propósito: se houver mais de um vínculo marcado como `is_current` para o
> mesmo `product_code`, um `LEFT JOIN` simples **duplicaria o item na NF-e e nos
> totais**.

Em seguida cada linha passa por `rowToFiscalBudgetItem` (normalização com
múltiplos aliases — `ncm`/`ncm_code`, `icms_cst`/`cst_icms` etc., para
compatibilidade com o builder do provedor) e por `enrichBudgetItemForNfe`.

O enriquecimento roda com **concorrência limitada a 4** (`mapWithConcurrency`),
respeitando o pool do PostgreSQL (`PGPOOL_MAX`, padrão 10, com timeout de
aquisição de 8s). A **ordem dos itens é preservada** — ela define o `nItem` da
NF-e.

### 6.3 Etapa 3 — Validações (`assertBudgetItemsAreIssuable`)

| Situação | Erro |
|---|---|
| Nenhum item | `422 BUDGET_WITHOUT_ITEMS` |
| Item sem `products_fiscal_id` ou `fiscal_classification_id` | `422 BUDGET_ITEMS_WITHOUT_FISCAL_CONFIGURATION` (com a lista de SKUs em `details.skus`) |

### 6.4 Etapa 4 — Reserva atômica (`claimBudgetForIssuance`)

**Toda esta etapa roda em uma única transação**, com um cliente dedicado do pool:

```
BEGIN
 ├─ SELECT ... FROM budgets WHERE budget_id = $1 FOR UPDATE      ← serializa emissões
 │     └─ sem linha → 404 BUDGET_NOT_FOUND
 │
 ├─ SELECT última tentativa (a.* + status) ... FOR UPDATE OF a
 │     └─ bloqueia se:  is_authorized          → "já possui NF-e autorizada"
 │                      OU (não final E não retryable) → "já está sendo enviada"
 │        → 409 BUDGET_NFE_ALREADY_ISSUED
 │
 ├─ Define o número da NF-e (reaproveita ou reserva) — ver §11
 │
 ├─ resolveNfeStatus('ENVIANDO')
 ├─ INSERT budgetsNfeAttempts   (attempt_number = anterior + 1)
 │     integration_id = "BUD-<budget_id>-A<attempt_number>"
 ├─ UPDATE ... SET nfe_number = <reservado>
 └─ INSERT budgetsNfeAttemptItems  (1 por item, via fiscalItemSnapshot)
COMMIT
```

Status **retryable** (permitem nova tentativa):
`ERRO`, `ERROR`, `REJEITADA`, `REJEITADO`, `REJECTED`, `DENEGADA`, `DENEGADO`,
`DENIED`.

O snapshot de item (`fiscalItemSnapshot`) grava, entre outros:
`gross_total = quantity × unit_price`, `discount_amount`,
`net_total = max(0, gross − discount)`, todos os dados fiscais, o
`tax_calculation` (com a memória do ICMS-ST) e o `budget_item_snapshot`
completo.

### 6.5 Etapa 5 — Montagem do payload

```js
tecnospeedNfeApi.buildNFeFromOrder({
  header: {
    ...budget,
    id: null, order_id: null,          // força o modo "orçamento"
    budget_id, numero: attempt.nfe_number,
    consumidor_final: true,            // indFinal = 1
    consumidorFinal: true,
    shipping: budget.shipping,
  },
  items,
})
```

Depois da montagem, o orquestrador **sobrescreve**:

```js
payload.idIntegracao = attempt.integration_id;
payload.numero       = attempt.nfe_number;   // impõe o número reservado
```

> **Sobre `consumidorFinal: true`**: é fixo neste fluxo, por decisão fiscal
> documentada no código — `indFinal` (consumidor final) e `indIEDest`
> (contribuinte) são conceitos **independentes**, e a presença de inscrição
> estadual **não** deve derivar `indFinal`. Vale só para a emissão direta de
> orçamento; **não** altera o fluxo de Pedidos.

### 6.6 Etapa 6 — Recuperação (idempotência de transmissão)

Antes de transmitir, o sistema pergunta ao provedor se aquele `idIntegracao`
já existe. Isso cobre o caso em que uma chamada anterior **chegou ao provedor
mas a persistência local falhou**.

```js
const existing = await tecnospeedNfeApi.listarNFe({ q: idIntegracao });
const existingDocument = findProviderDocumentByIntegrationId(existing, idIntegracao);
```

> 🔒 **`findProviderDocumentByIntegrationId` é obrigatório aqui.**
> `listarNFe` **não é um lookup**: quando o endpoint direto
> (`/nfe/{cnpj}/{idIntegracao}/resumo`) devolve `404` — o caso normal de uma
> tentativa nova — ele cai na consulta por período (últimos 90 dias) e filtra
> por **substring** e por **"somente dígitos"** do termo. Para
> `idIntegracao = "BUD-1-A1"` o termo em dígitos é `"11"`, então qualquer NF-e
> do período cujo número ou CNPJ do destinatário contenha `11` seria retornada.
> Pegar o primeiro documento da lista faria a emissão **adotar a NF-e de outro
> orçamento e nunca transmitir a real**. O helper exige `idIntegracao`
> idêntico (ou confirma que o provedor resolveu o ID pela própria URL, via
> `meta.directIdIntegracao`). Ele também protege contra colisão de prefixo:
> `BUD-1-A1` é substring de `BUD-1-A10`, `BUD-1-A11` e de
> `BUD-1-A1-R<timestamp>`.

Desfecho:

| Situação | Ação |
|---|---|
| Documento encontrado e **não** está `REJEITADA`/`REJEITADO`/`ERRO` | Reaproveita: `recovered = true`, **sem nova transmissão** |
| Documento encontrado mas rejeitado/com erro | Gera novo `idIntegracao` (`...-R<timestamp>`) e transmite |
| Nada encontrado | Transmite normalmente |

### 6.7 Etapa 7 — Transmissão e persistência

```
tecnospeedNfeApi.emitirNFe(payload)     ← POST /nfe, com retry em HTTP 500 (até 2x)
   │
   ├─ UPDATE budgetsNfeAttempts SET integration_id, request_payload   ← sempre
   │
   ├─ !result.ok            → 502 (ou status do provedor) NFE_PROVIDER_ERROR
   ├─ sem provider_id       → 502 NFE_PROVIDER_ID_MISSING
   ├─ status REJEITADA/ERRO → 422 NFE_REJECTED
   └─ sucesso → persistIssueResult(): status, provider_id, protocolo,
                ambiente, provider_response, authorized_at/rejected_at
```

Se o provedor não devolver status mas devolver `provider_id`, assume-se
`PROCESSANDO`.

Qualquer exceção a partir da criação da tentativa é capturada e registrada por
`persistIssueError` (status `REJEITADA` se `NFE_REJECTED`, senão `ERRO`;
mensagem truncada em 2000 caracteres) — **e depois re-lançada**. A falha ao
gravar o erro é apenas logada, para não mascarar a exceção original.

---

## 7. Fluxo C — Reconciliação de status

Função: `reconcileBudgetNfe(budgetId)` · Rota: `GET /:budgetId/status`

É o **motor de convergência** do módulo e pode ser chamado quantas vezes for
necessário (polling pela tela).

### 7.1 Localização da nota

```
getBudgetNfeReference(budgetId)   → última tentativa (attempt_number DESC)
   ├─ sem tentativa + orçamento existe → 404 BUDGET_NFE_NOT_FOUND
   ├─ sem tentativa + sem orçamento    → 404 BUDGET_NOT_FOUND
   └─ sem provider_id e sem integration_id → 404 BUDGET_NFE_NOT_FOUND

resolveProviderId(reference)
   ├─ já tem provider_id → usa
   └─ senão → listarNFe({ q: integration_id }) + findProviderDocumentByIntegrationId
         ├─ falha na consulta → 502 NFE_PROVIDER_LOOKUP_FAILED
         └─ não encontrado    → 404 NFE_PROVIDER_DOCUMENT_NOT_FOUND
```

### 7.2 Consulta e normalização

`tecnospeedNfeApi.consultarNFe(providerId)` → `GET /nfe/{id}/resumo`.
Falha → `502 NFE_PROVIDER_STATUS_FAILED`.

`normalizeProviderStatus` mapeia status **e** mensagem do provedor para o
vocabulário interno:

| Interno | Origem (status ou texto da mensagem) |
|---|---|
| `AUTORIZADA` | `AUTORIZADA`, `AUTORIZADO`, `CONCLUIDO`, `CONCLUÍDO`, ou mensagem com *"autorizado o uso"* / *"autorizada"* |
| `REJEITADA` | `REJEITADA`, `REJEITADO`, ou mensagem com *"rejeição"* |
| `CANCELADA` | `CANCELADA`, `CANCELADO` |
| `DENEGADA` | `DENEGADA`, `DENEGADO` |
| `PROCESSANDO` | `PROCESSANDO`, `PROCESSAMENTO`, `ENVIANDO`, `PENDENTE`, ou mensagem com *"processamento"* |

### 7.3 Atualização da tentativa

Sempre executada, qualquer que seja o status:

```sql
UPDATE budgetsNfeAttempts SET
  provider_id, nfe_status_id, protocol,
  access_key  = COALESCE($5, access_key),      -- nunca apaga
  nfe_number  = COALESCE($6, nfe_number),      -- nunca apaga
  provider_response, error_code, error_message,
  last_checked_at = NOW(),
  authorized_at = CASE WHEN <is_authorized>            THEN COALESCE(authorized_at, NOW()) ELSE authorized_at END,
  rejected_at   = CASE WHEN <is_final AND NOT autoriz.> THEN COALESCE(rejected_at,   NOW()) ELSE rejected_at   END
WHERE attempt_id = $1
```

### 7.4 Ramo `AUTORIZADA`

Ordem **importa** e é sequencial:

```
1. getBudgetIssuedData(budget_id)              recarrega o orçamento
2. applyStockFromBudget(budget, { attemptId }) baixa de estoque  → §12
3. invoicesIssuedApi.upsertFromBudget({...})   registro da nota  → §14
      └─ !ok → 500 INVOICES_ISSUED_SYNC_FAILED  (interrompe o fluxo)
4. UPDATE budgetsNfeAttempts SET invoice_id
5. UPDATE budgets SET status = 'FATURADO'
6. syncAuthorizedBudgetNfe({...})              financeiro/boletos → §13
      └─ erro é CAPTURADO e devolvido em boleto_sync.ok = false
         (não derruba a reconciliação)
```

> `authorized_at` é gravado no passo [§7.3](#73-atualização-da-tentativa),
> **antes** do estoque — condição exigida por `applyStockFromBudget`, que
> recusa tentativas sem `authorized_at` (`409 BUDGET_NFE_NOT_AUTHORIZED`).

O orçamento só vira `FATURADO` **depois** de estoque e `invoicesIssued`
concluírem com sucesso. Operações com `moves_stock = false` são marcadas pelo
serviço de estoque como *ignoradas*, sem gerar baixa.

### 7.5 Ramo `CANCELADA`

```
1. Extrai dataCancelamento ("DD/MM/AAAA" → "AAAA-MM-DD"; senão NOW())
   e protocoloCancelamento
2. UPDATE budgetsNfeAttempts SET cancelled_at = COALESCE(cancelled_at, $2)
3. UPDATE invoicesIssued  (status cancelado, cancelled_at, cancellation_reason)
      WHERE budget_id = $1
         OR (budget_id IS NULL AND source_type = 'BUDGET'
             AND nfe_number = $6
             AND nfe_environment IS NOT DISTINCT FROM $7)   ← fallback restrito
4. UPDATE budgets SET status = 'CANCELADO'
5. rollbackStockFromBudget({ attemptId })      estorno idempotente → §12
```

> O `OR` do passo 3 é um **fallback para notas antigas sem `budget_id`**.
> Ele exige o mesmo ambiente (`nfe_environment`) porque a sequência de
> numeração é compartilhada entre homologação e produção — casar apenas por
> `nfe_number` poderia cancelar a nota do outro ambiente. Se o ambiente não
> casar, o fallback simplesmente **não dispara** (comportamento à prova de
> falhas); a linha correta continua sendo atendida por `budget_id = $1`.

A razão do cancelamento gravada é `"<mensagem> Protocolo: <protocolo>"`.

### 7.6 Ramos `REJEITADA` / `DENEGADA` / `ERRO`

Apenas a tentativa é atualizada: `error_code = 'NFE_PROVIDER_STATUS'` e
`error_message` com a mensagem do provedor. Nenhum efeito colateral.
Como esses status são *retryable*, uma nova emissão é permitida
(ver [§11](#11-numeração-fiscal-da-nf-e) para o tratamento do número).

---

## 8. Enriquecimento fiscal dos itens (Fiscal V2)

`enrichBudgetItemForNfe(item)`:

1. Normaliza `sku` (`sku` ou `product_code`); item sem SKU é devolvido intacto.
2. Normaliza o CST via `normalizeCst` — `'060'`, `60` e `'60'` são tratados
   como `'60'`; CSOSN de 3 dígitos (`'500'`) é preservado.
3. **Se o CST ≠ 60, termina aqui.**
4. Se CST = 60, resolve a origem do ICMS-ST retido → [§9](#9-icms-st-retido-anteriormente-cst-60).

> **Não existe fallback para `productsFiscalV2Api.getCurrent` neste ponto.**
> O `SELECT` principal usa exatamente os mesmos predicados
> (`product_code` + `is_current` + `is_active`), portanto quando
> `products_fiscal_id`/`fiscal_classification_id` vêm nulos, `getCurrent`
> também retornaria nulo. A ausência de configuração fiscal é tratada em
> `assertBudgetItemsAreIssuable`.

---

## 9. ICMS-ST retido anteriormente (CST 60)

Itens com **CST 60** exigem informar na NF-e de saída o ICMS-ST **já retido em
etapa anterior**. O sistema busca esses valores nas **notas de entrada** do
produto.

### 9.1 Localização da origem

`resolveBudgetItemIcmsStOrigin(item)`:

- A busca é **por produto** (`product_code` ou `product_id`) em
  `inboundInvoiceItems`. **Lotes não são mais usados.**
- A `grade_id` do orçamento é apenas **preferência de ordenação**, não filtro —
  o ICMS-ST é definido por produto e muitas entradas não registram a grade.
- Ordenação: grade preferida primeiro → `created_at DESC` →
  `inbound_item_id DESC`. Limite de **25 candidatas**.
- Filtro: a entrada precisa ter as colunas de ST preenchidas **ou**
  `raw_tax_payload -> 'ICMS'`.
- Retorna a **primeira candidata completa**. Se houver candidatas mas nenhuma
  completa, registra `[BUDGET NFE][ICMS-ST ORIGIN] Entradas encontradas sem
  dados completos de ST.`

### 9.2 Fontes de valor, por prioridade

1. **Colunas** de `inboundInvoiceItems`: `icms_st_base`, `icms_st_rate`,
   `icms_st_value` (e `fcp_st_*`).
2. **`raw_tax_payload`** (XML convertido por `xml2js`, valores dentro de arrays):
   - entrada **CST 10/30/70** (fornecedor substituto): `vBCST`, `pICMSST`, `vICMSST`
   - entrada **CST 60/500** (ST já retido antes): `vBCSTRet`, `pST`, `vICMSSTRet`

A procedência é reportada **campo a campo** em `source_value_origins`, e
`source_values_from` assume `columns`, `raw_tax_payload` ou `mixed`.

### 9.3 Regras de cálculo

| Grandeza | Regra |
|---|---|
| Quantidade da entrada | `quantity × conversion_factor` (unidade base) |
| Quantidade vendida | `quantity × conversion_factor` do item do orçamento |
| `proportion` | `quantidade_vendida / quantidade_da_entrada` |
| `pST` | Entrada CST 60/500: `pST` do fornecedor (já consolidado). Entrada CST 10/30/70: `pICMSST + pFCPST` |
| `vICMSSubstituto` | Entrada retida: `vICMSSubstituto` do XML. Entrada CST 10: `vICMS` (ICMS próprio do substituto) |
| `vBCSTRet`, `vICMSSTRet`, `vICMSSubstituto` | valor da entrada × `proportion`, arredondado em 2 casas |
| Grupo FCP-ST | Só é emitido se `fcp_st_value > 0` |

Campos gerados no item (nomes do layout NF-e **e** aliases `snake_case` para o
builder e para o snapshot):

```
vBCSTRet / icms_st_base_retained        pST      / icms_st_rate_retained
vICMSSubstituto / icms_substitute_value vICMSSTRet / icms_st_value_retained
vBCFCPSTRet / fcp_st_base_retained      pFCPSTRet  / fcp_st_rate_retained
vFCPSTRet   / fcp_st_value_retained
```

A memória de cálculo completa fica em `item.tax_calculation.icms_st_origin` e
`item.tax_calculation.icms_st_retained`, e é persistida no snapshot da
tentativa.

### 9.4 Quantidade vendida maior que a entrada

Quando `proportion > 1`, o ICMS-ST retido **por unidade** é multiplicado pela
quantidade vendida (prática usual para CST 60). O caso é **sinalizado, não
bloqueado**:

```
[BUDGET NFE][ICMS-ST EXTRAPOLADO] { sku, inbound_item_id, entry_base_quantity,
                                    sale_base_quantity, proportion, detail }
```

O flag também fica gravado em `icms_st_retained.extrapolated = true`, permitindo
auditoria posterior.

### 9.5 Falha na resolução

Se não houver origem, ou se a quantidade do item for inválida para o rateio:

```
422 BUDGET_ITEM_ICMS_ST_ORIGIN_NOT_FOUND
"[NFE] SKU <sku>: CST 60 exige a origem do ICMS-ST, mas <motivo>."
details: { sku, product_id, grade_id, reason }
```

Precedido do log `[BUDGET NFE][ICMS-ST ORIGIN NOT RESOLVED]` com o diagnóstico.

---

## 10. Operação fiscal e CFOP

`getSelectedFiscalOperation(operationTypeId, customerState)`:

1. `operation_type_id` ausente/inválido → `422 BUDGET_OPERATION_TYPE_REQUIRED`
   ("Selecione a operação fiscal do orçamento antes de emitir a NF-e.").
2. Busca em `nfeOperationTypes` com `active = TRUE` →
   `422 BUDGET_OPERATION_TYPE_INVALID`.
3. UF do emitente: `NFE_EMPRESA_UF` ou `EMPRESA_UF`. Ausente →
   `500 NFE_ISSUER_STATE_NOT_CONFIGURED`.
4. `isInternal = UF_emitente === UF_destino` → escolhe `cfop_internal` ou
   `cfop_interstate`.
5. **CFOP obrigatório** para operações cujo `code` seja ou comece por
   `BONUS`, `DEVOLUCAO`, `TRANSFERENCIA`, `REMESSA` (`force_cfop = true`).
   Sem CFOP de 4 dígitos → `422 BUDGET_OPERATION_CFOP_MISSING`.
   Para as demais operações, CFOP nulo é aceito (o CFOP do item, `cfop_exit`,
   é usado).

Retorna também `generates_receivable` e `moves_stock`, que governam
[§13](#13-financeiro--contas-a-receber-e-asaas) e [§12](#12-baixa-e-estorno-de-estoque).

---

## 11. Numeração fiscal da NF-e

A tabela `public.nfe` guarda o **último número reservado** na linha com
`is_active = TRUE`.

### 11.1 Reserva atômica

Acontece **dentro da transação** que cria a tentativa, impedindo que duas
emissões simultâneas recebam o mesmo número:

```sql
WITH active_sequence AS (
  SELECT id FROM public.nfe WHERE is_active = TRUE ORDER BY id LIMIT 1 FOR UPDATE
)
UPDATE public.nfe seq
   SET sequence_number = seq.sequence_number + 1, updated_at = NOW()
  FROM active_sequence selected
 WHERE seq.id = selected.id
RETURNING seq.sequence_number AS reserved_nfe_number
```

Sem sequência ativa → `422 NFE_ACTIVE_SEQUENCE_NOT_FOUND`.

### 11.2 Reaproveitamento em nova tentativa

Uma NF-e **rejeitada** ou que **falhou no envio** nunca foi autorizada pela
SEFAZ, então seu número **pode ser reaproveitado**, evitando lacunas:

| Status da tentativa anterior | Número |
|---|---|
| `ERRO`, `ERROR`, `REJEITADA`, `REJEITADO`, `REJECTED` | **Reaproveitado** → log `[BUDGET NFE][NUMERO REAPROVEITADO]` |
| `DENEGADA`, `DENEGADO`, `DENIED`, `CANCELADA` | **Novo número** (o anterior foi registrado na SEFAZ) → log `[BUDGET NFE][NUMERO QUEIMADO]` |

O log `[BUDGET NFE][NUMERO QUEIMADO]` informa `burned_nfe_number` e
`new_nfe_number` — é a base para a **inutilização de numeração** junto à SEFAZ.

> `budgetsNfeAttempts.nfe_number` **não** possui restrição de unicidade, o que
> permite que duas tentativas do mesmo orçamento compartilhem o número
> reaproveitado.

### 11.3 Imposição do número

Mesmo que o builder genérico devolva outro valor, o orquestrador força
`payload.numero = attempt.nfe_number` antes de transmitir.

---

## 12. Baixa e estorno de estoque

### 12.1 Baixa — `applyStockFromBudget(budget, { attemptId })`

Transação única, com `SELECT ... FOR UPDATE` na tentativa:

| Verificação | Resultado |
|---|---|
| `attemptId` inválido | `400 INVALID_NFE_ATTEMPT_ID` |
| Tentativa inexistente | `404 BUDGET_NFE_ATTEMPT_NOT_FOUND` |
| `authorized_at` nulo | `409 BUDGET_NFE_NOT_AUTHORIZED` |
| `stock_applied_at` já preenchido | **Retorna `alreadyApplied: true`** (idempotente, sem novo movimento) |
| Operação com `moves_stock = false` | Marca `stock_applied_at = NOW()` e retorna **sem movimentar** |

Os itens processados vêm de `budgetsNfeAttemptItems` **com
`stock_applied_at IS NULL`** (`FOR UPDATE`), ordenados por `item_number` — ou
seja, a idempotência é **por item**, não só por tentativa.

O modo de estoque (simples / com lote / lote obrigatório) é resolvido
globalmente e logado como `[NFE][STOCK_MODE]`.

### 12.2 Estorno — `rollbackStockFromBudget({ attemptId })`

Chamado no ramo `CANCELADA`. Usa `stock_applied_at` / `stock_reversed_at` como
marcas de idempotência e restaura as quantidades consumidas (o trigger de
`productsStockLots` recalcula `productsStock.stock_qty` automaticamente).

---

## 13. Financeiro — contas a receber e Asaas

`syncAuthorizedBudgetNfe({ budgetId, nfeNumber, nfeKey })` —
`backend/services/apis/nfeAsaasSyncApi.js`

```
pg_advisory_lock(73115, budgetId)            ← serializa por orçamento
   │
   ├─ loadBudgetContext(): orçamento + parcelas + asaas_id do cliente
   │     └─ generates_receivable = false → retorna sem fazer nada
   │     └─ nenhuma parcela → skipped = 1
   │
   └─ para cada parcela:
        externalReference = makeBudgetExternalReference({
            nfeKey, nfeNumber, budgetId, paymentId, installment })
        │
        ├─ 1) cria/reutiliza a CONTA A RECEBER local  (transação própria)
        └─ 2) se for BOLETO AUTOMÁTICO ASAAS:
               cria/reutiliza a cobrança no Asaas
               e registra a ponte em accountsReceivableAsaas
```

Regras:

- Cobrança Asaas é criada **somente** quando a parcela é boleto **automático**
  com provedor `ASAAS` (`isAutomaticAsaasBoleto`).
- Se alguma parcela exigir Asaas automático e o cliente **não** tiver
  `asaas_id`, a função lança erro ("Cliente X ainda não possui asaas_id...").
- A **idempotência** vem do `externalReference` (chave + número + orçamento +
  pagamento + parcela) somado ao *advisory lock* — reconciliações repetidas
  **não** duplicam boletos.
- Retorno: `{ ok, partial, found, receivablesCreated, receivablesReused,
  created, reused, linked, failed[], skipped, payments[] }`.
- Qualquer exceção é **capturada** em `reconcileBudgetNfe` e devolvida como
  `boleto_sync: { ok: false, error }` — o financeiro **não** derruba a
  autorização da nota.

---

## 14. Registro final em `invoicesIssued`

`invoicesIssuedApi.upsertFromBudget(data, { userId })`

### 14.1 Pré-condições (retornam `{ ok: false, error }`)

| Condição | Mensagem |
|---|---|
| `budget_id` inválido | `budget_id inválido` |
| Status normalizado ≠ `AUTORIZADO` | `A NF-e do orçamento ainda não está autorizada` |
| Status não cadastrado | `Status X não cadastrado em nfeStatusMap` |
| **`nfe_key` ausente ou fora do padrão `\d{44}`** | `Chave de acesso da NF-e ausente ou inválida` |

> ⚠️ A **chave de acesso de 44 dígitos é obrigatória**. Se o provedor devolver
> `AUTORIZADA` sem a chave, a reconciliação falha com
> `500 INVOICES_ISSUED_SYNC_FAILED` — e o orçamento **não** chega a `FATURADO`.
> Nesse caso, basta chamar `GET /status` novamente quando a chave estiver
> disponível.

Normalização de status: `AUTORIZADA`, `AUTORIZADO`, `AUTHORIZED`, `CONCLUIDO`,
`CONCLUIDA` → **`AUTORIZADO`** (acentos removidos).

### 14.2 Upsert

```sql
INSERT INTO public."invoicesIssued" (
  order_id, budget_id, source_type, nfe_number, nfe_key, nfe_provider_id,
  nfe_status_id, nfe_status, nfe_protocol, nfe_environment,
  xml_url, danfe_url, issued_at, issued_date, total_amount,
  customer_name, customer_tax_id, customer_email
) VALUES (NULL, $1, 'BUDGET', ...)
ON CONFLICT (budget_id) WHERE budget_id IS NOT NULL
DO UPDATE SET ...
  nfe_provider_id = COALESCE(EXCLUDED.nfe_provider_id, "invoicesIssued".nfe_provider_id),
  issued_at       = COALESCE("invoicesIssued".issued_at,   EXCLUDED.issued_at),
  issued_date     = COALESCE("invoicesIssued".issued_date, EXCLUDED.issued_date),
  updated_at      = NOW()
RETURNING *
```

- **Um registro por orçamento** (`ON CONFLICT (budget_id)`) → o upsert é
  naturalmente idempotente.
- `issued_at`/`issued_date` **preservam** o valor original em reprocessamentos.
- `xml_url` e `danfe_url` apontam para as rotas internas
  `/api/budgets-issued/<id>/xml` e `/danfe.pdf`.
- Gera **log de auditoria** `UPSERT_FROM_BUDGET` em `createAuditLog`.

### 14.3 Dados enviados pela reconciliação

| Campo | Origem |
|---|---|
| `nfe_number` | `document.numero` → senão `reference.nfe_number` |
| `nfe_key` | `accessKey` do provedor → senão `reference.access_key` |
| `nfe_provider_id` | ID interno do documento no provedor |
| `nfe_protocol` | protocolo do provedor → senão o já gravado |
| `nfe_environment` | `document.ambiente` → `reference.nfe_environment` → `NFE_AMBIENTE` |
| `issued_date` | `dataAutorizacao`/`emissao` (`DD/MM/AAAA` → `AAAA-MM-DD`) |
| `total_amount` | `budget.total_amount` → `budget.total` → `document.valor` → `0` |
| `customer_name` | `customer_legal_name` → `customer_name` |

---

## 15. Máquina de estados (`nfeStatusMap`)

O status **nunca** é gravado como texto livre: `resolveNfeStatus(client, raw)`
resolve o código em `nfeStatusMap` usando uma tabela de sinônimos
(PT/EN), exigindo `is_active = TRUE`. Não encontrado →
`500 NFE_STATUS_MAP_MISSING`.

| Interno | Sinônimos aceitos |
|---|---|
| `ENVIANDO` | ENVIANDO, SENDING, PROCESSANDO, PROCESSING, PENDENTE, PENDING |
| `PROCESSANDO` | PROCESSANDO, PROCESSING, ENVIANDO, SENDING, PENDENTE, PENDING |
| `AUTORIZADA` | AUTORIZADA, AUTORIZADO, AUTHORIZED |
| `REJEITADA` | REJEITADA, REJEITADO, REJECTED |
| `DENEGADA` | DENEGADA, DENEGADO, DENIED |
| `CANCELADA` | CANCELADA, CANCELADO, CANCELLED, CANCELED |
| `ERRO` | ERRO, ERROR |

As flags **`is_final`** e **`is_authorized`** da tabela — não o texto do código —
são o que governa:

- se uma nova tentativa é permitida (`claimBudgetForIssuance`);
- o preenchimento de `authorized_at` / `rejected_at`.

```
                       ┌──────────────┐
      POST /issue  ───►│   ENVIANDO   │
                       └──────┬───────┘
                              │ transmissão aceita
                              ▼
                       ┌──────────────┐
         GET /status ─►│ PROCESSANDO  │◄── polling
                       └──┬────┬──────┘
             ┌────────────┘    └──────────────┐
             ▼                                ▼
      ┌─────────────┐                 ┌─────────────────┐
      │ AUTORIZADA  │                 │   REJEITADA /   │
      │  (final)    │                 │   DENEGADA /    │
      └──────┬──────┘                 │      ERRO       │
             │                        └────────┬────────┘
             │ cancelamento                    │ nova tentativa
             ▼                                 ▼
      ┌─────────────┐                  attempt_number + 1
      │  CANCELADA  │
      └─────────────┘
```

---

## 16. Idempotência e concorrência

| Risco | Proteção |
|---|---|
| Duas emissões simultâneas do mesmo orçamento | `SELECT ... FROM budgets FOR UPDATE` no início da transação |
| Número de NF-e duplicado | Reserva com `FOR UPDATE` em `public.nfe`, dentro da mesma transação da tentativa |
| Emissão sobre nota já autorizada | Bloqueio por `is_authorized` → `409 BUDGET_NFE_ALREADY_ISSUED` |
| Emissão durante processamento | Bloqueio por `!is_final && !retryable` → `409` |
| Transmissão duplicada ao provedor | `idIntegracao` determinístico + recuperação com **match exato** ([§6.6](#66-recuperação-idempotência-de-transmissão)) |
| Documento do provedor duplicado localmente | Índices únicos parciais em `provider_id` e `access_key` |
| Baixa de estoque repetida | `stock_applied_at` na tentativa **e** por item |
| Estorno repetido | `stock_reversed_at` |
| Nota duplicada em `invoicesIssued` | `ON CONFLICT (budget_id)` |
| Boletos duplicados | `pg_advisory_lock(73115, budgetId)` + `externalReference` |
| Item duplicado na NF-e | Join `LATERAL ... LIMIT 1` em `products_fiscal_v2` |
| Esgotamento do pool de conexões | `mapWithConcurrency(..., 4)` no enriquecimento dos itens |

**`GET /status` é seguro para polling**: todos os efeitos colaterais são
idempotentes.

---

## 17. Catálogo de erros

Formato da resposta de erro (`sendError`):

```json
{ "ok": false, "error": "<code>", "message": "<mensagem>", "data": { } }
```

### 17.1 Validação do orçamento

| Código | HTTP | Causa | Ação |
|---|---|---|---|
| — | 400 | `ID de orçamento inválido.` | Verificar o parâmetro da rota |
| `INVALID_BUDGET_ID` | 400 | ID inválido na reconciliação | idem |
| — | 404 | `Orçamento não encontrado.` | — |
| `ISSUE_CONFIRMATION_REQUIRED` | 400 | Body sem `confirm: true` | Enviar `{"confirm": true}` |
| `BUDGET_WITHOUT_ITEMS` | 422 | Orçamento sem itens | Incluir itens |
| `BUDGET_ITEMS_WITHOUT_FISCAL_CONFIGURATION` | 422 | SKU sem vínculo Fiscal V2 ativo | Configurar em `products_fiscal_v2` (SKUs em `data.skus`) |

### 17.2 Operação fiscal

| Código | HTTP | Causa | Ação |
|---|---|---|---|
| `BUDGET_OPERATION_TYPE_REQUIRED` | 422 | Orçamento sem operação fiscal | Selecionar a operação |
| `BUDGET_OPERATION_TYPE_INVALID` | 422 | Operação inexistente ou inativa | Reativar/corrigir em `nfeOperationTypes` |
| `NFE_ISSUER_STATE_NOT_CONFIGURED` | 500 | `NFE_EMPRESA_UF`/`EMPRESA_UF` ausente | Configurar no `.env` |
| `BUDGET_OPERATION_CFOP_MISSING` | 422 | Operação BONUS/DEVOLUCAO/TRANSFERENCIA/REMESSA sem CFOP | Preencher `cfop_internal`/`cfop_interstate` |

### 17.3 Fiscal do item

| Código | HTTP | Causa | Ação |
|---|---|---|---|
| `BUDGET_ITEM_ICMS_ST_ORIGIN_NOT_FOUND` | 422 | CST 60 sem origem de ICMS-ST nas entradas | Conferir `inboundInvoiceItems` do produto ([§9](#9-icms-st-retido-anteriormente-cst-60)) |

### 17.4 Emissão e provedor

| Código | HTTP | Causa | Ação |
|---|---|---|---|
| `BUDGET_NOT_FOUND` | 404 | Orçamento sumiu durante a transação | — |
| `BUDGET_NFE_ALREADY_ISSUED` | 409 | NF-e autorizada ou em processamento | Consultar `GET /status` |
| `NFE_ACTIVE_SEQUENCE_NOT_FOUND` | 422 | Nenhuma linha ativa em `public.nfe` | Cadastrar/ativar a sequência |
| `NFE_STATUS_MAP_MISSING` | 500 | Status ausente em `nfeStatusMap` | Popular a tabela |
| `NFE_PROVIDER_ERROR` | 502* | Provedor recusou a emissão | Ver `data` (erro do provedor) |
| `NFE_PROVIDER_ID_MISSING` | 502 | Provedor não devolveu ID | Reenviar; verificar credenciais |
| `NFE_REJECTED` | 422 | Rejeição da SEFAZ | Corrigir e reemitir (número é reaproveitado) |
| `BUDGET_NFE_ISSUE_FAILED` | 500 | Fallback do controller | Ver log do servidor |

\* ou o HTTP devolvido pelo provedor.

### 17.5 Reconciliação e documentos

| Código | HTTP | Causa |
|---|---|---|
| `BUDGET_NFE_NOT_FOUND` | 404 | Sem tentativa ou sem NF-e vinculada |
| `NFE_PROVIDER_LOOKUP_FAILED` | 502 | Falha ao listar no provedor |
| `NFE_PROVIDER_DOCUMENT_NOT_FOUND` | 404 | Documento não localizado no provedor |
| `NFE_PROVIDER_STATUS_FAILED` | 502 | Falha ao consultar o resumo |
| `INVOICES_ISSUED_SYNC_FAILED` | 500 | `upsertFromBudget` recusou (normalmente **chave de 44 dígitos ausente**) |
| `BUDGET_NFE_XML_FAILED` | 502 | XML indisponível |
| `BUDGET_NFE_DANFE_FAILED` | 502 | PDF indisponível |
| `BUDGET_NFE_PREVIEW_FAILED` | 500 | Fallback do preview |
| `BUDGET_NFE_RECONCILE_FAILED` | 500 | Fallback da reconciliação |

### 17.6 Estoque

| Código | HTTP | Causa |
|---|---|---|
| `INVALID_NFE_ATTEMPT_ID` | 400 | `attemptId` inválido |
| `BUDGET_NFE_ATTEMPT_NOT_FOUND` | 404 | Tentativa inexistente |
| `BUDGET_NFE_NOT_AUTHORIZED` | 409 | `authorized_at` nulo |

---

## 18. Variáveis de ambiente

| Variável | Uso | Obrigatória |
|---|---|---|
| `NFE_EMPRESA_UF` / `EMPRESA_UF` | UF do emitente — decide CFOP interno × interestadual | **Sim** |
| `EMPRESA_CNPJ` | CNPJ usado nas consultas ao provedor | **Sim** |
| `NFE_AMBIENTE` | `producao` / `homologacao` — gravado na tentativa e na nota | **Sim** |
| `PLUGNOTAS_MOCK` | `1` → modo simulado, sem transmitir | Não |
| `ASAAS_API_KEY` | Cobranças Asaas | Se usar boleto automático |
| `DB_MODE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | Conexão PostgreSQL | **Sim** |
| `INSTANCE_CONNECTION_NAME`, `FORCE_CLOUD_SQL_SOCKET` | Cloud SQL via socket | Só em Cloud Run |
| `PGPOOL_MAX` | Máximo de conexões (padrão **10**) | Não |
| `PG_CONNECT_TIMEOUT_MS` | Timeout de aquisição (padrão **8000**) | Não |
| `PG_IDLE_TIMEOUT_MS` | Timeout de conexão ociosa (padrão 30000) | Não |

> `backend/config/db.js` **não** carrega `dotenv` por conta própria — o `.env`
> é injetado pelo processo do servidor. Ao rodar scripts isolados, use
> `node --env-file=.env ...`.

---

## 19. Logs e observabilidade

### 19.1 Emissão

| Log | Conteúdo |
|---|---|
| `[BUDGET NFE][CONSULTA PROVIDER]` | Resposta da busca de recuperação |
| `[BUDGET NFE][ANTES DO ENVIO]` | `budgetId`, `idIntegracao`, ambiente, `consumidorFinal` |
| `[BUDGET NFE][RESPOSTA COMPLETA]` | Resposta integral do provedor (JSON indentado) |
| `[BUDGET NFE][NUMERO REAPROVEITADO]` | Número reutilizado após rejeição/erro |
| `[BUDGET NFE][NUMERO QUEIMADO]` | ⚠️ Número perdido — base para inutilização |

### 19.2 ICMS-ST

| Log | Significado |
|---|---|
| `[BUDGET NFE][ICMS-ST ORIGIN RESOLVED]` | Origem localizada e valores calculados |
| `[BUDGET NFE][ICMS-ST EXTRAPOLADO]` | ⚠️ Venda maior que a entrada de origem |
| `[BUDGET NFE][ICMS-ST ORIGIN NOT RESOLVED]` | Diagnóstico antes do erro 422 |
| `[BUDGET NFE][ICMS-ST ORIGIN]` | Entradas achadas, porém incompletas |

### 19.3 Reconciliação e efeitos

| Log | Significado |
|---|---|
| `[BUDGET NFE][RECONCILIACAO]` | Resposta da consulta de status |
| `[NFE][STOCK_MODE]` | Modo de estoque vigente |
| `[BUDGET NFE][FINANCE]` | Sem parcelas a sincronizar |
| `[BUDGET NFE][ASAAS][SYNC]` | Resultado do financeiro |
| `[BUDGET NFE][ASAAS][SYNC ERROR]` | ⚠️ Falha no financeiro (não derruba a nota) |
| `[BUDGET NFE][PREVIEW NUMBER]` | Número indicativo do preview |

### 19.4 Avisos não fatais

`[nfeIssuanceApi][budgetCustomer]`, `[nfeIssuanceApi][budgetCustomerIbge]`,
`[nfeIssuanceApi][persistBudgetIssueError]`,
`[nfeIssuanceApi][claimBudgetForIssuance][rollback]`.

---

## 20. Caminho paralelo — NF-e de Pedidos (`orders`)

`nfeIssuanceApi.js` reexporta, por compatibilidade, o fluxo de **pedidos**:

```js
export function issueOrderNfe(options)     → ordersNfeAttemptsApi.issueOrderNfe
export function reconcileOrderNfe(options) → ordersNfeAttemptsApi.reconcileOrderNfe
```

Diferenças principais:

| Aspecto | Orçamento | Pedido |
|---|---|---|
| Tabelas de tentativa | `budgetsNfeAttempts` / `budgetsNfeAttemptItems` | `ordersNfeAttempts` / `ordersNfeAttemptItems` |
| `invoicesIssued` | `source_type = 'BUDGET'`, `budget_id` | `order_id` |
| `idIntegracao` | `BUD-<id>-A<n>` | padrão próprio |
| `consumidorFinal` | **fixo `true`** | derivado do pedido |
| Estoque | `stockFromBudgetsService` | `stockFromOrdersService` |

Outros fluxos de emissão existentes no mesmo cliente de provedor:
`emitirNFeSupplierReturn` (devolução a fornecedor) e `emitirNFeUsoConsumo`
(uso e consumo).

---

## 21. Pontos de atenção e limitações conhecidas

1. **`/api/budgets-nfe-attempts` não exige autenticação.** As rotas CRUD de
   manutenção (incluindo `DELETE` e `PATCH /status`) não aplicam `requireAuth`,
   ao contrário de `/api/budgets-issued`. Recomenda-se proteger.

2. **Chave de acesso obrigatória para fechar o ciclo.** Um `AUTORIZADA` sem
   `nfe_key` de 44 dígitos interrompe a reconciliação com
   `INVOICES_ISSUED_SYNC_FAILED`, e o orçamento fica **sem** `FATURADO`. Basta
   repetir `GET /status` depois.

3. **`lot_number` no snapshot é sempre nulo.** `fiscalItemSnapshot` lê
   `lot_number`/`lot_code`, mas `getBudgetFiscalItems` não traz essas colunas.
   Popular exigiria join com `public."productsStockLots"`, cujo nome de coluna
   varia entre instalações (`lot_code` × `codigo_lote`) — por isso o join foi
   deliberadamente **não** adicionado.

4. **ICMS-ST usa uma única nota de entrada.** O cálculo não agrega múltiplas
   entradas; quando a venda excede a entrada mais recente, o valor por unidade
   é extrapolado (sinalizado por `[BUDGET NFE][ICMS-ST EXTRAPOLADO]`).

5. **`listarNFe` cobre apenas os últimos 90 dias.** A recuperação de documentos
   mais antigos depende do endpoint direto por `idIntegracao`.

6. **`logProviderResult` grava a resposta integral do provedor** no log — útil
   para auditoria fiscal, mas verboso.

7. **O fallback de cancelamento por `nfe_number` é intencionalmente restrito**
   (exige `budget_id IS NULL` e mesmo ambiente). Se o texto do ambiente
   divergir do gravado, ele não dispara — por segurança.

8. **Números perdidos exigem ação manual.** `DENEGADA` e `CANCELADA` queimam o
   número; a inutilização junto à SEFAZ não é automatizada. Monitorar
   `[BUDGET NFE][NUMERO QUEIMADO]`.

---

## 22. Guia de troubleshooting

| Sintoma | Verificar |
|---|---|
| `409 BUDGET_NFE_ALREADY_ISSUED` | Última tentativa em `budgetsNfeAttempts`; se travada em `PROCESSANDO`, chamar `GET /status` para convergir |
| Orçamento autorizado mas **não** `FATURADO` | Log de `INVOICES_ISSUED_SYNC_FAILED` — normalmente `nfe_key` ausente. Repetir `GET /status` |
| Nota autorizada mas **estoque não baixou** | `moves_stock` da operação; `stock_applied_at` na tentativa; itens com `stock_applied_at` já preenchido |
| **Boletos não gerados** | `generates_receivable` da operação; existência de parcelas; `asaas_id` do cliente; `boleto_mode = AUTOMATIC` e provedor `ASAAS`; conteúdo de `boleto_sync.failed[]` |
| `422 BUDGET_ITEM_ICMS_ST_ORIGIN_NOT_FOUND` | Entradas do produto em `inboundInvoiceItems` com colunas de ST **ou** `raw_tax_payload->'ICMS'`; conferir `[ICMS-ST ORIGIN NOT RESOLVED]` |
| Itens **duplicados** na nota | Vínculos duplicados com `is_current = TRUE` em `products_fiscal_v2` (o join LATERAL mitiga, mas o dado deve ser corrigido) |
| `recovered: true` inesperado | `integration_id` da tentativa e `[BUDGET NFE][CONSULTA PROVIDER]`; confirmar que o `idIntegracao` casa exatamente |
| **Lacuna** na numeração | `[BUDGET NFE][NUMERO QUEIMADO]`; providenciar inutilização |
| `connection timeout` em scripts | Instância Cloud SQL desligada; ver `desligarELigarBancoDeDados.html`. Usar `node --env-file=.env` |
| Emissão não transmite nada | `PLUGNOTAS_MOCK=1` no ambiente? |

---

## Apêndice — Referência rápida das funções de `nfeIssuanceApi.js`

### Exportadas

| Função | Uso |
|---|---|
| `getBudgetIssuedData(budgetId)` | Orçamento + cliente + operação fiscal (sem itens fiscais) |
| `getBudgetNfePreparedData(budgetId)` | Idem + itens enriquecidos e validados (**preview**) |
| `issueBudgetNfe(budgetId, { userId })` | Emite a NF-e |
| `reconcileBudgetNfe(budgetId)` | Consulta o provedor e aplica os efeitos |
| `getBudgetNfeXml(budgetId)` | `{ xml, providerId }` |
| `getBudgetNfeDanfe(budgetId)` | `{ buffer, providerId }` |
| `issueOrderNfe` / `reconcileOrderNfe` | Delegação ao fluxo de pedidos |

### Internas relevantes

| Função | Uso |
|---|---|
| `getSelectedFiscalOperation` | Resolve operação e CFOP |
| `getCustomerFiscalData` | Cliente + IBGE |
| `getBudgetFiscalItems` | `SELECT` fiscal + enriquecimento |
| `rowToFiscalBudgetItem` | Normalização de campos/aliases |
| `enrichBudgetItemForNfe` | CST + ICMS-ST |
| `assertBudgetItemsAreIssuable` | Validações compartilhadas |
| `resolveBudgetItemIcmsStOrigin` | Localiza a entrada de origem do ST |
| `normalizeInboundIcmsSt` | Extrai/normaliza valores de ST da entrada |
| `calculateRetainedIcmsSt` | Rateia o ST para a quantidade vendida |
| `applyRetainedIcmsSt` | Grava os campos do grupo ICMS60 no item |
| `claimBudgetForIssuance` | Transação de reserva (trava + número + tentativa) |
| `fiscalItemSnapshot` | Snapshot do item da tentativa |
| `resolveNfeStatus` | Resolve status em `nfeStatusMap` |
| `findProviderDocumentByIntegrationId` | **Match exato** de documento do provedor |
| `normalizeProviderStatus` | Status do provedor → vocabulário interno |
| `persistIssueResult` / `persistIssueError` | Persistência do desfecho |
| `normalizeCst` | `'060'`/`60` → `'60'`; preserva CSOSN |
| `mapWithConcurrency` | Mapeamento assíncrono com limite |

---

*Documento gerado a partir da leitura do código em 16/09/2026. Ao alterar
`nfeIssuanceApi.js`, `stockFromBudgetsService.js`, `nfeAsaasSyncApi.js` ou
`invoicesIssuedApi.js`, revise as seções correspondentes.*
