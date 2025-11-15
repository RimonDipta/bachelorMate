// src/components/Navbar.jsx
import React from "react";
import { useAuth } from "../context/AuthContext.jsx";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <div className="navbar-brand">Bachelor House Manager</div>
        <div className="navbar-right">
          {user && (
            <>
              <span className="text-sm">Hi, {user.name}</span>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
