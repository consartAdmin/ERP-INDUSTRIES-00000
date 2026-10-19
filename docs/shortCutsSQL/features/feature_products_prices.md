<!--🟢TURN ON THE "PRICE_SINGLE"-->
```sql
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 11,
updated_at = NOW ()

WHERE feature_assignment_id = 1;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'SINGLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 3
  AND feature_code = 'PRODUCT_PRICE_MODE'
RETURNING * ;

```
<!--🟢TURN ON THE "PRICE_MULTIPLE"-->
```sql

UPDATE public."appFeatureAssignments"
SET
feature_option_id = 12,
updated_at = NOW ()

WHERE feature_assignment_id = 1;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'MULTIPLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 3
  AND feature_code = 'PRODUCT_PRICE_MODE'
RETURNING * ;

```


