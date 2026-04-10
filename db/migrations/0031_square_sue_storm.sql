-- Drop persona tables and column (persona-to-skill migration)
DROP TABLE IF EXISTS "persona_customization";
DROP TABLE IF EXISTS "custom_persona";
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "persona_detection_enabled";
