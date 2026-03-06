CREATE TABLE "user_model_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled_model_ids" text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_model_preference" ADD CONSTRAINT "user_model_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
