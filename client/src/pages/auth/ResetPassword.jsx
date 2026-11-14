import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { passwordChecks, PasswordHints } from "./Register";
import { useT } from "../../i18n/I18nProvider";


export default function ResetPassword() {
  const [params] = useSearchParams();
  const t = useT();
  const token = params.get("token");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strong = passwordChecks(pw).every((c) => c.ok);

  const submit = async (e) => {
    e.preventDefault();
    if (!strong) return setError(t("auth.err.weak"));
    if (pw !== confirm) return setError(t("auth.err.mismatch"));
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <h1>{t("auth.reset.invalidTitle")}</h1>
        <p className="muted">{t("auth.reset.invalidText")}</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block">{t("auth.reset.requestNew")}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {done ? (
        <div className="stack">
          <Alert tone="success" icon={CheckCircle2}>{t("auth.reset.done")}</Alert>
          <Link to="/login" className="btn btn-primary btn-block">{t("auth.signIn")}</Link>
        </div>
      ) : (
        <>
          <div className="col" style={{ gap: 6 }}>
            <h1>{t("auth.reset.title")}</h1>
            <p className="muted">{t("auth.reset.subtitle")}</p>
          </div>
          {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
          <form className="stack" onSubmit={submit}>
            <Field label={t("auth.newPassword")}>
              <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <PasswordHints value={pw} />
            <Field label={t("auth.confirmPassword")} error={confirm && confirm !== pw ? t("auth.err.mismatch") : ""}>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block loading={loading}>{t("auth.updatePassword")}</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
