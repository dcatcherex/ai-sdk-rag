ALTER TABLE "certificate_template" ADD COLUMN "template_type" text DEFAULT 'certificate' NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "print_settings" jsonb DEFAULT '{"preset":"a4_3x3","pageSize":"A4","columns":3,"rows":3,"marginTopMm":12,"marginRightMm":12,"marginBottomMm":12,"marginLeftMm":12,"gapXMm":4,"gapYMm":4,"cropMarks":false,"cropMarkLengthMm":4,"cropMarkOffsetMm":2}'::jsonb NOT NULL;
