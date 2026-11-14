import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate, Link } from "react-router-dom";
import ErrorBoundary from "../ErrorBoundary";
import NetworkStatus from "../NetworkStatus";
import InstallAppDialog from "../InstallApp";
import { FeedbackDialog } from "../FeedbackDialog";
import { useInstallPrompt } from "../../lib/pwa";
import BrandMark from "../BrandMark";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, UtensilsCrossed, CalendarDays, ClipboardList, Wallet, Receipt, ArrowLeftRight, MessagesSquare,
  Megaphone, ShoppingBasket, Users, UserPlus, BarChart3, History, Settings, Bell, Menu as MenuIcon, ChevronsUpDown, ChevronDown,
  Plus, LogIn, House, UserRound, Palette, LogOut, Moon, Sun, MessageCircle, Mail, Check, CircleUserRound, Repeat, X, DoorOpen, Star, Search, Smartphone, MessageSquareHeart,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Avatar, Button, Menu, MenuItem, PageSkeleton } from "../ui";
import { initials, num } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

function useHomes() {
  return useQuery({ queryKey: ["homes"], queryFn: () => api.get("/homes") });
}

function HomeSwitcher({ homes, current, onNavigate }) {
  const navigate = useNavigate();
  const t = useT();
  const active = homes.filter((h) => h.myMembership?.status === "active");
  return (
    <Menu
      align="start"
      width={232}
      trigger={
        <button className="nav-link" style={{ border: "1px solid var(--border)", background: "var(--surface)", width: "100%", cursor: "pointer", padding: "6px 8px" }} aria-label={t("shell.switchHome", { name: current?.name || t("shell.chooseHome") })}>
          <span aria-hidden="true" className="home-mark" style={{ width: 26, height: 26, borderRadius: 7, fontSize: 11 }}>{current ? <span className="initials" data-initials={initials(current.name)} /> : <House size={14} />}</span>
          <span className="grow truncate" style={{ textAlign: "left", color: "var(--text)" }}>{current?.name || t("shell.chooseHome")}</span>
          <ChevronsUpDown size={14} />
        </button>
      }
    >
      <div className="menu-label">{t("shell.yourHomes")}</div>
      {active.length === 0 && <div className="menu-item subtle" style={{ cursor: "default" }}>{t("shell.noHomes")}</div>}
      {active.map((h) => (
        <MenuItem key={h._id} onClick={() => { navigate(`/h/${h._id}`); onNavigate?.(); }}>
          <span aria-hidden="true" className="home-mark" style={{ width: 22, height: 22, borderRadius: 6, fontSize: 10 }}><span className="initials" data-initials={initials(h.name)} /></span>
          <span className="grow truncate">{h.name}</span>
          {current?._id === h._id && <Check size={14} />}
        </MenuItem>
      ))}
      <div className="menu-sep" />
      <MenuItem icon={House} onClick={() => { navigate("/homes"); onNavigate?.(); }}>{t("shell.allHomes")}</MenuItem>
      <MenuItem icon={Plus} onClick={() => { navigate("/onboarding"); onNavigate?.(); }}>{t("shell.createHome")}</MenuItem>
      <MenuItem icon={LogIn} onClick={() => { navigate("/join"); onNavigate?.(); }}>{t("shell.joinCode")}</MenuItem>
    </Menu>
  );
}

/** Account menu (profile, settings, personal pages, sign out), shown at the top of the sidebar and in the topbar. */
function AccountMenu({ user, trigger, align = "start", counts = {} }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const t = useT();
  const dark = theme.resolved === "dark";
  const app = useInstallPrompt();
  const [installOpen, setInstallOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <>
    <Menu align={align} width={248} trigger={trigger}>
      <div className="row-3" style={{ padding: "8px 10px 10px" }}>
        <Avatar user={user} size={34} />
        <div style={{ minWidth: 0 }}>
          <div className="strong text-sm truncate">{user.name}</div>
          <div className="text-xs muted truncate">{user.email}</div>
        </div>
      </div>
      <div className="menu-sep" />
      <MenuItem icon={UserRound} onClick={() => navigate(`/people/${user._id}`)}>{t("shell.myProfile")}</MenuItem>
      <MenuItem icon={MessageCircle} onClick={() => navigate("/messages")}>{t("nav.messages")} {counts.dm > 0 && <span className="count" style={{ marginLeft: "auto" }}>{counts.dm}</span>}</MenuItem>
      <MenuItem icon={Users} onClick={() => navigate("/friends")}>{t("nav.friends")}</MenuItem>
      {counts.invites > 0 && <MenuItem icon={Mail} onClick={() => navigate("/invitations")}>{t("nav.invitations")} <span className="count" style={{ marginLeft: "auto" }}>{counts.invites}</span></MenuItem>}
      <MenuItem icon={House} onClick={() => navigate("/homes")}>{t("shell.allHomes")}</MenuItem>
      <MenuItem icon={Star} onClick={() => navigate("/reviews")}>{t("shell.myReviews")}</MenuItem>
      <MenuItem icon={Search} onClick={() => navigate("/seats")}>{t("shell.findSeat")}</MenuItem>
      <div className="menu-sep" />
      <MenuItem icon={Palette} onClick={() => navigate("/settings/appearance")}>{t("shell.appearanceLanguage")}</MenuItem>
      <MenuItem icon={dark ? Sun : Moon} onClick={() => theme.update({ mode: dark ? "light" : "dark" })}>{dark ? t("shell.lightMode") : t("shell.darkMode")}</MenuItem>
      <MenuItem icon={Settings} onClick={() => navigate("/settings/security")}>{t("shell.accountSettings")}</MenuItem>
      {app.canInstall && <MenuItem icon={Smartphone} onClick={() => setInstallOpen(true)}>{t("shell.installApp")}</MenuItem>}
      <MenuItem icon={MessageSquareHeart} onClick={() => setFeedbackOpen(true)}>{t("feedback.menu")}</MenuItem>
      <div className="menu-sep" />
      <MenuItem icon={LogOut} danger onClick={async () => { await logout(); navigate("/login"); }}>{t("shell.signOut")}</MenuItem>
    </Menu>
    <InstallAppDialog open={installOpen} onClose={() => setInstallOpen(false)} />
    <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

function NavItem({ to, icon: Icon, children, end, count }) {
  return (
    <NavLink to={to} end={end} className="nav-link">
      <Icon aria-hidden />
      <span className="truncate">{children}</span>
      {count > 0 && <span className="count">{count > 99 ? "99+" : num(count)}</span>}
    </NavLink>
  );
}

/** A collapsible group of less-used links. Remembers whether it's open; always open while you're on one of its pages. */
function NavGroup({ id, label, paths, children }) {
  const location = useLocation();
  const key = `bm.nav.${id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === "1"; } catch { return false; } });
  const inside = paths.some((p) => location.pathname.startsWith(p));
  const shown = open || inside;
  const toggle = () => {
    const v = !shown;
    setOpen(v);
    try { localStorage.setItem(key, v ? "1" : "0"); } catch { /* storage unavailable */ }
  };
  return (
    <>
      <button type="button" className="nav-section nav-toggle" aria-expanded={shown} onClick={toggle} disabled={inside && shown}>
        <span>{label}</span>
        <ChevronDown size={12} className="nav-toggle-icon" aria-hidden />
      </button>
      {shown && children}
    </>
  );
}

export default function AppShell() {
  const { user } = useAuth();
  const theme = useTheme();
  const t = useT();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const match = useMatch("/h/:homeId/*");
  const homeId = match?.params.homeId;
  const { data: homesData } = useHomes();
  const homes = homesData?.homes || [];
  const { data: homeData } = useQuery({ queryKey: ["home", homeId], queryFn: () => api.get(`/homes/${homeId}`), enabled: Boolean(homeId), retry: false });
  const home = homeId ? homeData?.home || homes.find((h) => h._id === homeId) : null;
  const perms = new Set(home?.permissions || []);
  const can = (...p) => p.some((x) => perms.has(x));

  const { data: notif } = useQuery({ queryKey: ["notifications", "count"], queryFn: () => api.get("/notifications/unread-count"), refetchInterval: 60_000 });
  const { data: convs } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get("/chat/conversations"), refetchInterval: 90_000 });
  const { data: invites } = useQuery({ queryKey: ["invitations", "mine"], queryFn: () => api.get("/invitations/mine") });
  const { data: dash } = useQuery({ queryKey: ["dashboard", homeId], queryFn: () => api.get(`/homes/${homeId}/dashboard`), enabled: Boolean(homeId && homeData) });


  const unreadFor = (pred) => (convs?.conversations || []).filter(pred).reduce((a, c) => a + c.unread, 0);
  const homeChatUnread = unreadFor((c) => c.kind === "home" && c.home?._id === homeId);
  const dmUnread = unreadFor((c) => c.kind === "direct");
  const pendingRequests = (dash?.pendingReview || 0);
  const base = `/h/${homeId}`;

  const counts = { dm: dmUnread, invites: invites?.invitations?.length || 0 };

  const sidebar = (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label={t("shell.mainNav")} onClick={(e) => e.target.closest("a, .menu-item") && setOpen(false)}>
      {/* Top: account (with sign out) + home switcher — always visible */}
      <div className="sidebar-top">
        <div className="row" style={{ gap: 6 }}>
          <AccountMenu
            user={user}
            counts={counts}
            trigger={
              <button className="sidebar-account" aria-label={t("shell.accountMenuFor", { name: user.name })}>
                <Avatar user={user} size={28} />
                <span className="grow truncate" style={{ textAlign: "left" }}>
                  <span className="strong text-sm truncate" style={{ display: "block", color: "var(--text)" }}>{user.name}</span>
                </span>
                <ChevronsUpDown size={14} className="subtle" />
              </button>
            }
          />
          <Button variant="ghost" size="sm" icon={X} className="show-sm" onClick={() => setOpen(false)} aria-label={t("shell.closeMenu")} />
        </div>
        <HomeSwitcher homes={homes} current={home} onNavigate={() => setOpen(false)} />
      </div>

      {/* Middle: navigation scrolls on its own */}
      <nav className="sidebar-scroll" aria-label={t("shell.homeNav")}>
        {home ? (
          <>
            <NavItem to={base} end icon={LayoutDashboard}>{t("nav.overview")}</NavItem>
            <NavItem to={`${base}/meals`} icon={UtensilsCrossed}>{t("nav.meals")}</NavItem>
            <NavItem to={`${base}/requests`} icon={ClipboardList} count={pendingRequests}>{t("nav.requests")}</NavItem>
            <NavItem to={`${base}/chat`} icon={MessagesSquare} count={homeChatUnread}>{t("nav.homeChat")}</NavItem>
            <NavItem to={`${base}/calendar`} icon={CalendarDays}>{t("nav.calendar")}</NavItem>

            <div className="nav-section">{t("nav.money")}</div>
            <NavItem to={`${base}/finance`} end icon={Wallet}>{t("nav.finance")}</NavItem>
            <NavItem to={`${base}/finance/me`} icon={CircleUserRound}>{t("nav.myAccount")}</NavItem>
            {can("expenses.view", "expenses.manage", "expenses.meal") && <NavItem to={`${base}/finance/expenses`} icon={Receipt}>{t("nav.expenses")}</NavItem>}
            {can("expenses.view", "expenses.manage", "finance.view_all") && <NavItem to={`${base}/finance/recurring`} icon={Repeat}>{t("nav.recurring")}</NavItem>}
            <NavItem to={`${base}/finance/transactions`} icon={ArrowLeftRight} count={dash?.pendingPayments}>{t("nav.transactions")}</NavItem>

            <div className="nav-section">{t("nav.house")}</div>
            <NavItem to={`${base}/announcements`} icon={Megaphone}>{t("nav.announcements")}</NavItem>
            <NavItem to={`${base}/grocery`} icon={ShoppingBasket}>{t("nav.grocery")}</NavItem>
            {can("members.view") && <NavItem to={`${base}/members`} icon={Users} count={dash?.pendingJoins}>{t("nav.members")}</NavItem>}
            {(can("invites.manage") || home.settings?.allowMemberInvites) && <NavItem to={`${base}/invites`} icon={UserPlus}>{t("nav.invitations")}</NavItem>}
            <NavItem to={`${base}/settings`} icon={Settings}>{t("nav.homeSettings")}</NavItem>

            <NavGroup id="More" label={t("nav.more")} paths={["listings", "reviews", "reports", "activity"].map((p) => `${base}/${p}`)}>
              <NavItem to={`${base}/listings`} icon={DoorOpen}>{t("nav.listings")}</NavItem>
              <NavItem to={`${base}/reviews`} icon={Star}>{t("nav.reviews")}</NavItem>
              {can("reports.view") && <NavItem to={`${base}/reports`} icon={BarChart3}>{t("nav.reports")}</NavItem>}
              {can("activity.view") && <NavItem to={`${base}/activity`} icon={History}>{t("nav.activity")}</NavItem>}
            </NavGroup>
          </>
        ) : (
          <>
            <NavItem to="/homes" icon={House}>{t("nav.homes")}</NavItem>
            <NavItem to="/friends" icon={UserRound}>{t("nav.friends")}</NavItem>
            <NavItem to="/messages" icon={MessageCircle} count={dmUnread}>{t("nav.messages")}</NavItem>
            <NavItem to="/notifications" icon={Bell} count={notif?.unread}>{t("nav.notifications")}</NavItem>
            {counts.invites > 0 && <NavItem to="/invitations" icon={Mail} count={counts.invites}>{t("nav.invitations")}</NavItem>}
          </>
        )}
      </nav>

      {/* Bottom: personal shortcuts, always visible */}
      <div className="sidebar-bottom">
        <Link to="/" className="sidebar-brand-mini" aria-label="BachelorMate" title="BachelorMate"><BrandMark size={26} /></Link>
        <div className="row" style={{ gap: 2, marginLeft: "auto" }}>
          {[["/messages", MessageCircle, t("nav.messages"), dmUnread], ["/friends", UserRound, t("nav.friends"), 0], ["/notifications", Bell, t("nav.notifications"), notif?.unread]].map(([to, I, label, n]) => (
            <NavLink key={to} to={to} className="sidebar-iconlink" aria-label={n ? t("shell.withCount", { label, n }) : label} title={label}>
              <I />
              {n > 0 && <span className="count">{n > 9 ? "9+" : num(n)}</span>}
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="shell">
      {sidebar}
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon={MenuIcon} className="show-sm" onClick={() => setOpen(true)} aria-label={t("shell.openMenu")} />
          <div className="grow truncate strong text-sm">{home?.name || ""}</div>
          <Button
            variant="ghost"
            icon={theme.resolved === "dark" ? Sun : Moon}
            aria-label={t("shell.toggleDark")}
            title={t("shell.toggleDark")}
            onClick={() => theme.update({ mode: theme.resolved === "dark" ? "light" : "dark" })}
          />
          <Link to="/notifications" className="btn btn-ghost btn-icon" aria-label={notif?.unread ? t("shell.notificationsUnread", { n: notif.unread }) : t("nav.notifications")} style={{ position: "relative" }}>
            <Bell />
            {notif?.unread > 0 && <span className="count" style={{ position: "absolute", top: 2, right: 0, transform: "scale(.85)" }}>{notif.unread > 9 ? "9+" : num(notif.unread)}</span>}
          </Link>
          <AccountMenu user={user} counts={counts} align="end" trigger={<button className="btn btn-ghost btn-icon" style={{ padding: 0 }} aria-label={t("shell.accountMenu")}><Avatar user={user} size={30} /></button>} />
        </header>
        <NetworkStatus />
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<main className="content"><PageSkeleton /></main>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>

      <nav className="mobile-nav" aria-label={t("shell.quickNav")}>
        {home ? (
          <>
            <NavLink to={base} end><LayoutDashboard />{t("mobileNav.home")}</NavLink>
            <NavLink to={`${base}/meals`}><UtensilsCrossed />{t("nav.meals")}</NavLink>
            <NavLink to={`${base}/finance`}><Wallet />{t("mobileNav.money")}</NavLink>
            <NavLink to={`${base}/chat`}><MessagesSquare />{t("mobileNav.chat")}</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/homes"><House />{t("nav.homes")}</NavLink>
            <NavLink to="/friends"><UserRound />{t("nav.friends")}</NavLink>
            <NavLink to="/messages"><MessageCircle />{t("nav.messages")}</NavLink>
            <NavLink to="/notifications"><Bell />{t("mobileNav.alerts")}</NavLink>
          </>
        )}
        <a href="#menu" onClick={(e) => { e.preventDefault(); setOpen(true); }}><MenuIcon />{t("nav.more")}</a>
      </nav>
    </div>
  );
}
