CREATE TABLE "public_agent_share" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"share_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"guest_message_limit" integer,
	"conversation_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_agent_share_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "public_agent_share" ADD CONSTRAINT "public_agent_share_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "public_agent_share_token_idx" ON "public_agent_share" USING btree ("share_token");
--> statement-breakpoint
CREATE INDEX "public_agent_share_agentId_idx" ON "public_agent_share" USING btree ("agent_id");
