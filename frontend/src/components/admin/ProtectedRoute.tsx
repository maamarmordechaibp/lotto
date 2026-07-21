import { Navigate, Outlet } from "react-router-dom";
import { useSession, useRoles } from "@/hooks/useAuth";
import type { AppRole } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  allow?: AppRole[];
}

/** Guards admin routes: requires a session and (optionally) a role. */
export function ProtectedRoute({ allow }: Props) {
  const { session, loading } = useSession();
  const { data: roles, isLoading: rolesLoading } = useRoles();

  if (loading || rolesLoading) {
    return (
      <div className="container py-12 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;

  if (allow && !(roles ?? []).some((r) => allow.includes(r))) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
