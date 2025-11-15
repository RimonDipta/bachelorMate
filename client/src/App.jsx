// src/App.jsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import FamilyPage from "./pages/FamilyPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import MealsPage from "./pages/MealsPage.jsx";
import SummaryPage from "./pages/SummaryPage.jsx";

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/families/:familyId"
          element={
            <PrivateRoute>
              <FamilyPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/families/:familyId/payments"
          element={
            <PrivateRoute>
              <PaymentsPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/families/:familyId/meals"
          element={
            <PrivateRoute>
              <MealsPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/families/:familyId/summary"
          element={
            <PrivateRoute>
              <SummaryPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
};

export default App;
