<!--🟢CREATE THE FEATURE "PRODUCT_LOCATIONS" (run once)-->
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
   'PRODUCT_LOCATIONS',
   'Localização de produtos',
   'Define se o sistema utiliza localizações físicas de produtos (local, corredor, prateleira, bandeja, posição) nos cadastros, listagens, inventário, mobile, menus e PDFs de separação.',
   'OPTION',
   json_build_object('optionCode', 'LOCATIONS_ENABLED'),
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
   ('LOCATIONS_ENABLED', 'Usar localizações', 'Exibe campos, colunas, menus e telas de localização de produtos em todos os módulos.', '{"useLocations": true}', 10),
   ('LOCATIONS_DISABLED', 'Não usar localizações', 'Oculta campos, colunas, menus e telas de localização de produtos em todos os módulos.', '{"useLocations": false}', 20)
) AS o (option_code, option_name, description, option_config, sort_order)
WHERE f.feature_code = 'PRODUCT_LOCATIONS';

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
 AND o.option_code = 'LOCATIONS_ENABLED'
WHERE f.feature_code = 'PRODUCT_LOCATIONS';

COMMIT;

SELECT f.feature_id, f.feature_code, o.feature_option_id, o.option_code, a.feature_assignment_id
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o ON o.feature_id = f.feature_id
LEFT JOIN public."appFeatureAssignments" a
  ON a.feature_id = f.feature_id AND a.feature_option_id = o.feature_option_id
WHERE f.feature_code = 'PRODUCT_LOCATIONS';
```
---------------------------------------
---------------------------------------
---------------------------------------

<!--🟢TURN ON THE "LOCATIONS_ENABLED"-->
```sql
UPDATE public."appFeatureAssignments" a
SET
feature_option_id = o.feature_option_id,
updated_at = NOW ()
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o
  ON o.feature_id = f.feature_id
 AND o.option_code = 'LOCATIONS_ENABLED'
WHERE a.feature_id = f.feature_id
  AND a.scope_type = 'GLOBAL'
  AND a.scope_id = 1
  AND f.feature_code = 'PRODUCT_LOCATIONS';

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'LOCATIONS_ENABLED'
   ),
updated_at = NOW ()
  WHERE feature_code = 'PRODUCT_LOCATIONS'
RETURNING * ;
```
---------------------------------------
---------------------------------------
---------------------------------------

<!--🟢TURN ON THE "LOCATIONS_DISABLED"-->
```sql
UPDATE public."appFeatureAssignments" a
SET
feature_option_id = o.feature_option_id,
updated_at = NOW ()
FROM public."appFeatures" f
JOIN public."appFeatureOptions" o
  ON o.feature_id = f.feature_id
 AND o.option_code = 'LOCATIONS_DISABLED'
WHERE a.feature_id = f.feature_id
  AND a.scope_type = 'GLOBAL'
  AND a.scope_id = 1
  AND f.feature_code = 'PRODUCT_LOCATIONS';

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'LOCATIONS_DISABLED'
   ),
updated_at = NOW ()
  WHERE feature_code = 'PRODUCT_LOCATIONS'
RETURNING * ;
```
