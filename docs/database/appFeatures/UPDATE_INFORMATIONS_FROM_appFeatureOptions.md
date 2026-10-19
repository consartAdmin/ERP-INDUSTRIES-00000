```SQL

BEGIN;

WITH desired_options (
    feature_code,
    option_code,
    option_name,
    description,
    option_config,
    sort_order,
    is_active
) AS (
    VALUES
        /* BUDGET_PDF_TEMPLATE */
        (
            'BUDGET_PDF_TEMPLATE',
            'SIMPLE',
            'PDF simples',
            'Orçamento sem imagens dos produtos.',
            '{"generatorKey": "budgetPdfSimple"}'::jsonb,
            10,
            TRUE
        ),
        (
            'BUDGET_PDF_TEMPLATE',
            'WITH_IMAGES',
            'PDF com imagens',
            'Orçamento com imagens dos produtos.',
            '{"generatorKey": "budgetPdfWithImages"}'::jsonb,
            20,
            TRUE
        ),

        /* PRODUCT_PRICE_MODE */
        (
            'PRODUCT_PRICE_MODE',
            'SINGLE',
            'Preço único',
            'Utiliza somente um preço ativo/padrão por produto.',
            '{
                "managerMode": "single",
                "allowMultiplePrices": false
            }'::jsonb,
            10,
            TRUE
        ),
        (
            'PRODUCT_PRICE_MODE',
            'MULTIPLE',
            'Múltiplos preços',
            'Permite múltiplas tabelas e preços por produto.',
            '{
                "managerMode": "multiple",
                "allowMultiplePrices": true
            }'::jsonb,
            20,
            TRUE
        ),

        /* PRODUCT_STOCK_MODE */
        (
            'PRODUCT_STOCK_MODE',
            'STOCK_WITH_LOT',
            'Estoque com lote',
            'Controla o estoque separadamente por produto e lote.',
            '{
                "requireLot": true,
                "managerMode": "with_lot"
            }'::jsonb,
            10,
            TRUE
        ),
        (
            'PRODUCT_STOCK_MODE',
            'STOCK_SIMPLE',
            'Estoque simples',
            'Controla somente o saldo total do produto, sem utilização de lote.',
            '{
                "requireLot": false,
                "managerMode": "simple"
            }'::jsonb,
            20,
            TRUE
        ),

        /* PRODUCT_UNIT_MODE */
        (
            'PRODUCT_UNIT_MODE',
            'UNIT_SINGLE',
            'Unidade única',
            'Permite somente uma unidade ativa e padrão por produto.',
            '{
                "managerMode": "single",
                "allowMultipleUnits": false
            }'::jsonb,
            10,
            TRUE
        ),
        (
            'PRODUCT_UNIT_MODE',
            'UNIT_MULTIPLE',
            'Múltiplas unidades',
            'Permite várias unidades e fatores de conversão por produto.',
            '{
                "managerMode": "multiple",
                "allowMultipleUnits": true
            }'::jsonb,
            20,
            TRUE
        ),

        /* NFE_ISSUANCE_SOURCE */
        (
            'NFE_ISSUANCE_SOURCE',
            'BUDGET_ONLY',
            'Emitir pelo Orçamento',
            'Emite NF-e diretamente pelo orçamento. A transformação do orçamento em pedido fica indisponível.',
            '{
                "issue_from_order": false,
                "issue_from_budget": true,
                "allow_budget_to_order": false
            }'::jsonb,
            10,
            TRUE
        ),
        (
            'NFE_ISSUANCE_SOURCE',
            'ORDER_ONLY',
            'Emitir pelo Pedido',
            'A NF-e deve ser emitida pelo módulo de Pedidos. O orçamento pode ser transformado em pedido.',
            '{
                "issue_from_order": true,
                "issue_from_budget": false,
                "allow_budget_to_order": true
            }'::jsonb,
            20,
            TRUE
        ),
        (
            'NFE_ISSUANCE_SOURCE',
            'BOTH',
            'Orçamento e Pedido',
            'Permite emitir NF-e diretamente pelo orçamento ou transformar o orçamento em pedido e emitir posteriormente pelo pedido.',
            '{
                "issue_from_order": true,
                "issue_from_budget": true,
                "allow_budget_to_order": true
            }'::jsonb,
            30,
            TRUE
        )
),

resolved_options AS (
    SELECT
        af.feature_id,
        source.option_code,
        source.option_name,
        source.description,
        source.option_config,
        source.sort_order,
        source.is_active
    FROM desired_options AS source
    INNER JOIN public."appFeatures" AS af
        ON af.feature_code = source.feature_code
),

updated_options AS (
    UPDATE public."appFeatureOptions" AS current_option
    SET
        option_name   = source.option_name,
        description   = source.description,
        option_config = source.option_config,
        sort_order    = source.sort_order,
        is_active     = source.is_active,
        updated_at    = NOW()
    FROM resolved_options AS source
    WHERE current_option.feature_id = source.feature_id
      AND current_option.option_code = source.option_code
    RETURNING
        current_option.feature_id,
        current_option.option_code
)

INSERT INTO public."appFeatureOptions" (
    feature_id,
    option_code,
    option_name,
    description,
    option_config,
    sort_order,
    is_active
)
SELECT
    source.feature_id,
    source.option_code,
    source.option_name,
    source.description,
    source.option_config,
    source.sort_order,
    source.is_active
FROM resolved_options AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public."appFeatureOptions" AS existing
    WHERE existing.feature_id = source.feature_id
      AND existing.option_code = source.option_code
);

COMMIT;

```