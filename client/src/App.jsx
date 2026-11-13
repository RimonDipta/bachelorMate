import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import AppShell from "./components/layout/AppShell";
import HomeLayout from "./components/layout/HomeLayout";
import { PageSkeleton } from "./components/ui";

const Landing = lazy(() => import("./pages/Landing"));
const Legal = lazy(() => import("./pages/Legal"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const Homes = lazy(() => import("./pages/Homes"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Join = lazy(() => import("./pages/Join"));
const MyInvitations = lazy(() => import("./pages/MyInvitations"));
const Friends = lazy(() => import("./pages/Friends"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AccountSettings = lazy(() => import("./pages/settings/AccountSettings"));
const Dashboard = lazy(() => import("./pages/home/Dashboard"));
const Members = lazy(() => import("./pages/home/Members"));
const Invites = lazy(() => import("./pages/home/Invites"));
const HomeSettings = lazy(() => import("./pages/home/HomeSettings"));
const Meals = lazy(() => import("./pages/home/Meals"));
const DailyMeals = lazy(() => import("./pages/home/DailyMeals"));
const MealHistory = lazy(() => import("./pages/home/MealHistory"));
const MealPeriod = lazy(() => import("./pages/home/MealPeriod"));
const Requests = lazy(() => import("./pages/home/Requests"));
const Finance = lazy(() => import("./pages/home/Finance"));
const Transactions = lazy(() => import("./pages/home/Transactions"));
const Expenses = lazy(() => import("./pages/home/Expenses"));
const MemberAccount = lazy(() => import("./pages/home/MemberAccount"));
const HomeChat = lazy(() => import("./pages/home/HomeChat"));
const Announcements = lazy(() => import("./pages/home/Announcements"));
const Grocery = lazy(() => import("./pages/home/Grocery"));
const Calendar = lazy(() => import("./pages/home/Calendar"));
const Reports = lazy(() => import("./pages/home/Reports"));
const Activity = lazy(() => import("./pages/home/Activity"));

const Spinner = () => (
  <div className="center-screen">
    <Loader2 className="spin" style={{ animation: "spin .8s linear infinite", color: "var(--text-3)" }} />
  </div>
);

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (user) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next && next.startsWith("/") && !next.startsWith("//") ? next : "/app"} replace />;
  }
  return children;
}

function AppEntry() {
  const { user } = useAuth();
  return <Navigate to={user?.lastActiveHome ? `/h/${user.lastActiveHome}` : "/homes"} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/app" element={<AppEntry />} />
          <Route path="/homes" element={<Suspense fallback={<PageSkeleton />}><Homes /></Suspense>} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:token" element={<Join />} />
          <Route path="/invitations" element={<MyInvitations />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/friends/chat/:cid" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
          <Route path="/settings/:tab" element={<AccountSettings />} />

          <Route path="/h/:homeId" element={<HomeLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<Members />} />
            <Route path="invites" element={<Invites />} />
            <Route path="settings" element={<HomeSettings />} />
            <Route path="meals" element={<Meals />} />
            <Route path="meals/daily" element={<DailyMeals />} />
            <Route path="meals/history" element={<MealHistory />} />
            <Route path="meals/periods/:pid" element={<MealPeriod />} />
            <Route path="requests" element={<Requests />} />
            <Route path="finance" element={<Finance />} />
            <Route path="finance/transactions" element={<Transactions />} />
            <Route path="finance/expenses" element={<Expenses />} />
            <Route path="finance/me" element={<MemberAccount self />} />
            <Route path="finance/accounts/:mid" element={<MemberAccount />} />
            <Route path="chat" element={<HomeChat />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="grocery" element={<Grocery />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="reports" element={<Reports />} />
            <Route path="activity" element={<Activity />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
