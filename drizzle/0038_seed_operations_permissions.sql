DO $$
BEGIN
  -- Some existing databases recorded the enum migration without the value.
  -- Defer the actual enum repair to a later migration so this seed remains safe.
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'permission_module'
      AND enum_value.enumlabel = 'operations'
  ) THEN
    INSERT INTO "role_permissions" ("role", "module", "action", "allowed")
    SELECT
      role_value::"user_role",
      'operations'::"permission_module",
      action_value::"permission_action",
      CASE
        WHEN role_value = 'admin' THEN true
        WHEN role_value = 'regional_manager' AND action_value IN ('read', 'create', 'update') THEN true
        WHEN role_value = 'operator' AND action_value IN ('read', 'create', 'update') THEN true
        WHEN role_value IN ('viewer', 'user') AND action_value = 'read' THEN true
        ELSE false
      END
    FROM (VALUES ('admin'), ('regional_manager'), ('operator'), ('viewer'), ('user')) AS roles(role_value)
    CROSS JOIN (VALUES ('read'), ('create'), ('update'), ('delete')) AS actions(action_value)
    ON CONFLICT ("role", "module", "action") DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint
