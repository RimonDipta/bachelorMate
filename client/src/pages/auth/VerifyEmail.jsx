import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2, MailCheck, RotateCw } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { translateServer } from "../../i18n/serverText";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/I18nProvider";


const safeNext = (n) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

/** Link flow: /verify-email?token=… (works signed in or out). */
function LinkVerify({ token }) {
  const { user, setUser } = useAuth();
  const t = useT();
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api
      .post("/auth/verify-email", { token })
      .then((r) => {
        setState("ok");
        if (user && r.user?._id === user._id) setUser(r.user);
      })
      .catch((e) => {
        setState("error");
        setMessage(e.message);
      });
  }, [token, user, setUser]);
  return (
    <>
      <h1>{t("auth.verify.linkTitle")}</h1>
      {state === "loading" && <div className="row muted"><Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> {t("auth.verify.verifying")}</div>}
      {state === "ok" && <Alert tone="success" icon={CheckCircle2}>{t("auth.verify.verified")}</Alert>}
      {state === "error" && <Alert tone="danger" icon={AlertCircle}>{message}{user && ` ${t("auth.verify.requestBelow")}`}</Alert>}
      {state === "error" && user ? <CodeVerify /> : <Link to={user ? "/app" : "/login"} className="btn btn-primary btn-block">{user ? t("auth.verify.continueApp") : t("auth.signIn")}</Link>}
    </>
  );
}

/** Code flow for signed-in users. */
function CodeVerify() {
  const { user, setUser } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError(t("auth.verify.enterCode"));
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/auth/verify-email-code", { code: value });
      setUser(r.user);
      navigate(next, { replace: true });
    } catch (e) {
      setError(e.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const r = await api.post("/auth/resend-verification");
      setInfo(translateServer(r.message));
      setCooldown(60);
    } catch (e) {
      const secs = /(\d+)s/.exec(e.message)?.[1];
      if (secs) setCooldown(Number(secs));
      setError(e.message);
    }
  };

  return (
    <div className="stack">
      <div className="col" style={{ gap: 6 }}>
        <div className="feature-icon"><MailCheck /></div>
        <h1>{t("auth.verify.codeTitle")}</h1>
        <p className="muted">{t("auth.verify.sentBefore")}<b>{user.email}</b>{t("auth.verify.sentAfter")}</p>
      </div>
      {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
      {info && !error && <Alert tone="success" icon={CheckCircle2}>{info}</Alert>}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Input
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) submit(v); // auto-submit on paste / last digit
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          aria-label={t("auth.verify.codeLabel")}
          autoFocus
          style={{ height: 56, fontSize: 28, letterSpacing: "0.5em", textAlign: "center", fontFamily: "var(--font-mono)" }}
        />
        <Button type="submit" variant="primary" block loading={busy} disabled={code.length !== 6}>{t("auth.verify.submit")}</Button>
      </form>
      <div className="row between wrap">
        <Button variant="ghost" icon={RotateCw} onClick={resend} disabled={cooldown > 0}>{cooldown > 0 ? t("auth.verify.resendIn", { s: cooldown }) : t("auth.verify.resend")}</Button>
        <Link to={next} className="text-sm muted">{t("auth.verify.later")}</Link>
      </div>
      <p className="hint">{t("auth.verify.hint")}</p>
    </div>
  );
}

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, loading } = useAuth();
  const t = useT();

  let content;
  if (token) content = <LinkVerify token={token} />;
  else if (loading) content = <Loader2 size={18} style={{ animation: "spin .8s linear infinite" }} />;
  else if (!user) {
    content = (
      <>
        <h1>{t("auth.verify.title")}</h1>
        <p className="muted">{t("auth.verify.signInFirst")}</p>
        <Link to={`/login?next=${encodeURIComponent("/verify-email")}`} className="btn btn-primary btn-block">{t("auth.signIn")}</Link>
      </>
    );
  } else if (user.emailVerified) {
    content = (
      <>
        <Alert tone="success" icon={CheckCircle2}>{t("auth.verify.isVerifiedBefore")}<b>{user.email}</b>{t("auth.verify.isVerifiedAfter")}</Alert>
        <Link to={safeNext(params.get("next"))} className="btn btn-primary btn-block">{t("common.continue")}</Link>
      </>
    );
  } else content = <CodeVerify />;

  return <AuthLayout>{content}</AuthLayout>;
}
