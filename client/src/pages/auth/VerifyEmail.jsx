import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2, MailCheck, RotateCw } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const safeNext = (n) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

/** Link flow: /verify-email?token=… (works signed in or out). */
function LinkVerify({ token }) {
  const { user, setUser } = useAuth();
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
      <h1>Email verification</h1>
      {state === "loading" && <div className="row muted"><Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> Verifying…</div>}
      {state === "ok" && <Alert tone="success" icon={CheckCircle2}>Your email is verified. Thanks!</Alert>}
      {state === "error" && <Alert tone="danger" icon={AlertCircle}>{message}{user && " You can request a new code below."}</Alert>}
      {state === "error" && user ? <CodeVerify /> : <Link to={user ? "/app" : "/login"} className="btn btn-primary btn-block">{user ? "Continue to BachelorMate" : "Sign in"}</Link>}
    </>
  );
}

/** Code flow for signed-in users. */
function CodeVerify() {
  const { user, setUser } = useAuth();
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
    if (!/^\d{6}$/.test(value)) return setError("Enter the 6-digit code from the email");
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
      setInfo(r.message);
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
        <h1>Check your email</h1>
        <p className="muted">We sent a 6-digit code to <b>{user.email}</b>. Enter it below, or tap the button in the email.</p>
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
          aria-label="6-digit verification code"
          autoFocus
          style={{ height: 56, fontSize: 28, letterSpacing: "0.5em", textAlign: "center", fontFamily: "var(--font-mono)" }}
        />
        <Button type="submit" variant="primary" block loading={busy} disabled={code.length !== 6}>Verify email</Button>
      </form>
      <div className="row between wrap">
        <Button variant="ghost" icon={RotateCw} onClick={resend} disabled={cooldown > 0}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}</Button>
        <Link to={next} className="text-sm muted">Do this later</Link>
      </div>
      <p className="hint">Can't find it? Check spam or promotions. Codes expire after 24 hours.</p>
    </div>
  );
}

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, loading } = useAuth();

  let content;
  if (token) content = <LinkVerify token={token} />;
  else if (loading) content = <Loader2 size={18} style={{ animation: "spin .8s linear infinite" }} />;
  else if (!user) {
    content = (
      <>
        <h1>Verify your email</h1>
        <p className="muted">Sign in to enter your verification code.</p>
        <Link to={`/login?next=${encodeURIComponent("/verify-email")}`} className="btn btn-primary btn-block">Sign in</Link>
      </>
    );
  } else if (user.emailVerified) {
    content = (
      <>
        <Alert tone="success" icon={CheckCircle2}>Your email <b>{user.email}</b> is verified.</Alert>
        <Link to={safeNext(params.get("next"))} className="btn btn-primary btn-block">Continue</Link>
      </>
    );
  } else content = <CodeVerify />;

  return <AuthLayout>{content}</AuthLayout>;
}
