import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, AlertCircle } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { useT } from "../../i18n/I18nProvider";


export default function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div className="stack">
          <div className="feature-icon"><MailCheck /></div>
          <h1>{t("auth.forgot.sentTitle")}</h1>
          <p className="muted">{t("auth.forgot.sentBefore")}<b>{email}</b>{t("auth.forgot.sentAfter")}</p>
          <Link to="/login" className="btn btn-secondary btn-block">{t("auth.backToSignIn")}</Link>
        </div>
      ) : (
        <>
          <div className="col" style={{ gap: 6 }}>
            <h1>{t("auth.forgot.title")}</h1>
            <p className="muted">{t("auth.forgot.subtitle")}</p>
          </div>
          {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
          <form className="stack" onSubmit={submit}>
            <Field label={t("auth.email")}>
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block loading={loading}>{t("auth.forgot.submit")}</Button>
          </form>
          <Link to="/login" className="row text-sm" style={{ justifyContent: "center" }}><ArrowLeft size={14} /> {t("auth.backToSignIn")}</Link>
        </>
      )}
    </AuthLayout>
  );
}
