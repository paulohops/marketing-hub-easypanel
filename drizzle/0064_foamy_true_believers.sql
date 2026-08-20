DO $$ BEGIN
  CREATE TYPE request_type AS ENUM ('action', 'event', 'media', 'finance', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE permission_module ADD VALUE IF NOT EXISTS 'requests';

CREATE TABLE IF NOT EXISTS requests (
  id serial PRIMARY KEY,
  title varchar(180) NOT NULL,
  description text,
  "requestType" request_type NOT NULL DEFAULT 'action',
  status request_status NOT NULL DEFAULT 'submitted',
  priority request_priority NOT NULL DEFAULT 'normal',
  "requestedByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "assignedToUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "regionalId" integer REFERENCES regionals(id) ON DELETE SET NULL,
  "cityId" integer REFERENCES cities(id) ON DELETE SET NULL,
  "requestedForDate" date,
  "dueDate" date,
  "linkedEntityType" varchar(64),
  "linkedEntityId" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS request_history (
  id serial PRIMARY KEY,
  "requestId" integer NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  "actorUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  action varchar(64) NOT NULL,
  "fromStatus" request_status,
  "toStatus" request_status,
  note text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
