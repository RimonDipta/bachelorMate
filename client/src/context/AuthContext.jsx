// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // {_id, name, email, token, ...}
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Load from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem("bh_auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        api.setToken(parsed.token);
      } catch {
        localStorage.removeItem("bh_auth");
      }
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData);
    api.setToken(userData.token);
    localStorage.setItem("bh_auth", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    api.setToken(null);
    localStorage.removeItem("bh_auth");
    navigate("/login");
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
