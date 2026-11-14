import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useMatch, useNavigate, Link } from "react-router-dom";
import ErrorBoundary from "../ErrorBoundary";
import NetworkStatus from "../NetworkStatus";
import BrandMark from "../BrandMark";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, UtensilsCrossed, CalendarDays, ClipboardList, Wallet, Receipt, ArrowLeftRight, MessagesSquare,
  Megaphone, ShoppingBasket, Users, UserPlus, BarChart3, History, Settings, Bell, Menu as MenuIcon, ChevronsUpDown, ChevronDown,
  Plus, LogIn, House, UserRound, Palette, LogOut, Moon, Sun, MessageCircle, Mail, Check, CircleUserRound, Repeat, X, DoorOpen, Star, Search,
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

/** Account menu (profile, settings, personal pages, sign out), shown at the top of the sidebar and in the topbar. */
function AccountMenu({ user, trigger, align = "start", counts = {} }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const dark = theme.resolved === "dark";
  return (
    <Menu align={align} width={248} trigger={trigger}>
      <div className="row-3" style={{ padding: "8px 10px 10px" }}>
        <Avatar user={user} size={34} />
        <div style={{ minWidth: 0 }}>
          <div className="strong text-sm truncate">{user.name}</div>
          <div className="text-xs muted truncate">{user.email}</div>
        </div>
      </div>
      <div className="menu-sep" />
      <MenuItem icon={UserRound} onClick={() => navigate(`/people/${user._id}`)}>My profile</MenuItem>
      <MenuItem icon={MessageCircle} onClick={() => navigate("/messages")}>Messages {counts.dm > 0 && <span className="count" style={{ marginLeft: "auto" }}>{counts.dm}</span>}</MenuItem>
      <MenuItem icon={Users} onClick={() => navigate("/friends")}>Friends</MenuItem>
      {counts.invites > 0 && <MenuItem icon={Mail} onClick={() => navigate("/invitations")}>Invitations <span className="count" style={{ marginLeft: "auto" }}>{counts.invites}</span></MenuItem>}
      <MenuItem icon={House} onClick={() => navigate("/homes")}>All homes</MenuItem>
      <MenuItem icon={Star} onClick={() => navigate("/reviews")}>My reviews</MenuItem>
      <MenuItem icon={Search} onClick={() => navigate("/seats")}>Find a seat</MenuItem>
      <div className="menu-sep" />
      <MenuItem icon={Palette} onClick={() => navigate("/settings/appearance")}>Appearance</MenuItem>
      <MenuItem icon={dark ? Sun : Moon} onClick={() => theme.update({ mode: dark ? "light" : "dark" })}>{dark ? "Light mode" : "Dark mode"}</MenuItem>
      <MenuItem icon={Settings} onClick={() => navigate("/settings/security")}>Account settings</MenuItem>
      <div className="menu-sep" />
      <MenuItem icon={LogOut} danger onClick={async () => { await logout(); navigate("/login"); }}>Sign out</MenuItem>
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

/** A collapsible group of less-used links. Remembers whether it's open; always open while you're on one of its pages. */
function NavGroup({ label, paths, children }) {
  const location = useLocation();
  const key = `bm.nav.${label}`;
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
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation" onClick={(e) => e.target.closest("a, .menu-item") && setOpen(false)}>
      {/* Top: account (with sign out) + home switcher — always visible */}
      <div className="sidebar-top">
        <div className="row" style={{ gap: 6 }}>
          <AccountMenu
            user={user}
            counts={counts}
            trigger={
              <button className="sidebar-account" aria-label="Account menu">
                <Avatar user={user} size={28} />
                <span className="grow truncate" style={{ textAlign: "left" }}>
                  <span className="strong text-sm truncate" style={{ display: "block", color: "var(--text)" }}>{user.name}</span>
                </span>
                <ChevronsUpDown size={14} className="subtle" />
              </button>
            }
          />
          <Button variant="ghost" size="sm" icon={X} className="show-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
        </div>
        <HomeSwitcher homes={homes} current={home} onNavigate={() => setOpen(false)} />
      </div>

      {/* Middle: navigation scrolls on its own */}
      <nav className="sidebar-scroll" aria-label="Home navigation">
        {home ? (
          <>
            <NavItem to={base} end icon={LayoutDashboard}>Overview</NavItem>
            <NavItem to={`${base}/meals`} icon={UtensilsCrossed}>Meals</NavItem>
            <NavItem to={`${base}/requests`} icon={ClipboardList} count={pendingRequests}>Requests</NavItem>
            <NavItem to={`${base}/chat`} icon={MessagesSquare} count={homeChatUnread}>Home chat</NavItem>
            <NavItem to={`${base}/calendar`} icon={CalendarDays}>Calendar</NavItem>

            <div className="nav-section">Money</div>
            <NavItem to={`${base}/finance`} end icon={Wallet}>Finance</NavItem>
            <NavItem to={`${base}/finance/me`} icon={CircleUserRound}>My account</NavItem>
            {can("expenses.view", "expenses.manage", "expenses.meal") && <NavItem to={`${base}/finance/expenses`} icon={Receipt}>Expenses</NavItem>}
            {can("expenses.view", "expenses.manage", "finance.view_all") && <NavItem to={`${base}/finance/recurring`} icon={Repeat}>Recurring costs</NavItem>}
            <NavItem to={`${base}/finance/transactions`} icon={ArrowLeftRight} count={dash?.pendingPayments}>Transactions</NavItem>

            <div className="nav-section">House</div>
            <NavItem to={`${base}/announcements`} icon={Megaphone}>Announcements</NavItem>
            <NavItem to={`${base}/grocery`} icon={ShoppingBasket}>Grocery list</NavItem>
            {can("members.view") && <NavItem to={`${base}/members`} icon={Users} count={dash?.pendingJoins}>Members</NavItem>}
            {(can("invites.manage") || home.settings?.allowMemberInvites) && <NavItem to={`${base}/invites`} icon={UserPlus}>Invitations</NavItem>}
            <NavItem to={`${base}/settings`} icon={Settings}>Home settings</NavItem>

            <NavGroup label="More" paths={["listings", "reviews", "reports", "activity"].map((p) => `${base}/${p}`)}>
              <NavItem to={`${base}/listings`} icon={DoorOpen}>Seat listings</NavItem>
              <NavItem to={`${base}/reviews`} icon={Star}>Reviews</NavItem>
              {can("reports.view") && <NavItem to={`${base}/reports`} icon={BarChart3}>Reports</NavItem>}
              {can("activity.view") && <NavItem to={`${base}/activity`} icon={History}>Activity log</NavItem>}
            </NavGroup>
          </>
        ) : (
          <>
            <NavItem to="/homes" icon={House}>Homes</NavItem>
            <NavItem to="/friends" icon={UserRound}>Friends</NavItem>
            <NavItem to="/messages" icon={MessageCircle} count={dmUnread}>Messages</NavItem>
            <NavItem to="/notifications" icon={Bell} count={notif?.unread}>Notifications</NavItem>
            {counts.invites > 0 && <NavItem to="/invitations" icon={Mail} count={counts.invites}>Invitations</NavItem>}
          </>
        )}
      </nav>

      {/* Bottom: personal shortcuts, always visible */}
      <div className="sidebar-bottom">
        <Link to="/" className="sidebar-brand-mini" aria-label="BachelorMate" title="BachelorMate"><BrandMark size={26} /></Link>
        <div className="row" style={{ gap: 2, marginLeft: "auto" }}>
          {[["/messages", MessageCircle, "Messages", dmUnread], ["/friends", UserRound, "Friends", 0], ["/notifications", Bell, "Notifications", notif?.unread]].map(([to, I, label, n]) => (
            <NavLink key={to} to={to} className="sidebar-iconlink" aria-label={`${label}${n ? ` (${n})` : ""}`} title={label}>
              <I />
              {n > 0 && <span className="count">{n > 9 ? "9+" : n}</span>}
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
          <AccountMenu user={user} counts={counts} align="end" trigger={<button className="btn btn-ghost btn-icon" style={{ padding: 0 }} aria-label="Account menu"><Avatar user={user} size={30} /></button>} />
        </header>
        <NetworkStatus />
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
