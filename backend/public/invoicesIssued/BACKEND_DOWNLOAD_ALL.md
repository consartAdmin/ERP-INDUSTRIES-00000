# Download completo da NF-e

O novo botão da coluna **Ações** chama:

```http
GET /api/invoices-issued/:invoiceId/download-all
Accept: application/zip, application/json
```

## Resposta de sucesso

- Status: `200`
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="nfe-<numero>-documentos.zip"`
- Corpo: ZIP contendo o XML, o DANFE em PDF e todos os boletos associados à nota.

O endpoint deve reaproveitar a mesma rotina que reúne os anexos de
`POST /api/invoices-issued/:invoiceId/send-email`, evitando duplicar a lógica de
consulta e geração dos boletos.

Estrutura sugerida do ZIP:

```text
NF-e-<numero>/
  nfe-<numero>.xml
  danfe-<numero>.pdf
  boletos/
    boleto-1.pdf
    boleto-2.pdf
```

## Respostas de erro

Retorne JSON para que a interface apresente a mensagem ao usuário:

```json
{
  "ok": false,
  "message": "Não foi possível localizar os documentos desta nota fiscal."
}
```

Use `404` quando a nota não existir e `422` quando ela existir, mas nenhum
documento estiver disponível. Outros erros podem retornar `500`, sem expor
credenciais, caminhos internos ou detalhes sensíveis.
