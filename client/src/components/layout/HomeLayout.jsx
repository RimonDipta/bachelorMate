import { Suspense, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import ErrorBoundary from "../ErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { Archive, House } from "lucide-react";
import { api } from "../../lib/api";
import { HomeContext, buildHomeContext } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { Alert, EmptyState, PageSkeleton } from "../ui";
import { useT } from "../../i18n/I18nProvider";

export default function HomeLayout() {
  const { homeId } = useParams();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const t = useT();
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
          <EmptyState icon={House} title={t("homeLayout.unavailable")} description={t("homeLayout.unavailableHint")} action={<Link className="btn btn-primary" to="/homes">{t("homeLayout.goHomes")}</Link>} />
        </div>
      </main>
    );
  }
  return (
    <HomeContext.Provider value={ctx}>
      <main className="content">
        {ctx.archived && (
          <Alert tone="warning" icon={Archive} style={{ marginBottom: 16 }}>
            {t("homeLayout.archived")}{ctx.isAdmin && <> <Link to={`/h/${homeId}/settings`}>{t("homeLayout.restoreFromSettings")}</Link></>}
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
