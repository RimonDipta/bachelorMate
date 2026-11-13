import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { passwordChecks, PasswordHints } from "./Register";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strong = passwordChecks(pw).every((c) => c.ok);

  const submit = async (e) => {
    e.preventDefault();
    if (!strong) return setError("Choose a stronger password");
    if (pw !== confirm) return setError("Passwords don't match");
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
        <h1>Invalid link</h1>
        <p className="muted">This reset link is missing its token. Request a new one.</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {done ? (
        <div className="stack">
          <Alert tone="success" icon={CheckCircle2}>Your password was updated. All other sessions were signed out.</Alert>
          <Link to="/login" className="btn btn-primary btn-block">Sign in</Link>
        </div>
      ) : (
        <>
          <div className="col" style={{ gap: 6 }}>
            <h1>Choose a new password</h1>
            <p className="muted">This link can be used once and expires 30 minutes after it was sent.</p>
          </div>
          {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
          <form className="stack" onSubmit={submit}>
            <Field label="New password">
              <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <PasswordHints value={pw} />
            <Field label="Confirm password" error={confirm && confirm !== pw ? "Passwords don't match" : ""}>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block loading={loading}>Update password</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
