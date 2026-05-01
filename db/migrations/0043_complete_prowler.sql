CREATE TABLE "user_tool_workspace_share" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"role" text DEFAULT 'runner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conrelid = 'user_tool_connection'::regclass
			AND conname = 'user_tool_connection_connected_account_id_connected_account_id_'
	) THEN
		ALTER TABLE "user_tool_connection"
			RENAME CONSTRAINT "user_tool_connection_connected_account_id_connected_account_id_"
			TO "user_tool_conn_account_fk";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_tool_workspace_share" ADD CONSTRAINT "user_tool_workspace_share_tool_id_user_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."user_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_workspace_share" ADD CONSTRAINT "user_tool_workspace_share_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_workspace_share_unique_idx" ON "user_tool_workspace_share" USING btree ("tool_id","brand_id");--> statement-breakpoint
CREATE INDEX "user_tool_workspace_share_toolId_idx" ON "user_tool_workspace_share" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "user_tool_workspace_share_brandId_idx" ON "user_tool_workspace_share" USING btree ("brand_id");--> statement-breakpoint
