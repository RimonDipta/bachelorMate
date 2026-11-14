import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet, CalendarRange, Users, Utensils, Plus, HandCoins, MoonStar, ClipboardList, Megaphone, CalendarDays, History,
  ArrowRight, Inbox, UserPlus, AlertCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/I18nProvider";
import { Avatar, Badge, Card, EmptyState, ErrorState, PageSkeleton, Stat } from "../../components/ui";
import { fmtDay, fmtDayLong, mealTypeLabel, money, num, timeAgo } from "../../lib/format";
import SetupChecklist from "../../components/SetupChecklist";

const greetingKey = () => {
  const h = new Date().getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};

const KIND_ICON = { event: CalendarDays, payment: HandCoins, departure: Users, meal: Utensils, absence: MoonStar, announcement: Megaphone };

export default function Dashboard() {
  const { home, homeId, can, currency } = useHome();
  const { user } = useAuth();
  const t = useT();
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", homeId], queryFn: () => api.get(`/homes/${homeId}/dashboard`) });
  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;

  const base = `/h/${homeId}`;
  const bal = d.finance.myBalance;
  const types = d.meals.mealTypes.filter((mt) => mt.enabled);
  const totalToday = types.reduce((a, mt) => a + (d.meals.totals[mt.key] || 0), 0);
  const guestsToday = types.reduce((a, mt) => a + (d.meals.guests[mt.key] || 0), 0);
  const pendingTotal = d.pendingReview + d.pendingJoins + d.pendingPayments;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{t(`dashboard.greeting.${greetingKey()}`, { name: user.name.split(" ")[0] })}</h1>
          <p>{fmtDayLong(d.today)} · {home.name}</p>
        </div>
        <div className="row wrap quick-actions">
          <Link to={`${base}/requests?new=meal_off`} className="btn btn-secondary"><MoonStar size={16} /> {t("common.mealOff")}</Link>
          <Link to={`${base}/finance/me?pay=1`} className="btn btn-secondary"><HandCoins size={16} /> {can("finance.record") ? t("common.recordPayment") : t("common.submitPayment")}</Link>
          {can("expenses.manage", "expenses.meal") && <Link to={`${base}/finance/expenses?new=1`} className="btn btn-primary"><Plus size={16} /> {t("common.addExpense")}</Link>}
        </div>
      </div>

      {d.setup && <SetupChecklist homeId={homeId} setup={d.setup} can={can} />}

      <div className="grid-4">
        <Stat icon={Wallet} label={t("common.youNeedToPay")} value={<Link to={`${base}/finance/me`} style={{ color: "inherit" }}>{money(d.finance.myPayable ?? Math.max(0, -bal), currency)}</Link>} hint={bal > 0 ? t("dashboard.advanceCredit", { amount: money(bal, currency) }) : bal < 0 ? t("dashboard.shareAndDues") : t("common.allSettled")} />
        <Stat icon={CalendarRange} label={t("dashboard.spentThisMonth")} value={money(d.month.total, currency)} hint={t("dashboard.onMeals", { amount: money(d.month.meal, currency) })} />
        <Stat icon={Utensils} label={t("dashboard.mealRateIn", { period: d.mealPeriod.name })} value={money(d.mealPeriod.rate, currency)} hint={t("dashboard.mealsSoFar", { count: d.mealPeriod.chargeableMeals })} />
        <Stat icon={Users} label={t("nav.members")} value={d.memberCount} hint={d.pendingJoins ? t("dashboard.waitingApproval", { count: d.pendingJoins }) : t("dashboard.activeInHome")} />
      </div>

      <div className="bento">
        <Card className="span-5" title={t("dashboard.todaysMeals")} actions={<Link to={`${base}/meals/daily`} className="btn btn-ghost btn-sm">{t("dashboard.dailyList")} <ArrowRight size={14} /></Link>}>
          <div className="card-body stack">
            <div className="row between">
              <div>
                <div className="stat-value">{num(totalToday)}</div>
                <div className="text-xs muted">{guestsToday ? t("dashboard.mealsPlannedGuests", { count: guestsToday }) : t("dashboard.mealsPlanned")}</div>
              </div>
              {d.meals.mine ? (
                <Badge tone="accent">{t("dashboard.you", { counts: types.map((mt) => num(d.meals.mine.counts[mt.key] || 0)).join(" · ") })}</Badge>
              ) : (
                <Badge>{t("dashboard.noEntryForYou")}</Badge>
              )}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {types.map((mt) => {
                const n = d.meals.totals[mt.key] || 0;
                const g = d.meals.guests[mt.key] || 0;
                return (
                  <div key={mt.key} className="col" style={{ gap: 4 }}>
                    <div className="row between text-sm"><span>{mealTypeLabel(mt)}</span><span className="num muted">{g ? t("dashboard.plusGuests", { n, g }) : num(n)}</span></div>
                    <div className="bar-track"><span style={{ width: `${d.memberCount ? Math.min(100, ((n + g) / d.memberCount) * 100) : 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="span-7" title={t("dashboard.mealAccount", { period: d.mealPeriod.name })} actions={<Link to={d.mealPeriod._id ? `${base}/meals/periods/${d.mealPeriod._id}` : `${base}/meals`} className="btn btn-ghost btn-sm">{t("common.details")} <ArrowRight size={14} /></Link>}>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 20 }}>
              <div className="col"><span className="text-xs muted">{t("meals.mealExpenses")}</span><span className="strong num text-lg">{money(d.mealPeriod.totalExpense, currency)}</span></div>
              <div className="col"><span className="text-xs muted">{t("meals.totalMeals")}</span><span className="strong num text-lg">{num(d.mealPeriod.chargeableMeals)}</span></div>
              <div className="col"><span className="text-xs muted">{t("meals.yourMeals")}</span><span className="strong num text-lg">{num(d.mealPeriod.myMeals)}</span></div>
              <div className="col"><span className="text-xs muted">{t("dashboard.estimatedCost")}</span><span className="strong num text-lg">{money(d.mealPeriod.myEstimatedCharge, currency)}</span></div>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>{fmtDay(d.mealPeriod.startDay)} – {fmtDay(d.mealPeriod.endDay)} · {t("dashboard.estimateHint")}</p>
          </div>
        </Card>

        <Card className="span-4" title={t("dashboard.needsAttention")}>
          {pendingTotal + d.myPending === 0 ? (
            <EmptyState compact icon={Inbox} title={t("dashboard.allClear")} description={t("dashboard.nothingWaiting")} />
          ) : (
            <div className="list">
              {d.pendingReview > 0 && <Link className="list-item" to={`${base}/requests?tab=review`}><ClipboardList size={16} className="subtle" /><span className="grow text-sm">{t("dashboard.requestsToReview")}</span><span className="count">{num(d.pendingReview)}</span></Link>}
              {d.pendingJoins > 0 && <Link className="list-item" to={`${base}/members?tab=pending`}><UserPlus size={16} className="subtle" /><span className="grow text-sm">{t("dashboard.joinRequests")}</span><span className="count">{num(d.pendingJoins)}</span></Link>}
              {d.pendingPayments > 0 && <Link className="list-item" to={`${base}/finance/transactions?status=pending`}><HandCoins size={16} className="subtle" /><span className="grow text-sm">{t("dashboard.paymentsToConfirm")}</span><span className="count">{num(d.pendingPayments)}</span></Link>}
              {d.myPending > 0 && <Link className="list-item" to={`${base}/requests`}><AlertCircle size={16} className="subtle" /><span className="grow text-sm">{t("dashboard.yourPending")}</span><Badge tone="warning">{num(d.myPending)}</Badge></Link>}
            </div>
          )}
        </Card>

        <Card className="span-4" title={t("nav.announcements")} actions={<Link to={`${base}/announcements`} className="btn btn-ghost btn-sm">{t("common.all")}</Link>}>
          {d.announcements.length === 0 ? (
            <EmptyState compact icon={Megaphone} title={t("dashboard.noAnnouncements")} />
          ) : (
            <div className="list">
              {d.announcements.map((a) => (
                <Link key={a._id} to={`${base}/announcements`} className="list-item" style={{ alignItems: "flex-start" }}>
                  <Avatar user={a.author} size={26} />
                  <div className="grow">
                    <div className="row text-sm strong">{a.important && <Badge tone="danger">{t("dashboard.important")}</Badge>}<span className="truncate">{a.title}</span></div>
                    <div className="text-xs muted">{timeAgo(a.createdAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="span-4" title={t("dashboard.comingUp")} actions={<Link to={`${base}/calendar`} className="btn btn-ghost btn-sm">{t("nav.calendar")}</Link>}>
          {d.upcoming.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title={t("dashboard.nothingScheduled")} description={t("dashboard.twoWeeksClear")} />
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
          <Card className="span-12" title={t("dashboard.recentActivity")} actions={<Link to={`${base}/activity`} className="btn btn-ghost btn-sm">{t("nav.activity")}</Link>}>
            {d.activity.length === 0 ? (
              <EmptyState compact icon={History} title={t("dashboard.noActivity")} />
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
