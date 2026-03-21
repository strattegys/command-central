-- Punch List table for tracking application fixes and improvements
CREATE TABLE "_punch_list" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId" TEXT NOT NULL DEFAULT 'suzi',
  title TEXT NOT NULL,
  description TEXT,
  rank INTEGER NOT NULL DEFAULT 4 CHECK (rank >= 1 AND rank <= 8),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_punch_list_agent_status ON "_punch_list" ("agentId", status) WHERE "deletedAt" IS NULL;
