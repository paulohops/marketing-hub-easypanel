import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export function isEffectivePermissionAllowed(permissions: readonly string[], permission: string) {
  if (permission.endsWith(".write")) {
    const module = permission.slice(0, -".write".length);
    return ["create", "update", "delete"].some(action => permissions.includes(`${module}.${action}`));
  }
  return permissions.includes(permission);
}

/**
 * Aplica as permissões efetivas calculadas no servidor, incluindo exceções individuais.
 * Não há fallback para a matriz estática do papel: enquanto a consulta carrega ou falha,
 * o acesso é negado para evitar que uma permissão revogada seja mostrada indevidamente.
 */
export function useEffectivePermissions() {
  const { user } = useAuth();
  const query = trpc.users.effectivePermissions.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const can = (permission: string) => {
    if (!user || !query.isSuccess) return false;
    return isEffectivePermissionAllowed(query.data, permission);
  };

  return { ...query, can };
}
