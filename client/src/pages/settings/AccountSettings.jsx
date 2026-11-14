import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, Trash2, Monitor, Sun, Moon, Check, ShieldCheck, LogOut, MailCheck, Mail, Download } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useTheme, ACCENTS } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { useAction } from "../../lib/hooks";
import { Alert, Avatar, Badge, Button, Card, ConfirmDialog, Field, FormModal, Input, PageHeader, SettingRow, Switch, Tabs, Textarea, Segmented } from "../../components/ui";
import { passwordChecks, PasswordHints } from "../auth/Register";
import { disablePush, enablePush, getPushState } from "../../lib/pwa";

function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone || "", bio: user.bio || "", discoverable: user.discoverable !== false });
  const [uploading, setUploading] = useState(false);
  const save = useAction(() => api.patch("/users/me", { ...f, name: f.name.trim() }), { success: "Profile saved", onSuccess: (r) => setUser(r.user) });
  const resend = useAction(() => api.post("/auth/resend-verification"), { success: "Verification email sent" });
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      setUser((await api.post("/users/me/avatar", fd)).user);
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(e);
    } finally {
      setUploading(false);
    }
  };
  const removeAvatar = async () => setUser((await api.del("/users/me/avatar")).user);
  const dirty = f.name !== user.name || f.phone !== (user.phone || "") || f.bio !== (user.bio || "") || f.discoverable !== (user.discoverable !== false);
  return (
    <div className="stack">
      <Card pad title="Profile picture">
        <div className="row-3 wrap">
          <Avatar user={user} size={64} />
          <label className="btn btn-secondary" aria-disabled={uploading}>
            <Camera size={16} /> {uploading ? "Uploading…" : "Upload new"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {user.avatarUrl && <Button variant="ghost" icon={Trash2} onClick={removeAvatar}>Remove</Button>}
          <span className="hint">JPG, PNG or WEBP, up to 5 MB.</span>
        </div>
      </Card>
      <Card pad title="Personal details">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="form-grid">
            <Field label="Full name" error={f.name.trim().length < 2 ? "Enter your name" : ""}><Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Phone" optional><Input type="tel" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email" className="full" hint={user.emailVerified ? undefined : "Unverified"}>
              <div className="row">
                <Input value={user.email} disabled />
                {user.emailVerified ? <Badge tone="success" icon={MailCheck}>Verified</Badge> : <Button size="sm" icon={Mail} loading={resend.isPending} onClick={() => resend.mutate()}>Verify</Button>}
              </div>
            </Field>
            <Field label="Bio" optional className="full"><Textarea value={f.bio} maxLength={280} rows={3} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
          </div>
          <SettingRow title="Let people find me" description="Others can find you by name in friend search. Your email is never shown."><Switch checked={f.discoverable} onChange={(v) => setF({ ...f, discoverable: v })} label="Discoverable" /></SettingRow>
          <div className="row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary" disabled={!dirty || f.name.trim().length < 2} loading={save.isPending}>Save profile</Button></div>
        </form>
      </Card>
    </div>
  );
}

function Appearance() {
  const t = useTheme();
  const presets = [
    { value: "default", label: "Neutral", side: "#f4f4f5", body: "#ffffff", dside: "#18181c", dbody: "#111114" },
    { value: "slate", label: "Slate", side: "#f1f4f8", body: "#ffffff", dside: "#151b24", dbody: "#0f141b" },
    { value: "warm", label: "Warm", side: "#f5f4f1", body: "#ffffff", dside: "#1c1917", dbody: "#141210" },
    { value: "contrast", label: "High contrast", side: "#ececef", body: "#ffffff", dside: "#0a0a0a", dbody: "#000000" },
  ];
  const dark = t.resolved === "dark";
  return (
    <div className="stack">
      <Card pad title="Theme">
        <Segmented label="Theme mode" value={t.mode} onChange={(mode) => t.update({ mode })} items={[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }]} />
      </Card>
      <Card pad title="Accent color">
        <div className="row wrap" style={{ gap: 12 }}>
          {ACCENTS.map((a) => (
            <button key={a.value} className="swatch" style={{ background: a.color }} aria-pressed={t.accent === a.value} aria-label={a.value} title={a.value[0].toUpperCase() + a.value.slice(1)} onClick={() => t.update({ accent: a.value })}>
              {t.accent === a.value && <Check size={14} />}
            </button>
          ))}
        </div>
      </Card>
      <Card pad title="Preset">
        <div className="grid-4" style={{ gap: 12 }}>
          {presets.map((p) => (
            <button key={p.value} className="option-card" aria-pressed={t.preset === p.value} onClick={() => t.update({ preset: p.value })}>
              <div className="theme-thumb"><span style={{ background: dark ? p.dside : p.side }} /><span style={{ background: dark ? p.dbody : p.body, display: "grid", alignContent: "center", padding: 8, gap: 4 }}><i style={{ height: 6, width: "70%", background: "var(--accent)", borderRadius: 3 }} /><i style={{ height: 6, width: "45%", background: dark ? "#3f3f46" : "#d4d4d8", borderRadius: 3 }} /></span></div>
              <span className="text-sm strong">{p.label}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card pad title="Density">
        <Segmented label="Density" value={t.density} onChange={(density) => t.update({ density })} items={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
        <p className="hint" style={{ marginTop: 8 }}>Saved to your account, so it follows you across devices.</p>
      </Card>
    </div>
  );
}

function Security() {
  const { user, acceptSession, logout } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const change = useAction(() => api.post("/auth/change-password", { currentPassword: f.current || undefined, newPassword: f.next }), {
    success: "Password changed. Other devices were signed out.",
    onSuccess: (r) => { acceptSession(r); setF({ current: "", next: "", confirm: "" }); },
    onError: (e) => setError(e.message),
  });
  const all = useAction(() => api.post("/auth/logout-all"), { onSuccess: async () => { await logout(); navigate("/login"); } });
  const strong = passwordChecks(f.next).every((c) => c.ok);
  const google = user.provider === "google";
  return (
    <div className="stack">
      <Card pad title="Change password">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setError(""); if (f.next !== f.confirm) return setError("Passwords don't match"); change.mutate(); }}>
          {google && <Alert tone="neutral">You signed up with Google. You can also set a password to sign in with email.</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Current password" optional={google}><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <div className="form-grid">
            <Field label="New password"><Input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          </div>
          <PasswordHints value={f.next} />
          <div className="row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary" icon={ShieldCheck} disabled={!strong || !f.confirm} loading={change.isPending}>Update password</Button></div>
        </form>
      </Card>
      <Card pad title="Sessions">
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow">Sign out of BachelorMate on every device, including this one.</p>
          <Button variant="danger-ghost" icon={LogOut} onClick={() => setConfirmAll(true)}>Sign out everywhere</Button>
        </div>
      </Card>
      <ConfirmDialog open={confirmAll} onClose={() => setConfirmAll(false)} onConfirm={() => all.mutate()} loading={all.isPending} danger title="Sign out of all devices?" confirmLabel="Sign out everywhere" />
    </div>
  );
}

const NOTIF_GROUPS = [
  ["Homes", [["home_invitation", "Home invitations"], ["invitation_accepted", "New members joined"], ["join_request", "Join requests"], ["role_change", "Role changes"], ["announcement", "Announcements"]]],
  ["Requests & meals", [["meal_off_request", "Meal-off requests"], ["guest_meal_request", "Guest meal requests"], ["absence_request", "Absence requests"], ["departure_request", "Departure requests"], ["request_reviewed", "Updates on my requests"], ["meal_period_closed", "Meal period closed"]]],
  ["Money", [["payment", "Payments"], ["payment_reminder", "Payment reminders"], ["expense", "New expenses"]]],
  ["Social", [["friend_request", "Friend requests"], ["friend_accepted", "Accepted friend requests"], ["message", "Messages while offline"]]],
];

const PUSH_HINT = {
  "needs-install": "On iPhone, notifications work in the installed app. Use “Install the app” from your account menu, then turn this on there.",
  unsupported: "This browser doesn't support notifications.",
  "off-server": "Push notifications haven't been set up on the server yet.",
  denied: "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.",
};

function DevicePush() {
  const toast = useToast();
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s)).catch(() => alive && setState("unsupported"));
    return () => { alive = false; };
  }, []);
  const toggle = async (on) => {
    setBusy(true);
    try {
      if (on) await enablePush();
      else await disablePush();
      setState(on ? "on" : "off");
      if (on) toast.success("Notifications are on for this device");
    } catch (e) {
      toast.error(e.message);
      setState(await getPushState().catch(() => "off"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card pad title="This device">
      <SettingRow title="Push notifications" description={PUSH_HINT[state] || "Get alerts on this phone or computer, even when BachelorMate is closed."}>
        <Switch checked={state === "on"} disabled={busy || !["on", "off"].includes(state)} onChange={toggle} label="Push notifications on this device" />
      </SettingRow>
    </Card>
  );
}

function NotificationPrefs() {
  const { user, setUser } = useAuth();
  const muted = user.notificationPrefs?.muted || [];
  const email = user.notificationPrefs?.email !== false;
  const save = useAction((prefs) => api.patch("/users/me/preferences", { notificationPrefs: prefs }), { onSuccess: (r) => setUser(r.user) });
  // Optimistic: reflect the change immediately, the server response confirms it.
  const apply = (patch) => {
    setUser({ ...user, notificationPrefs: { ...user.notificationPrefs, ...patch } });
    save.mutate(patch);
  };
  const toggle = (type, on) => apply({ muted: on ? muted.filter((m) => m !== type) : [...muted, type] });
  return (
    <div className="stack">
      <DevicePush />
      <Card pad title="Email">
        <SettingRow title="Email notifications" description="Important updates — invitations, departures, reminders, important announcements — are also emailed.">
          <Switch checked={email} onChange={(v) => apply({ email: v })} label="Email notifications" />
        </SettingRow>
      </Card>
      {NOTIF_GROUPS.map(([title, items]) => (
        <Card pad title={title} key={title}>
          {items.map(([type, label]) => (
            <SettingRow key={type} title={label}><Switch checked={!muted.includes(type)} onChange={(v) => toggle(type, v)} label={label} /></SettingRow>
          ))}
        </Card>
      ))}
    </div>
  );
}

function YourData() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const { data: check, isLoading: checking } = useQuery({ queryKey: ["deletion-check"], queryFn: () => api.get("/users/me/deletion-check"), enabled: open });
  const blockers = check?.blockers || [];
  const google = user.provider === "google";

  const download = async () => {
    setDownloading(true);
    try {
      await api.download("/users/me/export", null, `bachelormate-data-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };
  const del = useAction(() => api.del("/users/me", { password: f.password || undefined, confirm: f.confirm }), {
    onSuccess: async () => {
      // Leave the signed-in area first so the sign-in redirect doesn't kick in.
      navigate("/", { replace: true });
      await logout();
      toast.success("Your account has been deleted.");
    },
    onError: (e) => setError(e.message),
  });
  const close = () => { setOpen(false); setError(""); setF({ password: "", confirm: "" }); };

  return (
    <div className="stack">
      <Card pad title="Download your data">
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow" style={{ minWidth: 220 }}>Your profile, homes, payments, meals, requests, messages and reviews, as a JSON file.</p>
          <Button icon={Download} loading={downloading} onClick={download}>Download</Button>
        </div>
      </Card>
      <Card pad title="Delete account">
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow" style={{ minWidth: 220 }}>
            Permanently erases your profile, messages, reviews and friends. Payments and meals you were part of stay in your old homes&apos; records as &ldquo;Deleted user&rdquo;, so their accounts still add up.
          </p>
          <Button variant="danger-ghost" icon={Trash2} onClick={() => setOpen(true)}>Delete account</Button>
        </div>
      </Card>
      <FormModal
        open={open}
        onClose={close}
        danger
        title="Delete your account?"
        description="This can't be undone."
        submitLabel="Delete my account"
        loading={del.isPending}
        disabled={checking || blockers.length > 0 || f.confirm !== "DELETE" || (!google && !f.password)}
        onSubmit={() => { setError(""); del.mutate(); }}
      >
        {checking ? <p className="text-sm muted">Checking your homes…</p> : blockers.length > 0 ? (
          <Alert tone="warning">
            You still live with others in {blockers.map((b, i) => (
              <span key={b.homeId}>{i > 0 && ", "}<Link to={`/h/${b.homeId}/settings`} onClick={close}>{b.name}</Link></span>
            ))}. Leave {blockers.length > 1 ? "those homes" : "it"} first{blockers.some((b) => b.admin) ? " — hand over Admin to another member before leaving" : ""}.
          </Alert>
        ) : (
          <>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Your password" optional={google} hint={google ? "Only needed if you've set one." : undefined}>
              <Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
            <Field label="Type DELETE to confirm">
              <Input value={f.confirm} autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
            </Field>
          </>
        )}
      </FormModal>
    </div>
  );
}

export default function AccountSettings() {
  const { tab = "profile" } = useParams();
  const navigate = useNavigate();
  const tabs = [{ value: "profile", label: "Profile" }, { value: "appearance", label: "Appearance" }, { value: "security", label: "Security" }, { value: "notifications", label: "Notifications" }, { value: "data", label: "Your data" }];
  return (
    <main className="content content-narrow">
      <PageHeader title="Account settings" />
      <Tabs items={tabs} value={tab} onChange={(t) => navigate(`/settings/${t}`)} />
      {tab === "profile" && <Profile />}
      {tab === "appearance" && <Appearance />}
      {tab === "security" && <Security />}
      {tab === "notifications" && <NotificationPrefs />}
      {tab === "data" && <YourData />}
    </main>
  );
}
