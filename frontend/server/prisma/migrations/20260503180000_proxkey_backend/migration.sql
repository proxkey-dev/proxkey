-- Add github_login to organizations and create digest_logs table.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "github_login" TEXT;

CREATE TABLE IF NOT EXISTS "digest_logs" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                UUID NOT NULL,
  "period_start"          TIMESTAMP(3) NOT NULL,
  "period_end"            TIMESTAMP(3) NOT NULL,
  "total_spend_cents"     INTEGER NOT NULL DEFAULT 0,
  "wow_delta_percent"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "top_repos_json"        JSONB NOT NULL DEFAULT '[]',
  "top_waste_flags_json"  JSONB NOT NULL DEFAULT '[]',
  "email_sent"            BOOLEAN NOT NULL DEFAULT FALSE,
  "slack_sent"            BOOLEAN NOT NULL DEFAULT FALSE,
  "email_message_id"      TEXT,
  "slack_response_status" INTEGER,
  "error_message"         TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digest_logs_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "digest_logs_org_id_created_at_idx"
  ON "digest_logs"("org_id", "created_at");
