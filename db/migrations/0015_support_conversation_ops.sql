ALTER TABLE "support_conversation"
ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX "support_conversation_tags_idx" ON "support_conversation" USING gin ("tags");
