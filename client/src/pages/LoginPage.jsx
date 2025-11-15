// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { auth, googleProvider } from "../firebase";
import { signInWithPopup } from "firebase/auth";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", form);
      login(res.data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const gUser = result.user;

      const payload = {
        name: gUser.displayName,
        email: gUser.email,
        uid: gUser.uid,
      };

      const res = await api.post("/auth/google", payload);
      login(res.data);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Welcome back! Let’s manage the house.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-block mt-4"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="text-center text-sm mt-4">
          <div style={{ marginBottom: "0.5rem", color: "#6b7280" }}>or</div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-sm mt-4">
          New here?{" "}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
