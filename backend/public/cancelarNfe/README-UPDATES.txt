cancelarNfe — terminal alerts update

Alterações realizadas:
- Ao CONCLUIDO: mostra alert com protocolo/SEFAZ e fecha o modal.
- Ao REJEITADO: mostra alert de erro e fecha o modal.
- Ao ERRO: mostra alert de erro e fecha o modal.
- Ao TIMEOUT: mostra alert informativo e fecha o modal.
- Em exceção inesperada: mostra alert e fecha o modal.
- HTTP 400 transitório com mensagem de processamento NÃO fecha modal; aguarda e tenta novamente.
- Aguarda 2s antes da primeira consulta de status.
- Polling padrão: 2s; timeout: 60s.
- Cancelamento usa apenas nfe_provider_id; não usa nfe_key como fallback.
- Mantido PATCH em invoicesIssued após confirmação SEFAZ.
- Logs adicionais no frontend para sincronização do ERP.
- HTML continua carregando somente cancelarNfe.init.js.
