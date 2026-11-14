import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { Avatar, Button, Card, EmptyState, LoadingBlock, PageHeader, Badge } from "../components/ui";
import { timeAgo } from "../lib/format";
import { useT } from "../i18n/I18nProvider";
import { translateServer } from "../i18n/serverText";

export default function Notifications() {
  const navigate = useNavigate();
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) => api.get("/notifications", { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[last.items.length - 1].createdAt : undefined),
  });
  const items = data?.pages.flatMap((p) => p.items) || [];
  const unread = data?.pages[0]?.unread || 0;
  const readAll = useAction(() => api.post("/notifications/read-all"), { invalidate: [["notifications"]], success: t("notifs.caughtUp") });

  const open = async (n) => {
    if (!n.readAt) {
      await api.post(`/notifications/${n._id}/read`).catch(() => {});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) navigate(n.link);
  };

  return (
    <main className="content content-narrow">
      <PageHeader title={t("nav.notifications")} description={unread ? t("notifs.unread", { n: unread }) : t("notifs.allCaughtUp")}
        actions={<><Link to="/settings/notifications" className="btn btn-ghost"><Settings2 size={16} /> {t("notifs.preferences")}</Link><Button icon={CheckCheck} onClick={() => readAll.mutate()} disabled={!unread}>{t("notifs.markAll")}</Button></>} />
      <Card>
        {isLoading ? <LoadingBlock /> : !items.length ? <EmptyState icon={Bell} title={t("notifs.none")} description={t("notifs.noneHint")} /> : (
          <div className="list">
            {items.map((n) => (
              <button key={n._id} className={`list-item ${n.readAt ? "" : "unread"}`} style={{ width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: n.readAt ? "none" : undefined, textAlign: "left", cursor: "pointer", alignItems: "flex-start" }} onClick={() => open(n)}>
                {n.actor ? <Avatar user={n.actor} size={32} /> : <div className="timeline-dot" style={{ width: 32, height: 32 }}><Bell /></div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className={`text-sm ${n.readAt ? "" : "strong"}`}>{translateServer(n.title)}</div>
                  {n.body && <div className="text-sm muted">{translateServer(n.body)}</div>}
                  <div className="row text-xs subtle" style={{ marginTop: 2 }}>{timeAgo(n.createdAt)}{n.home && <Badge>{n.home.name}</Badge>}</div>
                </div>
                {!n.readAt && <span className="dot" style={{ background: "var(--accent)", marginTop: 6 }} />}
              </button>
            ))}
          </div>
        )}
        {hasNextPage && <div className="card-foot" style={{ textAlign: "center" }}><Button size="sm" variant="ghost" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>{t("common.loadMore")}</Button></div>}
      </Card>
    </main>
  );
}
