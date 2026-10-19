# 00000-PRODNEX — ERP Industrial

Base copiada do ERP Infinity (00000-ERP-INFINITY-34-363-337-0001-85) em 18/10/2026,
mesma estrutura: `backend/` (Express ESM, routes → controllers → repositories/services,
telas em `backend/public/<modulo>/`), `desktop/` (Electron) e `docs/`.

## O que NÃO veio do Infinity
- Credenciais (`backend/config/credenciais-gcs.json`, `backend/keys/`), `.env`
- Dados de clientes: XMLs de NF-e, anexos de e-mail, PDFs gerados, uploads
- Deploy específico do Infinity (`deploy-lite.ps1`, `svc.yaml`, projeto/conta GCP do Infinity), logs e scripts avulsos
- Histórico git (o projeto começa sem `.git`)

## O que foi trocado para PRODNEX
- Títulos das telas "CONSART ERP" → "PRODNEX ERP"; tela de login nova com o logo
- Ícone/brasão e logo (`brasaoConsartInfinity.png`, `consartInfinity.png`) substituídos pelo Prodnex
- Banco padrão `prodnex` (`backend/config/db.js`), nome dos pacotes e do app desktop
- URLs de produção do Infinity trocadas por `https://erp.prodnex.com.br` (ajustar quando houver domínio)

## Ainda é do Infinity (revisar aos poucos)
- CNPJ 34.363.337/0001-85 fixo em alguns PDFs/relatórios (ordersKanban, cashReports, logística, assinatura de e-mail)
- Lógica de empresas BH3 x CONSART (`utils/erpCompanyContext.js`)

## Banco de dados
O Infinity não tem um script único de criação. Para criar o banco `prodnex` com a mesma estrutura:
```
createdb -U postgres prodnex
pg_dump -U postgres --schema-only erp-infinity-00000 | psql -U postgres -d prodnex
```
Depois crie o `.env` em `backend/` (mesmas variáveis do Infinity, com DB_NAME=prodnex e um JWT_SECRET novo)
e rode `npm install` e `npm run start:local`.

## Módulo de produção (PCP): pronto, ver seção abaixo
Ficha técnica (estrutura de produto), roteiros/centros de trabalho, ordens de produção,
apontamento e MRP — ver `docs/plano-erp-industrial.md`.

## Módulo PCP / Produção (novo no Prodnex)

Telas (o menu "PCP / Produção" é criado sozinho na primeira chamada à API):
- `/public/pcpWorkCenters/pcpWorkCenters.html` — Centros de trabalho (custo/hora, capacidade)
- `/public/pcpBom/pcpBom.html` — Ficha técnica: componentes com % de perda, roteiro de operações e custo por unidade
- `/public/pcpProductionOrders/pcpProductionOrders.html` — Ordens de produção: Planejada → Liberada → Em produção → Concluída (ou Cancelada), apontamentos, materiais
- `/public/pcpMrp/pcpMrp.html` — Necessidade de materiais das OPs abertas × estoque e estoque mínimo, com exportação CSV

Backend: `routes/pcpRoutes.js` → `controllers/pcpController.js` → `repositories/pcp/*`, montado em `server.js` como `app.use('/api/pcp', requireAuth, pcpRoutes)`.
As tabelas `pcp*` são criadas automaticamente (CREATE TABLE IF NOT EXISTS).

Regras:
- Uma ficha ativa por produto. A OP copia os materiais da ficha ativa no momento da criação.
- Só os apontamentos da última operação do roteiro somam na quantidade produzida; o refugo sempre soma.
- Ao concluir a OP, no modo de estoque simples: entrada da quantidade produzida e baixa dos componentes por (produzido + refugo). No modo com lote, nada é lançado e a tela avisa.

## Deploy (Google Cloud Run, igual ao Infinity)

Mesmo esquema do Infinity: `backend/deploy.ps1` (deploy completo), `backend/deploy-file.ps1`
(só arquivos alterados) e `backend/deploy-bucket.ps1` (permissões nos buckets do GCS).
Rodam no PC (PowerShell + gcloud) ou pela aba **Actions** do GitHub:

- **Deploy Cloud Run**: `so-codigo` publica só o código e mantém envs/segredos do serviço;
  `completo` aplica o `.env` guardado no secret. O primeiro deploy tem que ser `completo`.
- **Deploy arquivos**: copia só os arquivos informados (ou os do último commit) por cima da imagem atual.

Configuração no GitHub (Settings > Secrets and variables > Actions). O repositório é público:
nada disso vai em arquivo.
- Secret `ENV_FILE`: conteúdo completo do `backend/.env` de produção, com
  `DB_NAME=prodnex`, `JWT_SECRET` novo e `DEPLOY_PROJECT`, `DEPLOY_REGION`, `DEPLOY_SERVICE=prodnex`
  (o deploy recusa serviço novo cujo nome difere do `DB_NAME`).
- Login no Google Cloud, uma das opções:
  - Variáveis `GCP_WIF_PROVIDER` e `GCP_SA_EMAIL` (Workload Identity, sem chave; recomendado), ou
  - Secret `GCP_SA_KEY` com o JSON da chave da service account.

A service account do deploy precisa de: Cloud Run Admin, Cloud Build Editor, Artifact Registry Admin,
Service Usage Admin, Service Account User e Storage Admin (bucket do Cloud Build). Banco no Cloud SQL:
use `DB_MODE=cloud` e `INSTANCE_CONNECTION_NAME` no `.env`; o deploy completo conecta a instância ao serviço
(a service account do Cloud Run precisa do papel Cloud SQL Client).
