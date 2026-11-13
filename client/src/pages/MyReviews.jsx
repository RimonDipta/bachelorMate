import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, House, Users, Check, Clock } from "lucide-react";
import { api } from "../lib/api";
import { Avatar, Badge, Button, Card, EmptyState, LoadingBlock, PageHeader, Tabs } from "../components/ui";
import { HomeReviewModal, RoommateReviewModal } from "../components/ReviewForms";
import { HOME_TYPES, initials } from "../lib/format";

export default function MyReviews() {
  const [tab, setTab] = useState("homes");
  const [homeModal, setHomeModal] = useState(null);
  const [personModal, setPersonModal] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["reviews", "eligible"], queryFn: () => api.get("/reviews/eligible") });
  const homes = data?.homes || [];
  const people = data?.people || [];

  return (
    <main className="content content-narrow">
      <PageHeader title="Reviews" description="Rate the homes you've lived in and the people you've lived with — including past homes." />
      <Tabs value={tab} onChange={setTab} items={[{ value: "homes", label: "Homes", icon: House }, { value: "people", label: "Roommates", icon: Users, count: people.filter((p) => !p.reviewed).length }]} />
      <Card>
        {isLoading ? <LoadingBlock rows={3} /> : tab === "homes" ? (
          !homes.length ? <EmptyState icon={House} title="No homes yet" description="Homes you join appear here so you can review them." /> : (
            <div className="list">
              {homes.map((h) => (
                <div key={h.home._id} className="list-item">
                  <div className="home-mark" style={{ width: 36, height: 36, fontSize: 12 }}>{initials(h.home.name)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong text-sm truncate">{h.home.name}</div>
                    <div className="text-xs muted">{HOME_TYPES[h.home.type] || "Home"} · {h.status === "active" ? "you live here" : "former home"} · {h.daysStayed} day{h.daysStayed === 1 ? "" : "s"}</div>
                  </div>
                  {h.reviewed ? <Badge tone="success" icon={Check}>Reviewed</Badge> : null}
                  {h.eligible ? (
                    <Button size="sm" variant={h.reviewed ? "ghost" : "primary"} icon={Star} onClick={() => setHomeModal(h)}>{h.reviewed ? "Edit" : "Review"}</Button>
                  ) : (
                    <Badge icon={Clock}>After {data.minStayDays} days</Badge>
                  )}
                </div>
              ))}
            </div>
          )
        ) : !people.length ? (
          <EmptyState icon={Users} title="No roommates to review yet" description={`Once you've lived with someone for ${data.minStayDays} days, you can review each other.`} />
        ) : (
          <div className="list">
            {people.map((p) => (
              <div key={`${p.user._id}:${p.home._id}`} className="list-item">
                <Avatar user={p.user} size={36} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <Link to={`/people/${p.user._id}`} className="strong text-sm" style={{ color: "var(--text)" }}>{p.user.name}</Link>
                  <div className="text-xs muted">{p.home.name} · {p.daysTogether} day{p.daysTogether === 1 ? "" : "s"} together</div>
                </div>
                {p.reviewed && <Badge tone="success" icon={Check}>Reviewed</Badge>}
                <Button size="sm" variant={p.reviewed ? "ghost" : "primary"} icon={Star} onClick={() => setPersonModal(p)}>{p.reviewed ? "Update" : "Review"}</Button>
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
