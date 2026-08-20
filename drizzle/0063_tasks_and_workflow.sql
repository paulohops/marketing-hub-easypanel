DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_source AS ENUM ('manual', 'notification');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE permission_module ADD VALUE IF NOT EXISTS 'tasks';

CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  title varchar(180) NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'normal',
  source task_source NOT NULL DEFAULT 'manual',
  "assignedToUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "createdByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "sourceNotificationId" integer REFERENCES notifications(id) ON DELETE SET NULL,
  "entityType" varchar(64),
  "entityId" integer,
  "dueDate" date,
  position integer NOT NULL DEFAULT 0,
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_notification_uq ON tasks ("sourceNotificationId");

CREATE TABLE IF NOT EXISTS task_participants (
  id serial PRIMARY KEY,
  "taskId" integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "userId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL DEFAULT 'watcher',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_participants_task_user_uq UNIQUE ("taskId", "userId")
);

CREATE TABLE IF NOT EXISTS task_history (
  id serial PRIMARY KEY,
  "taskId" integer NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "actorUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  action varchar(64) NOT NULL,
  "fromStatus" task_status,
  "toStatus" task_status,
  note text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
