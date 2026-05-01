CREATE TABLE "domain_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"line_user_id" text,
	"channel_id" text,
	"brand_id" text,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"locale" text DEFAULT 'th-TH' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_entity" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_entity_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"from_entity_id" text NOT NULL,
	"to_entity_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_profile" ADD CONSTRAINT "domain_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_profile" ADD CONSTRAINT "domain_profile_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_entity" ADD CONSTRAINT "domain_entity_profile_id_domain_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."domain_profile"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_profile_id_domain_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."domain_profile"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_from_entity_id_domain_entity_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."domain_entity"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_to_entity_id_domain_entity_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."domain_entity"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "domain_profile_userId_idx" ON "domain_profile" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "domain_profile_lineUserId_channelId_idx" ON "domain_profile" USING btree ("line_user_id","channel_id");
--> statement-breakpoint
CREATE INDEX "domain_profile_brandId_idx" ON "domain_profile" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "domain_profile_domain_idx" ON "domain_profile" USING btree ("domain");
--> statement-breakpoint
CREATE INDEX "domain_profile_status_idx" ON "domain_profile" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "domain_entity_profileId_idx" ON "domain_entity" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "domain_entity_profileId_entityType_idx" ON "domain_entity" USING btree ("profile_id","entity_type");
--> statement-breakpoint
CREATE INDEX "domain_entity_status_idx" ON "domain_entity" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "domain_entity_relation_profileId_idx" ON "domain_entity_relation" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX "domain_entity_relation_fromEntityId_idx" ON "domain_entity_relation" USING btree ("from_entity_id");
--> statement-breakpoint
CREATE INDEX "domain_entity_relation_toEntityId_idx" ON "domain_entity_relation" USING btree ("to_entity_id");
--> statement-breakpoint
CREATE INDEX "domain_entity_relation_relationType_idx" ON "domain_entity_relation" USING btree ("relation_type");
