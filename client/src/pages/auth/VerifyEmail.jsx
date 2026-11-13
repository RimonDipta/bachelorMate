import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { Alert } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, setUser } = useAuth();
  const [state, setState] = useState(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is missing its token.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
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
    <AuthLayout>
      <h1>Email verification</h1>
      {state === "loading" && <div className="row muted"><Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> Verifying…</div>}
      {state === "ok" && <Alert tone="success" icon={CheckCircle2}>Your email is verified. Thanks!</Alert>}
      {state === "error" && <Alert tone="danger" icon={AlertCircle}>{message}</Alert>}
      <Link to={user ? "/app" : "/login"} className="btn btn-primary btn-block">{user ? "Continue to BachelorMate" : "Sign in"}</Link>
    </AuthLayout>
  );
}
