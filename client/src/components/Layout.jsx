// src/components/Layout.jsx
import React from "react";
import Navbar from "./Navbar.jsx";

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main>
        <div className="container" style={{ paddingTop: "1.5rem" }}>
          {children}
        </div>
      </main>
    </>
  );
};

export default Layout;
