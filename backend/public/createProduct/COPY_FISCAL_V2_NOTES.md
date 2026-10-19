# Cópia de Produto — Vínculo Fiscal V2

Ao usar **Copiar Produto**, o cadastro continua em modo de criação. Depois que o
backend cria o novo produto e retorna o novo `product_code`, a tela copia:

1. unidades;
2. grades;
3. vínculo fiscal atual.

## Fluxo fiscal

- Origem: `GET /api/v2/products-fiscal/current/:sourceProductCode`
- Destino: `PUT /api/v2/products-fiscal/current`
- O `product_code` é mantido como texto; zeros à esquerda são preservados.
- É copiado somente o `fiscal_classification_id`.
- O Perfil Fiscal do destino é herdado da classificação por
  `fiscal_classification_v2.fiscal_profile_id`.
- Se o produto de origem não tiver vínculo fiscal atual, o novo produto é criado
  normalmente sem vínculo.
- Se apenas a cópia fiscal falhar, o produto permanece criado e a tela apresenta
  um aviso de importação parcial para revisão.

O vínculo copiado registra `source_system: "createProductCopy"` e o SKU de origem
em `source_reference`/`extra_payload`, facilitando auditoria.

## SKU do novo produto

O campo **Produto Code (SKU)** fica editável enquanto o cadastro ainda não foi
criado:

- preenchido: o valor é enviado como texto no `POST /api/products`;
- vazio: `product_code` é omitido e o trigger mantém a geração automática;
- duplicado: o controller retorna HTTP `409` com a mensagem de SKU existente;
- após a criação: o campo volta a ficar bloqueado para evitar alterar o vínculo
  usado pelas unidades, grades e pelo Produto Fiscal V2.
