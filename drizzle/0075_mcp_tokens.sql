CREATE TABLE IF NOT EXISTS "mcp_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "name" varchar(120) NOT NULL,
  "tokenHash" varchar(64) NOT NULL,
  "tokenPrefix" varchar(24) NOT NULL,
  "expiresAt" timestamp with time zone,
  "lastUsedAt" timestamp with time zone,
  "revokedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_tokens_tokenHash_unique" UNIQUE("tokenHash"),
  CONSTRAINT "mcp_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "mcp_tokens_user_idx" ON "mcp_tokens" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_tokens_hash_idx" ON "mcp_tokens" USING btree ("tokenHash");
