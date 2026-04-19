CREATE TABLE "brand_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"line_user_id" text,
	"channel_id" text,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_profile_userId_idx" ON "brand_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brand_profile_lineUserId_channelId_idx" ON "brand_profile" USING btree ("line_user_id","channel_id");