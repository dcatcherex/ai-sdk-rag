ALTER TABLE "certificate_template"
ALTER COLUMN "print_settings"
SET DEFAULT '{"preset":"a4_3x3","pageSize":"A4","columns":3,"rows":3,"marginTopMm":12,"marginRightMm":12,"marginBottomMm":12,"marginLeftMm":12,"gapXMm":4,"gapYMm":4,"cropMarks":false,"cropMarkLengthMm":4,"cropMarkOffsetMm":2,"duplexMode":"single_sided","backPageOrder":"same","backOffsetXMm":0,"backOffsetYMm":0,"backFlipX":false,"backFlipY":false}'::jsonb;
