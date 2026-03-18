CREATE TABLE "exam_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade_level" text NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"instructions" text,
	"header_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_types" text[] DEFAULT '{mcq}'::text[] NOT NULL,
	"enabled_blooms_levels" text[] DEFAULT '{remember,understand,apply}'::text[] NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb,
	"answer" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"blooms_level" text NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"grade_level" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question_bank" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_exam_id" text,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb,
	"answer" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"blooms_level" text NOT NULL,
	"default_points" integer DEFAULT 1 NOT NULL,
	"subject" text NOT NULL,
	"grade_level" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_draft" ADD CONSTRAINT "exam_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_question" ADD CONSTRAINT "exam_question_exam_id_exam_draft_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exam_draft"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_question" ADD CONSTRAINT "exam_question_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_question_bank" ADD CONSTRAINT "exam_question_bank_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_question_bank" ADD CONSTRAINT "exam_question_bank_source_exam_id_exam_draft_id_fk" FOREIGN KEY ("source_exam_id") REFERENCES "public"."exam_draft"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exam_draft_userId_idx" ON "exam_draft" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "exam_question_examId_idx" ON "exam_question" USING btree ("exam_id");
--> statement-breakpoint
CREATE INDEX "exam_question_userId_idx" ON "exam_question" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "exam_bank_userId_idx" ON "exam_question_bank" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "exam_bank_subject_idx" ON "exam_question_bank" USING btree ("subject");
--> statement-breakpoint
CREATE INDEX "exam_bank_type_idx" ON "exam_question_bank" USING btree ("type");
