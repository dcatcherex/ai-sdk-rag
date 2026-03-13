CREATE TABLE "support_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"channel" text DEFAULT 'line' NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"picture_url" text,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"channel" text DEFAULT 'line' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text,
	"assigned_to_user_id" text,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"last_inbound_at" timestamp,
	"last_outbound_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_message" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"direction" text NOT NULL,
	"sender_type" text NOT NULL,
	"body" text,
	"external_message_id" text,
	"line_reply_token" text,
	"model_id" text,
	"payload" jsonb,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_contact" ADD CONSTRAINT "support_contact_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_conversation" ADD CONSTRAINT "support_conversation_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_conversation" ADD CONSTRAINT "support_conversation_contact_id_support_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."support_contact"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_conversation" ADD CONSTRAINT "support_conversation_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_conversation_id_support_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."support_conversation"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_contact_id_support_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."support_contact"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "support_contact_owner_idx" ON "support_contact" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "support_contact_external_unique_idx" ON "support_contact" USING btree ("owner_user_id","channel","external_id");
--> statement-breakpoint
CREATE INDEX "support_conversation_owner_idx" ON "support_conversation" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "support_conversation_contact_idx" ON "support_conversation" USING btree ("contact_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "support_conversation_contact_unique_idx" ON "support_conversation" USING btree ("owner_user_id","contact_id","channel");
--> statement-breakpoint
CREATE INDEX "support_message_owner_idx" ON "support_message" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "support_message_conversation_idx" ON "support_message" USING btree ("conversation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "support_message_external_unique_idx" ON "support_message" USING btree ("external_message_id");
