# Refactor: services/apis/<X>Api.js → repositories/<X>/

Padrão para migrar cada arquivo `backend/services/apis/<X>Api.js` para `backend/repositories/<X>/`.
Referências prontas: `repositories/customersCredit/` (pequeno) e `repositories/customers/` (maior).

## Nome da pasta
`<X>` = nome do arquivo sem o sufixo `Api`/`Apis` e sem `.js`
(ex.: `crmDealsApi.js` → `crmDeals`, `productsBoxesApis.js` → `productsBoxes`, `pdv_loginsApi.js` → `pdv_logins`).

## Arquivos (crie só os que o código realmente precisa)
| Arquivo | Conteúdo |
|---|---|
| `<X>.constants.js` | nomes de tabelas, aliases, listas de colunas permitidas, enums |
| `<X>.schema.js` | DDL / funções de criação de tabela |
| `<X>.sql.js` | fragmentos SQL reutilizados (colunas, joins) |
| `<X>.sanitizers.js` | validação / normalização de entrada |
| `<X>.mappers.js` | linha do banco → objeto |
| `<X>.utils.js` | outros helpers puros |
| `<X><Action>.repository.js` | um por grupo de operação: `Create`, `Update`, `GetById`, `Remove`, `Query` (list/search), `Schema` (ensureTable)… Agrupe funções relacionadas; não crie arquivos de 1 linha. |
| `<X>.index.js` | **ponto de entrada único** (NÃO `index.js`). Exporta EXATAMENTE os mesmos named exports e o mesmo default (mesmas chaves se for objeto) do arquivo original. |

Arquivos de integração externa (HTTP para Asaas, TecnoSpeed, Google Ads, SEFAZ…) seguem o mesmo padrão;
use nomes de ação que façam sentido (`<X>Client.repository.js`, `<X>Webhook.repository.js`, etc.).

Cada arquivo começa com o cabeçalho em caixa (╔═╗) como nas referências, curto, em português.

## Regras
- **Só mover/dividir.** Não mude lógica, SQL, mensagens de erro, defaults, logs ou comportamento. Mantenha comentários úteis.
- Efeitos colaterais de módulo (timers, `ensureTable()` no top-level, etc.) devem continuar acontecendo do mesmo jeito ao importar `<X>.index.js`.
- Imports relativos devem ser corrigidos para a nova profundidade (`../../config/db.js`, `../../services/apis/outroApi.js`, `../../utils/...`).
- Se o arquivo importa outro `services/apis/*Api.js`, mantenha o import apontando para o caminho atual (ele será reescrito depois).
- Helpers não exportados continuam não exportados pelo index (podem ser exportados entre arquivos internos).
- Use as ferramentas Write/Edit para criar arquivos (heredoc no bash quebra neste ambiente).
- `'use strict'` pode ser removido (não tem efeito em ESM).

## Verificação (obrigatória, por módulo)
Rode com cwd = `backend/`:
1. `node scripts/verifyRepoExports.mjs <X>Api <X> HEAD` → deve imprimir `OK`. (Para `productsBoxesApis` use `productsBoxesApis productsBoxes HEAD`.)
   Sempre compare com `HEAD` (o baseline antigo tem imports para arquivos que já foram movidos).
1b. `node scripts/checkLineCoverage.mjs <X>Api <X>` → `COVERED`. Se listar `MISSING`, confira cada linha:
   só é aceitável se for comentário de bloco, método de objeto convertido em função, ou nome de tabela trocado por constante.
2. `node -e "import('./repositories/<X>/<X>.index.js').then(()=>{console.log('LOAD OK');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"` → `LOAD OK` (linhas de log do DB são normais).

## NÃO fazer (o orquestrador faz, em série)
- NÃO rode `rewireApiImports.mjs`, NÃO apague o arquivo original, NÃO edite controllers/routes/outros services, NÃO faça commit.
- Não toque em nada fora de `repositories/<X>/` dos seus módulos.
