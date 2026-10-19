# 00000-PRODNEX — ERP Industrial

Base copiada do ERP Infinity (00000-ERP-INFINITY-34-363-337-0001-85) em 18/10/2026,
mesma estrutura: `backend/` (Express ESM, routes → controllers → repositories/services,
telas em `backend/public/<modulo>/`), `desktop/` (Electron) e `docs/`.

## O que NÃO veio do Infinity
- Credenciais (`backend/config/credenciais-gcs.json`, `backend/keys/`), `.env`
- Dados de clientes: XMLs de NF-e, anexos de e-mail, PDFs gerados, uploads
- Deploy do Infinity (`.github/workflows`, `deploy*.ps1`, `svc.yaml`), logs e scripts avulsos
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

## Próximo: módulo de produção (PCP)
Ficha técnica (estrutura de produto), roteiros/centros de trabalho, ordens de produção,
apontamento e MRP — ver `docs/plano-erp-industrial.md`.
