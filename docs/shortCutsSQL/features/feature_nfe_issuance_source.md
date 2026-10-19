```sql



------------------------------------
🟢TURN ON THE "BUDGET_ONLY"
------------------------------------
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 6,
updated_at = NOW ()

WHERE feature_assignment_id = 3;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'BUDGET_ONLY'
   ),
updated_at = NOW ()
  WHERE feature_id = 1
  AND feature_code = 'NFE_ISSUANCE_SOURCE'
RETURNING * ;




------------------------------------
🟢TURN ON THE "ORDER_ONLY"
------------------------------------
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 7,
updated_at = NOW ()

WHERE feature_assignment_id = 3;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'ORDER_ONLY'
   ),
updated_at = NOW ()
  WHERE feature_id = 1
  AND feature_code = 'NFE_ISSUANCE_SOURCE'
RETURNING * ;




------------------------------------
🟢TURN ON THE "BOTH"
------------------------------------
UPDATE public."appFeatureAssignments"
SET
feature_option_id = 19,
updated_at = NOW ()

WHERE feature_assignment_id = 5;

UPDATE public."appFeatures"
SET
   default_value = json_build_object
   (
'optionCode',
'BOTH'
   ),
updated_at = NOW ()
  WHERE feature_id = 9
  AND feature_code = 'NFE_ISSUANCE_SOURCE'
RETURNING * ;




```


