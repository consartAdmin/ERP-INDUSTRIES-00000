``` SQL

BEGIN;

INSERT INTO public."appFeatures" (
    feature_code,
    feature_name,
    description,
    value_type,
    default_value,
    is_active
)
VALUES
    (
        'NFE_ISSUANCE_SOURCE',
        'Origem da Emissão de NF-e',
        'Define de quais módulos a NF-e pode ser emitida: Orçamentos, Pedidos ou ambos.',
        'OPTION',
        '{"optionCode": "ORDER_ONLY"}'::jsonb,
        TRUE
    ),
    (
        'BUDGET_PDF_TEMPLATE',
        'Modelo do PDF de orçamento',
        'Define qual gerador será usado no PDF do orçamento.',
        'OPTION',
        '{"optionCode": "WITH_IMAGES"}'::jsonb,
        TRUE
    ),
    (
        'PRODUCT_PRICE_MODE',
        'Modo de preços dos produtos',
        'Define se os produtos trabalham com um preço único ou com múltiplas tabelas de preços.',
        'OPTION',
        '{"optionCode": "MULTIPLE"}'::jsonb,
        TRUE
    ),
    (
        'PRODUCT_STOCK_MODE',
        'Modo de controle de estoque',
        'Define se o estoque dos produtos utiliza controle por lote ou estoque simples.',
        'OPTION',
        '{"optionCode": "STOCK_WITH_LOT"}'::jsonb,
        TRUE
    ),
    (
        'PRODUCT_UNIT_MODE',
        'Modo de unidades dos produtos',
        'Define se cada produto trabalha com uma única unidade ou com múltiplas unidades e fatores de conversão.',
        'OPTION',
        '{"optionCode": "UNIT_MULTIPLE"}'::jsonb,
        TRUE
    )
ON CONFLICT (feature_code)
DO UPDATE SET
    feature_name  = EXCLUDED.feature_name,
    description   = EXCLUDED.description,
    value_type    = EXCLUDED.value_type,
    default_value = EXCLUDED.default_value,
    is_active     = EXCLUDED.is_active,
    updated_at    = NOW();

COMMIT;

```
