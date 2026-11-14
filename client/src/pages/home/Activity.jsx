import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { History, Wallet, Users, Utensils, Settings, Mail, Megaphone, Receipt, House, CalendarDays } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Avatar, Button, Card, EmptyState, LoadingBlock, PageHeader, Segmented } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { useI18n } from "../../i18n/I18nProvider";
import { translateServer } from "../../i18n/serverText";

const ICONS = { member: Users, payment: Wallet, ledger: Wallet, expense: Receipt, meals: Utensils, meal_period: Utensils, settings: Settings, invite: Mail, request: Mail, announcement: Megaphone, home: House, calendar: CalendarDays };
const FILTERS = ["", "member", "payment", "expense", "meal", "request", "settings"];

export default function Activity() {
  const { homeId } = useHome();
  const { t, locale } = useI18n();
  const [action, setAction] = useState("");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity", homeId, action],
    queryFn: ({ pageParam }) => api.get(`/homes/${homeId}/activity`, { before: pageParam, action }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[last.items.length - 1].createdAt : undefined),
  });
  const items = data?.pages.flatMap((p) => p.items) || [];
  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title={t("nav.activity")} description={t("activity.desc")} />
      <div style={{ marginBottom: 12 }}><Segmented label={t("activity.filter")} value={action} onChange={setAction} items={FILTERS.map((value) => ({ value, label: t(`activity.filters.${value || "all"}`) }))} /></div>
      <Card>
        {isLoading ? <LoadingBlock /> : !items.length ? <EmptyState icon={History} title={t("activity.none")} /> : (
          <div className="timeline">
            {items.map((a) => {
              const I = ICONS[a.action.split(".")[0]] || History;
              return (
                <div key={a._id} className="timeline-item" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="timeline-dot"><I /></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="text-sm">{translateServer(a.summary)}</div>
                    <div className="row text-xs subtle" style={{ gap: 6 }}>
                      <Avatar user={a.actor} size={16} />
                      <span title={new Date(a.createdAt).toLocaleString(locale)}>{timeAgo(a.createdAt)}</span>
                      <span className="mono">{a.action}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasNextPage && <div className="card-foot" style={{ textAlign: "center" }}><Button size="sm" variant="ghost" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>{t("common.loadMore")}</Button></div>}
      </Card>
    </div>
  );
}
