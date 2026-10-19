# Correção da aba Fiscal — API V2

Arquivos alterados:

- `js/tabFiscal.js`
- `js/selectLoads.js`

## Causa

A aba Fiscal ainda chamava rotas legadas de `productsFiscal`. A API responsável
por `public.products_fiscal_v2` possui outro contrato e usa `product_code` como
texto. Por isso, o SKU não deve ser convertido em número nem substituído pelo
`product_id` interno.

## Fluxo corrigido

1. A aba consulta o vínculo atual em
   `GET /api/v2/products-fiscal/current/:productCode`.
2. **Vincular / Alterar Classificação** mantém a escolha do modal pendente.
3. **Confirmar Vínculo Fiscal** chama `PUT /api/v2/products-fiscal/current`.
4. O payload envia `product_code` como texto e `fiscal_classification_id` como
   inteiro positivo.
5. O Perfil Fiscal não é gravado separadamente: ele é herdado da classificação
   por `fiscal_classification_v2.fiscal_profile_id`.
6. **Remover Vínculo Fiscal** chama
   `POST /api/v2/products-fiscal/current/:productCode/close`.
7. Depois de salvar ou remover, a aba consulta novamente o vínculo V2. O retorno
   já contém os dados canônicos unidos de classificação e perfil.

## Payload de confirmação

```json
{
  "product_code": "00102002",
  "fiscal_classification_id": 123,
  "source_system": "editProducts",
  "source_reference": "editProducts:00102002"
}
```

Os zeros à esquerda de `product_code` são preservados.
