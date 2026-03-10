ALTER TABLE "agent" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "agent_share" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_share" ADD CONSTRAINT "agent_share_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_share" ADD CONSTRAINT "agent_share_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_share_unique_idx" ON "agent_share" USING btree ("agent_id","shared_with_user_id");
--> statement-breakpoint
CREATE INDEX "agent_share_agentId_idx" ON "agent_share" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "agent_share_sharedWithUserId_idx" ON "agent_share" USING btree ("shared_with_user_id");
