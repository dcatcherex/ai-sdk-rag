ALTER TABLE "line_flex_template"
  ADD COLUMN "template_type" text NOT NULL DEFAULT 'line_only';
--> statement-breakpoint
ALTER TABLE "line_flex_template"
  ADD COLUMN "rich_template_key" text;
--> statement-breakpoint
CREATE INDEX "line_flex_template_template_type_idx" ON "line_flex_template" USING btree ("template_type");
--> statement-breakpoint
CREATE INDEX "line_flex_template_rich_template_key_idx" ON "line_flex_template" USING btree ("rich_template_key");
