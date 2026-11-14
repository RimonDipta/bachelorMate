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
import { useI18n, useT } from "../../i18n/I18nProvider";
import { LANGUAGES } from "../../i18n";
import { Languages } from "lucide-react";

function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const t = useT();
  const [f, setF] = useState({ name: user.name, phone: user.phone || "", bio: user.bio || "", discoverable: user.discoverable !== false });
  const [uploading, setUploading] = useState(false);
  const save = useAction(() => api.patch("/users/me", { ...f, name: f.name.trim() }), { success: t("settings.profile.saved"), onSuccess: (r) => setUser(r.user) });
  const resend = useAction(() => api.post("/auth/resend-verification"), { success: t("settings.profile.verificationSent") });
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(t("settings.profile.imageTooBig"));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      setUser((await api.post("/users/me/avatar", fd)).user);
      toast.success(t("settings.profile.pictureUpdated"));
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
      <Card pad title={t("settings.profile.picture")}>
        <div className="row-3 wrap">
          <Avatar user={user} size={64} />
          <label className="btn btn-secondary" aria-disabled={uploading}>
            <Camera size={16} /> {uploading ? t("settings.profile.uploading") : t("settings.profile.upload")}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {user.avatarUrl && <Button variant="ghost" icon={Trash2} onClick={removeAvatar}>{t("common.remove")}</Button>}
          <span className="hint">{t("settings.profile.pictureHint")}</span>
        </div>
      </Card>
      <Card pad title={t("settings.profile.details")}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="form-grid">
            <Field label={t("auth.fullName")} error={f.name.trim().length < 2 ? t("auth.err.name") : ""}><Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t("settings.profile.phone")} optional><Input type="tel" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t("auth.email")} className="full" hint={user.emailVerified ? undefined : t("settings.profile.unverified")}>
              <div className="row">
                <Input value={user.email} disabled />
                {user.emailVerified ? <Badge tone="success" icon={MailCheck}>{t("settings.profile.verified")}</Badge> : <Button size="sm" icon={Mail} loading={resend.isPending} onClick={() => resend.mutate()}>{t("settings.profile.verify")}</Button>}
              </div>
            </Field>
            <Field label={t("settings.profile.bio")} optional className="full"><Textarea value={f.bio} maxLength={280} rows={3} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
          </div>
          <SettingRow title={t("settings.profile.discoverable")} description={t("settings.profile.discoverableHint")}><Switch checked={f.discoverable} onChange={(v) => setF({ ...f, discoverable: v })} label={t("settings.profile.discoverable")} /></SettingRow>
          <div className="row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary" disabled={!dirty || f.name.trim().length < 2} loading={save.isPending}>{t("settings.profile.save")}</Button></div>
        </form>
      </Card>
    </div>
  );
}

function LanguagePicker() {
  const { lang, setLanguage, t } = useI18n();
  return (
    <Card pad title={t("language.title")}>
      <div className="row" style={{ gap: 8 }}>
        <Languages size={16} className="subtle" aria-hidden />
        <Segmented label={t("language.title")} value={lang} onChange={setLanguage} items={LANGUAGES.map((l) => ({ value: l.value, label: <span lang={l.value}>{l.label}</span> }))} />
      </div>
      <p className="hint" style={{ marginTop: 8 }}>{t("language.hint")}</p>
    </Card>
  );
}

function Appearance() {
  const theme = useTheme();
  const t = useT();
  const presets = [
    { value: "default", label: t("settings.appearance.presets.default"), side: "#f4f4f5", body: "#ffffff", dside: "#18181c", dbody: "#111114" },
    { value: "slate", label: t("settings.appearance.presets.slate"), side: "#f1f4f8", body: "#ffffff", dside: "#151b24", dbody: "#0f141b" },
    { value: "warm", label: t("settings.appearance.presets.warm"), side: "#f5f4f1", body: "#ffffff", dside: "#1c1917", dbody: "#141210" },
    { value: "contrast", label: t("settings.appearance.presets.contrast"), side: "#ececef", body: "#ffffff", dside: "#0a0a0a", dbody: "#000000" },
  ];
  const dark = theme.resolved === "dark";
  return (
    <div className="stack">
      <LanguagePicker />
      <Card pad title={t("settings.appearance.theme")}>
        <Segmented label={t("settings.appearance.themeMode")} value={theme.mode} onChange={(mode) => theme.update({ mode })} items={[{ value: "light", label: t("settings.appearance.light"), icon: Sun }, { value: "dark", label: t("settings.appearance.dark"), icon: Moon }, { value: "system", label: t("settings.appearance.system"), icon: Monitor }]} />
      </Card>
      <Card pad title={t("settings.appearance.accent")}>
        <div className="row wrap" style={{ gap: 12 }}>
          {ACCENTS.map((a) => (
            <button key={a.value} className="swatch" style={{ background: a.color }} aria-pressed={theme.accent === a.value} aria-label={t(`settings.appearance.accents.${a.value}`)} title={t(`settings.appearance.accents.${a.value}`)} onClick={() => theme.update({ accent: a.value })}>
              {theme.accent === a.value && <Check size={14} />}
            </button>
          ))}
        </div>
      </Card>
      <Card pad title={t("settings.appearance.preset")}>
        <div className="grid-4" style={{ gap: 12 }}>
          {presets.map((p) => (
            <button key={p.value} className="option-card" aria-pressed={theme.preset === p.value} onClick={() => theme.update({ preset: p.value })}>
              <div className="theme-thumb"><span style={{ background: dark ? p.dside : p.side }} /><span style={{ background: dark ? p.dbody : p.body, display: "grid", alignContent: "center", padding: 8, gap: 4 }}><i style={{ height: 6, width: "70%", background: "var(--accent)", borderRadius: 3 }} /><i style={{ height: 6, width: "45%", background: dark ? "#3f3f46" : "#d4d4d8", borderRadius: 3 }} /></span></div>
              <span className="text-sm strong">{p.label}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card pad title={t("settings.appearance.density")}>
        <Segmented label={t("settings.appearance.density")} value={theme.density} onChange={(density) => theme.update({ density })} items={[{ value: "comfortable", label: t("settings.appearance.comfortable") }, { value: "compact", label: t("settings.appearance.compact") }]} />
        <p className="hint" style={{ marginTop: 8 }}>{t("settings.appearance.synced")}</p>
      </Card>
    </div>
  );
}

function Security() {
  const { user, acceptSession, logout } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const change = useAction(() => api.post("/auth/change-password", { currentPassword: f.current || undefined, newPassword: f.next }), {
    success: t("settings.security.changed"),
    onSuccess: (r) => { acceptSession(r); setF({ current: "", next: "", confirm: "" }); },
    onError: (e) => setError(e.message),
  });
  const all = useAction(() => api.post("/auth/logout-all"), { onSuccess: async () => { await logout(); navigate("/login"); } });
  const strong = passwordChecks(f.next).every((c) => c.ok);
  const google = user.provider === "google";
  return (
    <div className="stack">
      <Card pad title={t("settings.security.changeTitle")}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setError(""); if (f.next !== f.confirm) return setError(t("auth.err.mismatch")); change.mutate(); }}>
          {google && <Alert tone="neutral">{t("settings.security.googleNote")}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label={t("settings.security.current")} optional={google}><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <div className="form-grid">
            <Field label={t("auth.newPassword")}><Input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
            <Field label={t("settings.security.confirmNew")}><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          </div>
          <PasswordHints value={f.next} />
          <div className="row" style={{ justifyContent: "flex-end" }}><Button type="submit" variant="primary" icon={ShieldCheck} disabled={!strong || !f.confirm} loading={change.isPending}>{t("auth.updatePassword")}</Button></div>
        </form>
      </Card>
      <Card pad title={t("settings.security.sessions")}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow">{t("settings.security.sessionsHint")}</p>
          <Button variant="danger-ghost" icon={LogOut} onClick={() => setConfirmAll(true)}>{t("settings.security.signOutAll")}</Button>
        </div>
      </Card>
      <ConfirmDialog open={confirmAll} onClose={() => setConfirmAll(false)} onConfirm={() => all.mutate()} loading={all.isPending} danger title={t("settings.security.signOutAllTitle")} confirmLabel={t("settings.security.signOutAll")} />
    </div>
  );
}

const NOTIF_GROUPS = [
  ["homes", ["home_invitation", "invitation_accepted", "join_request", "role_change", "announcement"]],
  ["requests", ["meal_off_request", "guest_meal_request", "absence_request", "departure_request", "request_reviewed", "meal_period_closed"]],
  ["money", ["payment", "payment_reminder", "expense"]],
  ["social", ["friend_request", "friend_accepted", "message"]],
];

const PUSH_HINT_STATES = ["needs-install", "unsupported", "off-server", "denied"];

function DevicePush() {
  const toast = useToast();
  const t = useT();
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
      if (on) toast.success(t("settings.notifications.pushOn"));
    } catch (e) {
      toast.error(e.message);
      setState(await getPushState().catch(() => "off"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card pad title={t("settings.notifications.thisDevice")}>
      <SettingRow title={t("settings.notifications.push")} description={PUSH_HINT_STATES.includes(state) ? t(`settings.notifications.pushHint.${state}`) : t("settings.notifications.pushDefault")}>
        <Switch checked={state === "on"} disabled={busy || !["on", "off"].includes(state)} onChange={toggle} label={t("settings.notifications.pushLabel")} />
      </SettingRow>
    </Card>
  );
}

function NotificationPrefs() {
  const { user, setUser } = useAuth();
  const t = useT();
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
      <Card pad title={t("auth.email")}>
        <SettingRow title={t("settings.notifications.email")} description={t("settings.notifications.emailHint")}>
          <Switch checked={email} onChange={(v) => apply({ email: v })} label={t("settings.notifications.email")} />
        </SettingRow>
      </Card>
      {NOTIF_GROUPS.map(([group, types]) => (
        <Card pad title={t(`settings.notifications.groups.${group}`)} key={group}>
          {types.map((type) => (
            <SettingRow key={type} title={t(`settings.notifications.types.${type}`)}><Switch checked={!muted.includes(type)} onChange={(v) => toggle(type, v)} label={t(`settings.notifications.types.${type}`)} /></SettingRow>
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
  const t = useT();
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
      toast.success(t("settings.data.deleted"));
    },
    onError: (e) => setError(e.message),
  });
  const close = () => { setOpen(false); setError(""); setF({ password: "", confirm: "" }); };

  return (
    <div className="stack">
      <Card pad title={t("settings.data.downloadTitle")}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow" style={{ minWidth: 220 }}>{t("settings.data.downloadHint")}</p>
          <Button icon={Download} loading={downloading} onClick={download}>{t("settings.data.download")}</Button>
        </div>
      </Card>
      <Card pad title={t("settings.data.deleteTitle")}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <p className="text-sm muted grow" style={{ minWidth: 220 }}>
            {t("settings.data.deleteHint")}
          </p>
          <Button variant="danger-ghost" icon={Trash2} onClick={() => setOpen(true)}>{t("settings.data.deleteTitle")}</Button>
        </div>
      </Card>
      <FormModal
        open={open}
        onClose={close}
        danger
        title={t("settings.data.confirmTitle")}
        description={t("settings.data.cantUndo")}
        submitLabel={t("settings.data.confirmSubmit")}
        loading={del.isPending}
        disabled={checking || blockers.length > 0 || f.confirm !== "DELETE" || (!google && !f.password)}
        onSubmit={() => { setError(""); del.mutate(); }}
      >
        {checking ? <p className="text-sm muted">{t("settings.data.checking")}</p> : blockers.length > 0 ? (
          <Alert tone="warning">
            {t("settings.data.blockedBefore")}{blockers.map((b, i) => (
              <span key={b.homeId}>{i > 0 && ", "}<Link to={`/h/${b.homeId}/settings`} onClick={close}>{b.name}</Link></span>
            ))}{t("settings.data.blockedAfter", { count: blockers.length })}{blockers.some((b) => b.admin) ? t("settings.data.blockedAdmin") : ""}
          </Alert>
        ) : (
          <>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label={t("settings.data.yourPassword")} optional={google} hint={google ? t("settings.data.passwordIfSet") : undefined}>
              <Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
            <Field label={t("settings.data.typeDelete")}>
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
  const t = useT();
  const tabs = ["profile", "appearance", "security", "notifications", "data"].map((value) => ({ value, label: t(`settings.tabs.${value}`) }));
  return (
    <main className="content content-narrow">
      <PageHeader title={t("shell.accountSettings")} />
      <Tabs items={tabs} value={tab} onChange={(v) => navigate(`/settings/${v}`)} />
      {tab === "profile" && <Profile />}
      {tab === "appearance" && <Appearance />}
      {tab === "security" && <Security />}
      {tab === "notifications" && <NotificationPrefs />}
      {tab === "data" && <YourData />}
    </main>
  );
}
