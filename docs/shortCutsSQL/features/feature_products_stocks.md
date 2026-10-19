<!--🟢TURN ON THE "STOCK_SIMPLE"-->
```sql
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 5,
updated_at = NOW ()

WHERE feature_assignment_id = 2;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'STOCK_SIMPLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 4
  AND feature_code = 'PRODUCT_STOCK_MODE'
RETURNING * ;

```
<!--🟢TURN ON THE "STOCK_WITH_LOT"-->
```sql

UPDATE public."appFeatureAssignments"
SET
feature_option_id = 13,
updated_at = NOW ()

WHERE feature_assignment_id = 3;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'STOCK_WITH_LOT'
   ),
updated_at = NOW ()
  WHERE feature_id = 7
  AND feature_code = 'PRODUCT_STOCK_MODE'
RETURNING * ;

```


