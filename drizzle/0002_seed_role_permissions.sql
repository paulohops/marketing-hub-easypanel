INSERT INTO "role_permissions" ("role", "module", "action", "allowed")
SELECT
  role_value::"user_role",
  module_value::"permission_module",
  action_value::"permission_action",
  CASE
    WHEN role_value = 'admin' THEN true
    WHEN role_value = 'regional_manager' AND (
      action_value = 'read'
      OR (module_value IN ('settings', 'inventory', 'finance', 'media', 'actions', 'events') AND action_value IN ('create', 'update'))
      OR (module_value = 'documents' AND action_value = 'create')
    ) THEN true
    WHEN role_value = 'operator' AND (
      module_value = 'dashboard' AND action_value = 'read'
      OR (module_value IN ('inventory', 'media', 'actions', 'events') AND action_value IN ('read', 'create', 'update'))
      OR (module_value = 'documents' AND action_value = 'create')
    ) THEN true
    WHEN role_value IN ('viewer', 'user') AND module_value IN ('dashboard', 'inventory', 'finance', 'media', 'actions', 'events', 'map', 'notifications') AND action_value = 'read' THEN true
    ELSE false
  END
FROM (VALUES ('admin'), ('regional_manager'), ('operator'), ('viewer'), ('user')) AS roles(role_value)
CROSS JOIN (VALUES ('dashboard'), ('settings'), ('inventory'), ('finance'), ('media'), ('actions'), ('events'), ('documents'), ('map'), ('notifications')) AS modules(module_value)
CROSS JOIN (VALUES ('read'), ('create'), ('update'), ('delete')) AS actions(action_value)
ON CONFLICT ("role", "module", "action") DO NOTHING;
