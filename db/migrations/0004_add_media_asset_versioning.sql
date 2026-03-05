ALTER TABLE "media_asset" ADD COLUMN "parent_asset_id" text;
ALTER TABLE "media_asset" ADD COLUMN "root_asset_id" text;
ALTER TABLE "media_asset" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "media_asset" ADD COLUMN "edit_prompt" text;

ALTER TABLE "media_asset"
  ADD CONSTRAINT "media_asset_parent_fk"
  FOREIGN KEY ("parent_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL;

CREATE INDEX "media_asset_parent_idx" ON "media_asset" USING btree ("parent_asset_id");
CREATE INDEX "media_asset_root_idx" ON "media_asset" USING btree ("root_asset_id");
