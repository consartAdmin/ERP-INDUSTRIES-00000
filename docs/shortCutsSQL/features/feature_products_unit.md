<!--🟢TURN ON THE "UNIT_SINGLE"-->
```sql
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 15,
updated_at = NOW ()

WHERE feature_assignment_id = 4;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'UNIT_SINGLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 8
  AND feature_code = 'PRODUCT_UNIT_MODE'
RETURNING * ;

```
<!--🟢TURN ON THE "UNIT_MULTIPLE"-->
```sql

UPDATE public."appFeatureAssignments"
SET
feature_option_id = 16,
updated_at = NOW ()

WHERE feature_assignment_id = 4;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'UNIT_MULTIPLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 8
  AND feature_code = 'PRODUCT_UNIT_MODE'
RETURNING * ;

```


