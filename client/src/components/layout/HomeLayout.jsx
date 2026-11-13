import { Suspense, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import ErrorBoundary from "../ErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { Archive, House } from "lucide-react";
import { api } from "../../lib/api";
import { HomeContext, buildHomeContext } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { Alert, EmptyState, PageSkeleton } from "../ui";

export default function HomeLayout() {
  const { homeId } = useParams();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["home", homeId], queryFn: () => api.get(`/homes/${homeId}`), retry: false });

  // Remember the last opened home so /app returns here next time.
  useEffect(() => {
    if (data?.home && user && String(user.lastActiveHome) !== homeId) {
      api.patch("/users/me/preferences", { lastActiveHome: homeId }).then((r) => setUser(r.user)).catch(() => {});
    }
  }, [data, homeId, user, setUser]);

  const ctx = useMemo(() => (data?.home ? buildHomeContext(data.home) : null), [data]);

  if (isLoading) return <main className="content"><PageSkeleton /></main>;
  if (error || !ctx) {
    return (
      <main className="content">
        <div className="card">
          <EmptyState icon={House} title="Home not available" description="This home doesn't exist or you're no longer a member." action={<Link className="btn btn-primary" to="/homes">Go to your homes</Link>} />
        </div>
      </main>
    );
  }
  return (
    <HomeContext.Provider value={ctx}>
      <main className="content">
        {ctx.archived && (
          <Alert tone="warning" icon={Archive} style={{ marginBottom: 16 }}>
            This home is archived and read-only.{ctx.isAdmin && <> Restore it from <Link to={`/h/${homeId}/settings`}>settings</Link>.</>}
          </Alert>
        )}
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </HomeContext.Provider>
  );
}
