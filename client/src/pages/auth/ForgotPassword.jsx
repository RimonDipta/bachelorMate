import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, AlertCircle } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert, Button, Field, Input } from "../../components/ui";
import { api } from "../../lib/api";

export default function ForgotPassword() {
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
          <h1>Check your inbox</h1>
          <p className="muted">If an account exists for <b>{email}</b>, we've sent a link to reset your password. It expires in 30 minutes.</p>
          <Link to="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      ) : (
        <>
          <div className="col" style={{ gap: 6 }}>
            <h1>Reset your password</h1>
            <p className="muted">Enter the email you signed up with and we'll send you a reset link.</p>
          </div>
          {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}
          <form className="stack" onSubmit={submit}>
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block loading={loading}>Send reset link</Button>
          </form>
          <Link to="/login" className="row text-sm" style={{ justifyContent: "center" }}><ArrowLeft size={14} /> Back to sign in</Link>
        </>
      )}
    </AuthLayout>
  );
}
