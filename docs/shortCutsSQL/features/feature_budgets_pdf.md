<!--🟢TURN ON THE "PDF_SIMPLE"-->
```sql
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 9,
updated_at = NOW ()

WHERE feature_assignment_id = 4;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'SIMPLE'
   ),
updated_at = NOW ()
  WHERE feature_id = 2
  AND feature_code = 'BUDGET_PDF_TEMPLATE'
RETURNING * ;
```
---------------------------------------
---------------------------------------
---------------------------------------

<!--🟢TURN ON THE "PDF_WITH_IMAGES"-->
```sql
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 2,
updated_at = NOW ()

WHERE feature_assignment_id = 1;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'WITH_IMAGES'
   ),
updated_at = NOW ()
  WHERE feature_id = 1
  AND feature_code = 'BUDGET_PDF_TEMPLATE'
RETURNING * ;
```


