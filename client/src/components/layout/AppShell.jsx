import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate, Link } from "react-router-dom";
import ErrorBoundary from "../ErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, UtensilsCrossed, CalendarDays, ClipboardList, Wallet, Receipt, ArrowLeftRight, MessagesSquare,
  Megaphone, ShoppingBasket, Users, UserPlus, BarChart3, History, Settings, Bell, Menu as MenuIcon, ChevronsUpDown,
  Plus, LogIn, House, UserRound, Palette, LogOut, Moon, Sun, MessageCircle, Mail, Check, CircleUserRound, Soup,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Avatar, Button, Menu, MenuItem, PageSkeleton } from "../ui";
import { initials } from "../../lib/format";

function useHomes() {
  return useQuery({ queryKey: ["homes"], queryFn: () => api.get("/homes") });
}

function HomeSwitcher({ homes, current, onNavigate }) {
  const navigate = useNavigate();
  const active = homes.filter((h) => h.myMembership?.status === "active");
  return (
    <Menu
      align="start"
      width={232}
      trigger={
        <button className="nav-link" style={{ border: "1px solid var(--border)", background: "var(--surface)", width: "100%", cursor: "pointer", padding: "6px 8px" }} aria-label="Switch home">
          <span className="home-mark" style={{ width: 26, height: 26, borderRadius: 7, fontSize: 11 }}>{current ? initials(current.name) : <House size={14} />}</span>
          <span className="grow truncate" style={{ textAlign: "left", color: "var(--text)" }}>{current?.name || "Choose a home"}</span>
          <ChevronsUpDown size={14} />
        </button>
      }
    >
      <div className="menu-label">Your homes</div>
      {active.length === 0 && <div className="menu-item subtle" style={{ cursor: "default" }}>No homes yet</div>}
      {active.map((h) => (
        <MenuItem key={h._id} onClick={() => { navigate(`/h/${h._id}`); onNavigate?.(); }}>
          <span className="home-mark" style={{ width: 22, height: 22, borderRadius: 6, fontSize: 10 }}>{initials(h.name)}</span>
          <span className="grow truncate">{h.name}</span>
          {current?._id === h._id && <Check size={14} />}
        </MenuItem>
      ))}
      <div className="menu-sep" />
      <MenuItem icon={House} onClick={() => { navigate("/homes"); onNavigate?.(); }}>All homes</MenuItem>
      <MenuItem icon={Plus} onClick={() => { navigate("/onboarding"); onNavigate?.(); }}>Create a home</MenuItem>
      <MenuItem icon={LogIn} onClick={() => { navigate("/join"); onNavigate?.(); }}>Join with a code</MenuItem>
    </Menu>
  );
}

function NavItem({ to, icon: Icon, children, end, count }) {
  return (
    <NavLink to={to} end={end} className="nav-link">
      <Icon aria-hidden />
      <span className="truncate">{children}</span>
      {count > 0 && <span className="count">{count > 99 ? "99+" : count}</span>}
    </NavLink>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
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

  const sidebar = (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation" onClick={(e) => e.target.closest("a, .menu-item") && setOpen(false)}>
      <Link to="/app" className="sidebar-brand" style={{ color: "var(--text)", textDecoration: "none" }}>
        <span className="brand-mark"><Soup size={15} /></span>
        BachelorMate
      </Link>
      <HomeSwitcher homes={homes} current={home} onNavigate={() => setOpen(false)} />

      {home && (
        <>
          <div className="nav-section">Home</div>
          <NavItem to={base} end icon={LayoutDashboard}>Overview</NavItem>
          <NavItem to={`${base}/meals`} end icon={UtensilsCrossed}>Meals</NavItem>
          <NavItem to={`${base}/meals/daily`} icon={ClipboardList}>Daily meal list</NavItem>
          <NavItem to={`${base}/requests`} icon={Mail} count={pendingRequests}>Requests</NavItem>
          <NavItem to={`${base}/chat`} icon={MessagesSquare} count={homeChatUnread}>Home chat</NavItem>
          <NavItem to={`${base}/announcements`} icon={Megaphone}>Announcements</NavItem>
          <NavItem to={`${base}/grocery`} icon={ShoppingBasket}>Grocery list</NavItem>
          <NavItem to={`${base}/calendar`} icon={CalendarDays}>Calendar</NavItem>

          <div className="nav-section">Money</div>
          <NavItem to={`${base}/finance`} end icon={Wallet}>Finance</NavItem>
          <NavItem to={`${base}/finance/me`} icon={CircleUserRound}>My account</NavItem>
          {can("expenses.view", "expenses.manage", "expenses.meal") && <NavItem to={`${base}/finance/expenses`} icon={Receipt}>Expenses</NavItem>}
          <NavItem to={`${base}/finance/transactions`} icon={ArrowLeftRight} count={dash?.pendingPayments}>Transactions</NavItem>

          {can("members.view", "invites.manage", "reports.view", "activity.view", "home.manage", "settings.manage", "meals.configure") && <div className="nav-section">Manage</div>}
          {can("members.view") && <NavItem to={`${base}/members`} icon={Users} count={dash?.pendingJoins}>Members</NavItem>}
          {(can("invites.manage") || home.settings?.allowMemberInvites) && <NavItem to={`${base}/invites`} icon={UserPlus}>Invitations</NavItem>}
          {can("reports.view") && <NavItem to={`${base}/reports`} icon={BarChart3}>Reports</NavItem>}
          {can("activity.view") && <NavItem to={`${base}/activity`} icon={History}>Activity log</NavItem>}
          <NavItem to={`${base}/settings`} icon={Settings}>Home settings</NavItem>
        </>
      )}

      <div className="nav-section">You</div>
      {!home && <NavItem to="/homes" icon={House}>Homes</NavItem>}
      <NavItem to="/friends" icon={UserRound}>Friends</NavItem>
      <NavItem to="/messages" icon={MessageCircle} count={dmUnread}>Messages</NavItem>
      <NavItem to="/notifications" icon={Bell} count={notif?.unread}>Notifications</NavItem>
      {invites?.invitations?.length > 0 && <NavItem to="/invitations" icon={Mail} count={invites.invitations.length}>Invitations</NavItem>}

      <div className="sidebar-foot">
        <Menu
          align="start"
          width={232}
          trigger={
            <button className="nav-link" style={{ width: "100%", border: 0, background: "none", cursor: "pointer" }}>
              <Avatar user={user} size={26} />
              <span className="grow truncate" style={{ textAlign: "left" }}>
                <span style={{ color: "var(--text)", display: "block" }} className="truncate">{user.name}</span>
              </span>
              <ChevronsUpDown size={14} />
            </button>
          }
        >
          <div className="menu-label truncate" style={{ textTransform: "none", letterSpacing: 0 }}>{user.email}</div>
          <MenuItem icon={UserRound} onClick={() => navigate("/settings/profile")}>Profile</MenuItem>
          <MenuItem icon={Palette} onClick={() => navigate("/settings/appearance")}>Appearance</MenuItem>
          <MenuItem icon={Settings} onClick={() => navigate("/settings/security")}>Account settings</MenuItem>
          <div className="menu-sep" />
          <MenuItem icon={LogOut} danger onClick={async () => { await logout(); navigate("/login"); }}>Sign out</MenuItem>
        </Menu>
      </div>
    </aside>
  );

  return (
    <div className="shell">
      {sidebar}
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon={MenuIcon} className="show-sm" onClick={() => setOpen(true)} aria-label="Open menu" />
          <div className="grow truncate strong text-sm">{home?.name || ""}</div>
          <Button
            variant="ghost"
            icon={theme.resolved === "dark" ? Sun : Moon}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            onClick={() => theme.update({ mode: theme.resolved === "dark" ? "light" : "dark" })}
          />
          <Link to="/notifications" className="btn btn-ghost btn-icon" aria-label={`Notifications${notif?.unread ? ` (${notif.unread} unread)` : ""}`} style={{ position: "relative" }}>
            <Bell />
            {notif?.unread > 0 && <span className="count" style={{ position: "absolute", top: 2, right: 0, transform: "scale(.85)" }}>{notif.unread > 9 ? "9+" : notif.unread}</span>}
          </Link>
          <Link to="/settings/profile" aria-label="Profile"><Avatar user={user} size={30} /></Link>
        </header>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<main className="content"><PageSkeleton /></main>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>

      <nav className="mobile-nav" aria-label="Quick navigation">
        {home ? (
          <>
            <NavLink to={base} end><LayoutDashboard />Home</NavLink>
            <NavLink to={`${base}/meals`}><UtensilsCrossed />Meals</NavLink>
            <NavLink to={`${base}/finance`}><Wallet />Money</NavLink>
            <NavLink to={`${base}/chat`}><MessagesSquare />Chat</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/homes"><House />Homes</NavLink>
            <NavLink to="/friends"><UserRound />Friends</NavLink>
            <NavLink to="/messages"><MessageCircle />Messages</NavLink>
            <NavLink to="/notifications"><Bell />Alerts</NavLink>
          </>
        )}
        <a href="#menu" onClick={(e) => { e.preventDefault(); setOpen(true); }}><MenuIcon />More</a>
      </nav>
    </div>
  );
}
