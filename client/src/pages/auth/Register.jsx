/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Check, X } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import GoogleButton from "./GoogleButton";
import { useT } from "../../i18n/I18nProvider";
import { translate } from "../../i18n";

export const passwordChecks = (pw) => [
  { ok: pw.length >= 8, label: translate("auth.pw.length") },
  { ok: /[A-Za-z]/.test(pw), label: translate("auth.pw.letter") },
  { ok: /\d/.test(pw), label: translate("auth.pw.number") },
];

export function PasswordHints({ value }) {
  if (!value) return null;
  return (
    <div className="row wrap" style={{ gap: 12 }}>
      {passwordChecks(value).map((c) => (
        <span key={c.label} className="text-xs row" style={{ gap: 4, color: c.ok ? "var(--success)" : "var(--text-3)" }}>
          {c.ok ? <Check size={12} /> : <X size={12} />} {c.label}
        </span>
      ))}
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/homes";

  const errors = {
    name: form.name.trim().length < 2 ? t("auth.err.name") : "",
    email: !/^\S+@\S+\.\S+$/.test(form.email) ? t("auth.err.email") : "",
    password: passwordChecks(form.password).every((c) => c.ok) ? "" : t("auth.err.weak"),
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (!valid) return;
    setError("");
    setLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate(`/verify-email?next=${encodeURIComponent(dest)}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }), onBlur: () => setTouched({ ...touched, [k]: true }) });

  return (
    <AuthLayout>
      <div className="col" style={{ gap: 6 }}>
        <h1>{t("auth.register.title")}</h1>
        <p className="muted">{t("auth.register.subtitle")}</p>
      </div>
      {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t("auth.fullName")} error={touched.name && errors.name}>
          <Input autoComplete="name" {...bind("name")} placeholder={t("auth.namePlaceholder")} />
        </Field>
        <Field label={t("auth.email")} error={touched.email && errors.email}>
          <Input type="email" autoComplete="email" {...bind("email")} placeholder="you@example.com" />
        </Field>
        <Field label={t("auth.password")} error={touched.password && errors.password}>
          <Input type="password" autoComplete="new-password" {...bind("password")} />
        </Field>
        <PasswordHints value={form.password} />
        <Button type="submit" variant="primary" block loading={loading}>{t("auth.register.submit")}</Button>
      </form>
      <GoogleButton onDone={() => navigate(dest, { replace: true })} onError={setError} />
      <p className="text-sm muted" style={{ textAlign: "center" }}>
        {t("auth.register.haveAccount")} <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{t("auth.signIn")}</Link>
      </p>
    </AuthLayout>
  );
}
