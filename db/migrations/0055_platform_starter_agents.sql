ALTER TABLE "platform_settings"
ADD COLUMN "guest_starter_agent_id" text,
ADD COLUMN "new_user_starter_template_id" text;

ALTER TABLE "platform_settings"
ADD CONSTRAINT "platform_settings_guest_starter_agent_id_agent_id_fk"
FOREIGN KEY ("guest_starter_agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "platform_settings"
ADD CONSTRAINT "platform_settings_new_user_starter_template_id_agent_id_fk"
FOREIGN KEY ("new_user_starter_template_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;
