CREATE TABLE "brand_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"line_user_id" text,
	"channel_id" text,
	"url" text NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_photo" ADD CONSTRAINT "brand_photo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_photo_userId_idx" ON "brand_photo" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brand_photo_lineUserId_channelId_idx" ON "brand_photo" USING btree ("line_user_id","channel_id");