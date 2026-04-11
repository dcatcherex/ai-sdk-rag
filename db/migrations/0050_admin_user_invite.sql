CREATE TABLE "admin_user_invite" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "status" text DEFAULT 'invited' NOT NULL,
  "token" text NOT NULL,
  "invited_by_user_id" text,
  "approved_on_accept" boolean DEFAULT true NOT NULL,
  "initial_credit_grant" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "accepted_user_id" text,
  "cancelled_at" timestamp,
  "last_sent_at" timestamp,
  "credit_granted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_user_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "admin_user_invite" ADD CONSTRAINT "admin_user_invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_user_invite" ADD CONSTRAINT "admin_user_invite_accepted_user_id_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "admin_user_invite_email_idx" ON "admin_user_invite" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "admin_user_invite_status_idx" ON "admin_user_invite" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "admin_user_invite_token_idx" ON "admin_user_invite" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "admin_user_invite_invitedBy_idx" ON "admin_user_invite" USING btree ("invited_by_user_id");
--> statement-breakpoint
CREATE INDEX "admin_user_invite_expiresAt_idx" ON "admin_user_invite" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "admin_user_invite_acceptedUser_idx" ON "admin_user_invite" USING btree ("accepted_user_id");
