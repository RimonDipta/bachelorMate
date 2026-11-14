import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, House, Users, Check, Clock } from "lucide-react";
import { api } from "../lib/api";
import { Avatar, Badge, Button, Card, EmptyState, LoadingBlock, PageHeader, Tabs } from "../components/ui";
import { HomeReviewModal, RoommateReviewModal } from "../components/ReviewForms";
import { HOME_TYPES, initials } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

export default function MyReviews() {
  const t = useT();
  const [tab, setTab] = useState("homes");
  const [homeModal, setHomeModal] = useState(null);
  const [personModal, setPersonModal] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["reviews", "eligible"], queryFn: () => api.get("/reviews/eligible") });
  const homes = data?.homes || [];
  const people = data?.people || [];

  return (
    <main className="content content-narrow">
      <PageHeader title={t("nav.reviews")} description={t("myReviews.desc")} />
      <Tabs value={tab} onChange={setTab} items={[{ value: "homes", label: t("nav.homes"), icon: House }, { value: "people", label: t("myReviews.roommates"), icon: Users, count: people.filter((p) => !p.reviewed).length }]} />
      <Card>
        {isLoading ? <LoadingBlock rows={3} /> : tab === "homes" ? (
          !homes.length ? <EmptyState icon={House} title={t("shell.noHomes")} description={t("myReviews.noHomesHint")} /> : (
            <div className="list">
              {homes.map((h) => (
                <div key={h.home._id} className="list-item">
                  <div className="home-mark" style={{ width: 36, height: 36, fontSize: 12 }}>{initials(h.home.name)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong text-sm truncate">{h.home.name}</div>
                    <div className="text-xs muted">{HOME_TYPES[h.home.type] || t("mobileNav.home")} · {h.status === "active" ? t("myReviews.liveHere") : t("myReviews.formerHome")} · {t("myReviews.days", { count: h.daysStayed })}</div>
                  </div>
                  {h.reviewed ? <Badge tone="success" icon={Check}>{t("myReviews.reviewed")}</Badge> : null}
                  {h.eligible ? (
                    <Button size="sm" variant={h.reviewed ? "ghost" : "primary"} icon={Star} onClick={() => setHomeModal(h)}>{h.reviewed ? t("common.edit") : t("myReviews.review")}</Button>
                  ) : (
                    <Badge icon={Clock}>{t("myReviews.after", { count: data.minStayDays })}</Badge>
                  )}
                </div>
              ))}
            </div>
          )
        ) : !people.length ? (
          <EmptyState icon={Users} title={t("myReviews.noRoommates")} description={t("myReviews.noRoommatesHint", { count: data.minStayDays })} />
        ) : (
          <div className="list">
            {people.map((p) => (
              <div key={`${p.user._id}:${p.home._id}`} className="list-item">
                <Avatar user={p.user} size={36} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <Link to={`/people/${p.user._id}`} className="strong text-sm" style={{ color: "var(--text)" }}>{p.user.name}</Link>
                  <div className="text-xs muted">{p.home.name} · {t("myReviews.together", { count: p.daysTogether })}</div>
                </div>
                {p.reviewed && <Badge tone="success" icon={Check}>{t("myReviews.reviewed")}</Badge>}
                <Button size="sm" variant={p.reviewed ? "ghost" : "primary"} icon={Star} onClick={() => setPersonModal(p)}>{p.reviewed ? t("myReviews.updateShort") : t("myReviews.review")}</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <HomeReviewModal open={Boolean(homeModal)} onClose={() => setHomeModal(null)} homeId={homeModal?.home._id} homeName={homeModal?.home.name} />
      <RoommateReviewModal open={Boolean(personModal)} onClose={() => setPersonModal(null)} person={personModal?.user} home={personModal?.home} />
    </main>
  );
}
