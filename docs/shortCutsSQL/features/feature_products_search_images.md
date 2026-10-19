<!--🟢CREATE THE FEATURE "PRODUCT_SEARCH_IMAGE_MODE" (run once)-->
```sql
BEGIN;

INSERT INTO public."appFeatures"
(
   feature_code,
   feature_name,
   description,
   value_type,
   default_value,
   is_active
)
VALUES
(
   'PRODUCT_SEARCH_IMAGE_MODE',
   'Imagens na busca de produtos',
   'Define se o modal de busca de produtos exibe ou não a coluna de imagem (miniatura + prévia ampliada).',
   'OPTION',
   json_build_object('optionCode', 'IMAGE_SHOW'),
   TRUE
);

INSERT INTO public."appFeatureOptions"
(
   feature_id,
   option_code,
   option_name,
   description,
   option_config,
   sort_order,
   is_active
)
SELECT f.feature_id, o.option_code, o.option_name, o.description, o.option_config::jsonb, o.sort_order, TRUE
FROM public."appFeatures" f
CROSS JOIN (VALUES
   ('IMAGE_SHOW', 'Exibir imagens', 'Exibe a coluna Foto no modal de busca de produtos.', '{"showImages": true}', 10),
   ('IMAGE_HIDE', 'Ocultar imagens', 'Oculta a coluna Foto no modal de busca de produtos.', '{"showImages": false}', 20)
) AS o (option_code, option_name, description, option_config, sort_order)
WHERE f.feature_code = 'PRODUCT_SEARCH_IMAGE_MODE';

INSERT INTO public."appFeatureAssignments"
(
   feature_id,
   feature_option_id,
   scope_type,
   scope_id,
   is_enabled
)
SELECT f.feature_id, o.feature_option_id, 'GLOBAL', 1, TRUE
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o
  ON o.feature_id = f.feature_id
 AND o.option_code = 'IMAGE_SHOW'
WHERE f.feature_code = 'PRODUCT_SEARCH_IMAGE_MODE';

COMMIT;

SELECT f.feature_id, f.feature_code, o.feature_option_id, o.option_code, a.feature_assignment_id
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o ON o.feature_id = f.feature_id
LEFT JOIN public."appFeatureAssignments" a
  ON a.feature_id = f.feature_id AND a.feature_option_id = o.feature_option_id
WHERE f.feature_code = 'PRODUCT_SEARCH_IMAGE_MODE';
```
---------------------------------------
---------------------------------------
---------------------------------------

<!--🟢TURN ON THE "IMAGE_SHOW"-->
```sql
UPDATE public."appFeatureAssignments" a
SET
feature_option_id = o.feature_option_id,
updated_at = NOW ()
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o
  ON o.feature_id = f.feature_id
 AND o.option_code = 'IMAGE_SHOW'
WHERE a.feature_id = f.feature_id
  AND a.scope_type = 'GLOBAL'
  AND a.scope_id = 1
  AND f.feature_code = 'PRODUCT_SEARCH_IMAGE_MODE';

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'IMAGE_SHOW'
   ),
updated_at = NOW ()
  WHERE feature_code = 'PRODUCT_SEARCH_IMAGE_MODE'
RETURNING * ;
```
---------------------------------------
---------------------------------------
---------------------------------------

<!--🟢TURN ON THE "IMAGE_HIDE"-->
```sql
UPDATE public."appFeatureAssignments" a
SET
feature_option_id = o.feature_option_id,
updated_at = NOW ()
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o
  ON o.feature_id = f.feature_id
 AND o.option_code = 'IMAGE_HIDE'
WHERE a.feature_id = f.feature_id
  AND a.scope_type = 'GLOBAL'
  AND a.scope_id = 1
  AND f.feature_code = 'PRODUCT_SEARCH_IMAGE_MODE';

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'IMAGE_HIDE'
   ),
updated_at = NOW ()
  WHERE feature_code = 'PRODUCT_SEARCH_IMAGE_MODE'
RETURNING * ;
```
