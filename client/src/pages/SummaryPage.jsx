// src/pages/SummaryPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

const SummaryPage = () => {
  const { familyId } = useParams();
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState("");
  const [familyLoading, setFamilyLoading] = useState(true);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  // Load family basic info
  const loadFamily = async () => {
    setFamilyLoading(true);
    setFamilyError("");
    try {
      const res = await api.get(`/families/${familyId}`);
      setFamily(res.data);
    } catch (err) {
      setFamilyError(err.message);
    } finally {
      setFamilyLoading(false);
    }
  };

  // Load members to know roles and also show them if needed
  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await api.get(`/families/${familyId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      // we won't show error here; summary will show error if not allowed
    } finally {
      setMembersLoading(false);
    }
  };

  // Load monthly summary
  const loadSummary = async (y, m) => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await api.get(
        `/summary/monthly?familyId=${familyId}&year=${y}&month=${m}`
      );
      setSummary(res.data);
    } catch (err) {
      setSummaryError(err.message);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadFamily();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  useEffect(() => {
    loadSummary(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, year, month]);

  const myMembership = useMemo(
    () => members.find((m) => m.user?._id === user?._id),
    [members, user]
  );
  const isAdmin = myMembership?.roles?.includes("admin");
  const isManager = myMembership?.roles?.includes("manager");
  const canViewSummary = isAdmin || isManager;

  const handleMonthChange = (direction) => {
    let newYear = year;
    let newMonth = month + (direction === "next" ? 1 : -1);
    if (newMonth === 0) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth === 13) {
      newMonth = 1;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
  };

  const formatMoney = (n) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "0";
    return Math.round(n);
  };

  const amountClass = (n) => {
    if (!n || n === 0) return "amount-neutral";
    return n > 0 ? "amount-negative" : "amount-positive";
  };

  if (familyLoading) {
    return (
      <Layout>
        <p>Loading family...</p>
      </Layout>
    );
  }

  if (familyError || !family) {
    return (
      <Layout>
        <p className="error-text">Error: {familyError || "Family not found"}</p>
        <Link to="/" className="link">
          ← Back to dashboard
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/" className="link">
          ← Back to dashboard
        </Link>
      </div>

      <h1
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.4rem" }}
      >
        {family.name}
      </h1>
      <p className="text-sm" style={{ marginBottom: "0.5rem" }}>
        Monthly summary • Family code: <strong>{family.familyCode}</strong>
      </p>

      <div className="text-sm" style={{ marginBottom: "1.25rem" }}>
        <Link to={`/families/${familyId}`} className="link">
          Overview
        </Link>{" "}
        •{" "}
        <Link to={`/families/${familyId}/payments`} className="link">
          Payments
        </Link>{" "}
        •{" "}
        <Link to={`/families/${familyId}/meals`} className="link">
          Meals
        </Link>{" "}
        • <span style={{ fontWeight: 600 }}>Summary</span>
      </div>

      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <div className="card-title" style={{ marginBottom: "0.3rem" }}>
            Month
          </div>
          <div className="text-sm">
            {year} - {String(month).padStart(2, "0")}
          </div>
        </div>
        <div className="text-sm" style={{ display: "flex", gap: "0.25rem" }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleMonthChange("prev")}
          >
            ◀
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleMonthChange("next")}
          >
            ▶
          </button>
        </div>
      </div>

      {!canViewSummary && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="error-text">
            Only admins and managers can view the monthly summary.
          </p>
        </div>
      )}

      {canViewSummary && (
        <>
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card-header">
              <div>
                <div className="card-title">Month totals</div>
                <div className="card-subtitle">
                  Meal cost, meal rate and total meals.
                </div>
              </div>
              <span className="badge">Admin / Manager</span>
            </div>

            {summaryError && (
              <div className="error-text" style={{ marginBottom: "0.5rem" }}>
                {summaryError}
              </div>
            )}

            {summaryLoading ? (
              <p className="text-sm">Loading summary...</p>
            ) : !summary || !summary.data ? (
              <p className="text-sm">No summary data.</p>
            ) : (
              <>
                <div className="grid-2">
                  <div>
                    <div className="text-sm" style={{ marginBottom: "0.4rem" }}>
                      <strong>Meal rate:</strong>{" "}
                      {formatMoney(summary.data.totals.mealRate)} per meal
                    </div>
                    <div className="text-sm" style={{ marginBottom: "0.4rem" }}>
                      <strong>Total meal cost:</strong>{" "}
                      {formatMoney(summary.data.totals.totalMealCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm">
                      <strong>Total member meals:</strong>{" "}
                      {summary.data.totals.totalMealsAll}
                    </div>
                    <div className="text-sm">
                      <strong>Total guest meals:</strong>{" "}
                      {summary.data.totals.totalGuestMealsAll}
                    </div>
                    <div className="text-sm">
                      <strong>Total all meals:</strong>{" "}
                      {summary.data.totals.totalAllMeals}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card" style={{ marginTop: "1.25rem" }}>
            <div className="card-header">
              <div>
                <div className="card-title">Per-member breakdown</div>
                <div className="card-subtitle">
                  Meal cost + fixed bills − payments = net due (or advance).
                </div>
              </div>
            </div>

            {summaryLoading ? (
              <p className="text-sm">Loading members...</p>
            ) : summaryError ? (
              <p className="error-text">{summaryError}</p>
            ) : !summary ||
              !summary.data ||
              summary.data.members.length === 0 ? (
              <p className="text-sm">No members or no data for this month.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Meals</th>
                      <th>Guest meals</th>
                      <th>Meal cost</th>
                      <th>Fixed bills</th>
                      <th>Payments</th>
                      <th>Total</th>
                      <th>Net due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.members.map((m) => {
                      const totalMeals = m.totalMeals || 0;
                      const totalGuestMeals = m.totalGuestMeals || 0;
                      const mealCost = m.mealCost || 0;
                      const fixed = m.fixedBills?.totalFixed || 0;
                      const payments = m.paymentsTotal || 0;
                      const total = m.totalBeforePayments || 0;
                      const netDue = m.netDue || 0;

                      const netLabel =
                        netDue > 0
                          ? `Due: ${formatMoney(netDue)}`
                          : netDue < 0
                          ? `Advance: ${formatMoney(Math.abs(netDue))}`
                          : "Settled";

                      return (
                        <tr key={m.membershipId}>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {m.user?.name || "Unknown"}
                            </div>
                            <div className="text-sm">{m.user?.email || ""}</div>
                          </td>
                          <td>{totalMeals}</td>
                          <td>{totalGuestMeals}</td>
                          <td>{formatMoney(mealCost)}</td>
                          <td>{formatMoney(fixed)}</td>
                          <td>{formatMoney(payments)}</td>
                          <td>{formatMoney(total)}</td>
                          <td className={amountClass(netDue)}>{netLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
};

export default SummaryPage;
