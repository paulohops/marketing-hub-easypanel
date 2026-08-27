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
--> statement-breakpoint
