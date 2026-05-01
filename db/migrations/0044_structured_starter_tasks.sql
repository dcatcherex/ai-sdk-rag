ALTER TABLE "agent"
ADD COLUMN "starter_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL;
