# Alertas de erro por e-mail — CONSART ERP

O destinatário padrão já está definido como `contato@consart.com.br`.

## 1. Copie as variáveis

Copie o conteúdo de `.env.error-email.example` para o `.env` usado pelo servidor (ou configure as mesmas variáveis no Cloud Run).

Preencha os dados SMTP do endereço que enviará os alertas:

```env
ERROR_EMAIL_ENABLED=true
ERROR_EMAIL_TO=contato@consart.com.br
ERROR_EMAIL_SMTP_HOST=smtp.seu-provedor.com.br
ERROR_EMAIL_SMTP_PORT=587
ERROR_EMAIL_SMTP_SECURE=false
ERROR_EMAIL_SMTP_USER=seu-email@consart.com.br
ERROR_EMAIL_SMTP_PASS=sua-senha-ou-senha-de-aplicativo
ERROR_EMAIL_FROM=seu-email@consart.com.br
```

- Porta `587`: normalmente use `ERROR_EMAIL_SMTP_SECURE=false` (STARTTLS).
- Porta `465`: normalmente use `ERROR_EMAIL_SMTP_SECURE=true`.
- Google Workspace/Gmail com verificação em duas etapas exige uma senha de app; não use a senha normal da conta.
- Nunca salve a senha real no Git.

## 2. Teste

Depois de configurar o ambiente, execute:

```bash
npm run test:error-email
```

O comando deve mostrar `E-mail de teste enviado com sucesso.` e entregar uma mensagem de teste em `contato@consart.com.br`.

## 3. Reinicie o backend

Depois do teste, reinicie/reimplante o servidor. Os alertas cobrem:

- erros HTTP 500 ou superiores;
- erros do PostgreSQL registrados pelo logger central;
- falhas de inicialização, jobs e agendadores;
- `unhandledRejection`;
- `uncaughtException`.

Por padrão, o mesmo erro não é reenviado durante cinco minutos. Para alterar:

```env
ERROR_EMAIL_DEDUP_SECONDS=300
ERROR_EMAIL_MIN_STATUS=500
```
