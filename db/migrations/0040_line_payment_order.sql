CREATE TABLE "line_payment_order" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"package_id" text NOT NULL,
	"amount_thb" numeric(10, 2) NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"slip_ref" text,
	"sender_name" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_payment_order" ADD CONSTRAINT "line_payment_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "line_payment_order" ADD CONSTRAINT "line_payment_order_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "line_payment_order_userId_idx" ON "line_payment_order" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "line_payment_order_channelId_lineUserId_idx" ON "line_payment_order" USING btree ("channel_id","line_user_id");
--> statement-breakpoint
CREATE INDEX "line_payment_order_status_idx" ON "line_payment_order" USING btree ("status");
