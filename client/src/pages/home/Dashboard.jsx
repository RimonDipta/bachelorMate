import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet, CalendarRange, Users, Utensils, Plus, HandCoins, MoonStar, ClipboardList, Megaphone, CalendarDays, History,
  ArrowRight, Inbox, UserPlus, AlertCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { Avatar, Badge, Card, EmptyState, ErrorState, Money, PageSkeleton, Stat } from "../../components/ui";
import { fmtDay, fmtDayLong, money, timeAgo } from "../../lib/format";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const KIND_ICON = { event: CalendarDays, payment: HandCoins, departure: Users, meal: Utensils, absence: MoonStar, announcement: Megaphone };

export default function Dashboard() {
  const { home, homeId, can, currency } = useHome();
  const { user } = useAuth();
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", homeId], queryFn: () => api.get(`/homes/${homeId}/dashboard`) });
  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;

  const base = `/h/${homeId}`;
  const bal = d.finance.myBalance;
  const types = d.meals.mealTypes.filter((t) => t.enabled);
  const totalToday = types.reduce((a, t) => a + (d.meals.totals[t.key] || 0), 0);
  const guestsToday = types.reduce((a, t) => a + (d.meals.guests[t.key] || 0), 0);
  const pendingTotal = d.pendingReview + d.pendingJoins + d.pendingPayments;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{greeting()}, {user.name.split(" ")[0]}</h1>
          <p>{fmtDayLong(d.today)} · {home.name}</p>
        </div>
        <div className="row wrap">
          <Link to={`${base}/requests?new=meal_off`} className="btn btn-secondary"><MoonStar size={16} /> Meal off</Link>
          <Link to={`${base}/finance/me?pay=1`} className="btn btn-secondary"><HandCoins size={16} /> {can("finance.record") ? "Record payment" : "Submit payment"}</Link>
          {can("expenses.manage", "expenses.meal") && <Link to={`${base}/finance/expenses?new=1`} className="btn btn-primary"><Plus size={16} /> Add expense</Link>}
        </div>
      </div>

      {!home.onboardingCompleted && can("home.manage") && d.memberCount === 1 && (
        <div className="card card-pad row-3 wrap">
          <div className="feature-icon" style={{ margin: 0 }}><UserPlus /></div>
          <div className="grow"><div className="strong">Invite your roommates</div><div className="text-sm muted">Share your home code or an invitation link to get started.</div></div>
          <Link to={`${base}/invites`} className="btn btn-primary">Invite members</Link>
        </div>
      )}

      <div className="grid-4">
        <Stat icon={Wallet} label="You need to pay" value={<Link to={`${base}/finance/me`} style={{ color: "inherit" }}>{money(d.finance.myPayable ?? Math.max(0, -bal), currency)}</Link>} hint={bal > 0 ? `${money(bal, currency)} advance credit` : bal < 0 ? "Your share + any dues" : "All settled"} />
        <Stat icon={CalendarRange} label="Spent this month" value={money(d.month.total, currency)} hint={`${money(d.month.meal, currency)} on meals`} />
        <Stat icon={Utensils} label={`Meal rate · ${d.mealPeriod.name}`} value={money(d.mealPeriod.rate, currency)} hint={`${d.mealPeriod.chargeableMeals} meals so far`} />
        <Stat icon={Users} label="Members" value={d.memberCount} hint={d.pendingJoins ? `${d.pendingJoins} waiting for approval` : "Active in this home"} />
      </div>

      <div className="bento">
        <Card className="span-5" title="Today's meals" actions={<Link to={`${base}/meals/daily`} className="btn btn-ghost btn-sm">Daily list <ArrowRight size={14} /></Link>}>
          <div className="card-body stack">
            <div className="row between">
              <div>
                <div className="stat-value">{totalToday}</div>
                <div className="text-xs muted">meals{guestsToday ? ` + ${guestsToday} guest` : ""} planned</div>
              </div>
              {d.meals.mine ? (
                <Badge tone="accent">You: {types.map((t) => d.meals.mine.counts[t.key] || 0).join(" · ")}</Badge>
              ) : (
                <Badge>No entry for you</Badge>
              )}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {types.map((t) => {
                const n = d.meals.totals[t.key] || 0;
                const g = d.meals.guests[t.key] || 0;
                return (
                  <div key={t.key} className="col" style={{ gap: 4 }}>
                    <div className="row between text-sm"><span>{t.label}</span><span className="num muted">{n}{g ? ` + ${g} guest` : ""}</span></div>
                    <div className="bar-track"><span style={{ width: `${d.memberCount ? Math.min(100, ((n + g) / d.memberCount) * 100) : 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="span-7" title={`Meal account · ${d.mealPeriod.name}`} actions={<Link to={d.mealPeriod._id ? `${base}/meals/periods/${d.mealPeriod._id}` : `${base}/meals`} className="btn btn-ghost btn-sm">Details <ArrowRight size={14} /></Link>}>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 20 }}>
              <div className="col"><span className="text-xs muted">Meal expenses</span><span className="strong num text-lg">{money(d.mealPeriod.totalExpense, currency)}</span></div>
              <div className="col"><span className="text-xs muted">Total meals</span><span className="strong num text-lg">{d.mealPeriod.chargeableMeals}</span></div>
              <div className="col"><span className="text-xs muted">Your meals</span><span className="strong num text-lg">{d.mealPeriod.myMeals}</span></div>
              <div className="col"><span className="text-xs muted">Your estimated cost</span><span className="strong num text-lg">{money(d.mealPeriod.myEstimatedCharge, currency)}</span></div>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>{fmtDay(d.mealPeriod.startDay)} – {fmtDay(d.mealPeriod.endDay)} · Estimates update as meals and bazar are recorded. Charges post when the period is closed.</p>
          </div>
        </Card>

        <Card className="span-4" title="Needs attention">
          {pendingTotal + d.myPending === 0 ? (
            <EmptyState compact icon={Inbox} title="All clear" description="Nothing waiting on you." />
          ) : (
            <div className="list">
              {d.pendingReview > 0 && <Link className="list-item" to={`${base}/requests?tab=review`}><ClipboardList size={16} className="subtle" /><span className="grow text-sm">Requests to review</span><span className="count">{d.pendingReview}</span></Link>}
              {d.pendingJoins > 0 && <Link className="list-item" to={`${base}/members?tab=pending`}><UserPlus size={16} className="subtle" /><span className="grow text-sm">Join requests</span><span className="count">{d.pendingJoins}</span></Link>}
              {d.pendingPayments > 0 && <Link className="list-item" to={`${base}/finance/transactions?status=pending`}><HandCoins size={16} className="subtle" /><span className="grow text-sm">Payments to confirm</span><span className="count">{d.pendingPayments}</span></Link>}
              {d.myPending > 0 && <Link className="list-item" to={`${base}/requests`}><AlertCircle size={16} className="subtle" /><span className="grow text-sm">Your pending requests</span><Badge tone="warning">{d.myPending}</Badge></Link>}
            </div>
          )}
        </Card>

        <Card className="span-4" title="Announcements" actions={<Link to={`${base}/announcements`} className="btn btn-ghost btn-sm">All</Link>}>
          {d.announcements.length === 0 ? (
            <EmptyState compact icon={Megaphone} title="No announcements" />
          ) : (
            <div className="list">
              {d.announcements.map((a) => (
                <Link key={a._id} to={`${base}/announcements`} className="list-item" style={{ alignItems: "flex-start" }}>
                  <Avatar user={a.author} size={26} />
                  <div className="grow">
                    <div className="row text-sm strong">{a.important && <Badge tone="danger">Important</Badge>}<span className="truncate">{a.title}</span></div>
                    <div className="text-xs muted">{timeAgo(a.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="span-4" title="Coming up" actions={<Link to={`${base}/calendar`} className="btn btn-ghost btn-sm">Calendar</Link>}>
          {d.upcoming.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="Nothing scheduled" description="The next two weeks are clear." />
          ) : (
            <div className="list">
              {d.upcoming.map((e) => {
                const I = KIND_ICON[e.kind] || CalendarDays;
                return (
                  <div key={e.id} className="list-item">
                    <I size={16} className="subtle" />
                    <span className="grow text-sm truncate">{e.title}</span>
                    <span className="text-xs muted">{fmtDay(e.startDay)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {can("activity.view") && (
          <Card className="span-12" title="Recent activity" actions={<Link to={`${base}/activity`} className="btn btn-ghost btn-sm">Activity log</Link>}>
            {d.activity.length === 0 ? (
              <EmptyState compact icon={History} title="No activity yet" />
            ) : (
              <div className="list">
                {d.activity.map((a) => (
                  <div key={a._id} className="list-item">
                    <Avatar user={a.actor} size={24} />
                    <span className="grow text-sm truncate">{a.summary}</span>
                    <span className="text-xs subtle">{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
