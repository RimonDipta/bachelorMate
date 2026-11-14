import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, AlertCircle } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import GoogleButton from "./GoogleButton";
import { useT } from "../../i18n/I18nProvider";


export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="col" style={{ gap: 6 }}>
        <h1>{t("auth.login.title")}</h1>
        <p className="muted">{t("auth.login.subtitle")}</p>
      </div>
      {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t("auth.email")}>
          <div className="input-group">
            <Mail />
            <Input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
        </Field>
        <Field label={<span className="row between" style={{ width: "100%" }}>{t("auth.password")} <Link to="/forgot-password" className="text-xs" style={{ fontWeight: 500 }}>{t("auth.login.forgot")}</Link></span>}>
          <div className="input-group">
            <Lock />
            <Input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </Field>
        <Button type="submit" variant="primary" block loading={loading}>{t("auth.signIn")}</Button>
      </form>
      <GoogleButton onDone={() => navigate(dest, { replace: true })} onError={setError} />
      <p className="text-sm muted" style={{ textAlign: "center" }}>
        {t("auth.login.newHere")} <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{t("auth.login.createAccount")}</Link>
      </p>
    </AuthLayout>
  );
}
