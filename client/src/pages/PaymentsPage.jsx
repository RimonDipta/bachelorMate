// src/pages/PaymentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

const PaymentsPage = () => {
  const { familyId } = useParams();
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState("");
  const [familyLoading, setFamilyLoading] = useState(true);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");

  const [myPayments, setMyPayments] = useState([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState("");

  const [familyPayments, setFamilyPayments] = useState([]);
  const [familyPaymentsLoading, setFamilyPaymentsLoading] = useState(true);
  const [familyPaymentsError, setFamilyPaymentsError] = useState("");

  const [activeTab, setActiveTab] = useState("my"); // "my" | "family"
  const [createForm, setCreateForm] = useState({
    amount: "",
    method: "cash",
    description: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");

  const [processingPaymentId, setProcessingPaymentId] = useState(null);

  // Load family (name)
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

  // Load members to know roles
  const loadMembers = async () => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const res = await api.get(`/families/${familyId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      setMembersError(err.message);
    } finally {
      setMembersLoading(false);
    }
  };

  // Load my payments
  const loadMyPayments = async () => {
    setMyLoading(true);
    setMyError("");
    try {
      const res = await api.get(
        `/payments/my?familyId=${encodeURIComponent(familyId)}`
      );
      setMyPayments(res.data || []);
    } catch (err) {
      setMyError(err.message);
    } finally {
      setMyLoading(false);
    }
  };

  // Load all family payments (for admins/managers)
  const loadFamilyPayments = async () => {
    setFamilyPaymentsLoading(true);
    setFamilyPaymentsError("");
    try {
      const res = await api.get(
        `/payments?familyId=${encodeURIComponent(familyId)}`
      );
      setFamilyPayments(res.data || []);
    } catch (err) {
      setFamilyPaymentsError(err.message);
    } finally {
      setFamilyPaymentsLoading(false);
    }
  };

  useEffect(() => {
    loadFamily();
    loadMembers();
    loadMyPayments();
    loadFamilyPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  // figure out my membership to know if I'm admin/manager
  const myMembership = useMemo(
    () => members.find((m) => m.user?._id === user?._id),
    [members, user]
  );

  const isAdmin = myMembership?.roles?.includes("admin");
  const isManager = myMembership?.roles?.includes("manager");
  const canModeratePayments = isAdmin || isManager;

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateMessage("");
    setCreateLoading(true);

    try {
      if (!createForm.amount) {
        throw new Error("Amount is required");
      }

      const amountNum = Number(createForm.amount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Amount must be a positive number");
      }

      await api.post("/payments", {
        familyId,
        amount: amountNum,
        method: createForm.method,
        description: createForm.description || undefined,
      });

      setCreateMessage("Payment created. Waiting for approval.");
      setCreateForm({
        amount: "",
        method: "cash",
        description: "",
      });

      await loadMyPayments();
      if (canModeratePayments) {
        await loadFamilyPayments();
      }
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    if (!canModeratePayments) return;
    setProcessingPaymentId(paymentId);
    try {
      await api.patch(`/payments/${paymentId}/approve`, {});
      await loadFamilyPayments();
      await loadMyPayments();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleReject = async (paymentId) => {
    if (!canModeratePayments) return;
    if (!window.confirm("Reject this payment?")) return;
    setProcessingPaymentId(paymentId);
    try {
      await api.patch(`/payments/${paymentId}/reject`, {});
      await loadFamilyPayments();
      await loadMyPayments();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
  };

  const formatStatusTag = (status) => {
    const s = (status || "").toLowerCase();
    let className = "tag tag-warning";
    if (s === "approved") className = "tag tag-success";
    if (s === "rejected") className = "tag tag-danger";
    return <span className={className}>{s}</span>;
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
        Payments • Family code: <strong>{family.familyCode}</strong>
      </p>

      <div className="text-sm" style={{ marginBottom: "1.25rem" }}>
        <Link to={`/families/${familyId}`} className="link">
          Overview
        </Link>{" "}
        • <span style={{ fontWeight: 600 }}>Payments</span>
      </div>

      {/* Create payment card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Add a payment</div>
            <div className="card-subtitle">
              Add your own payment. Managers/admins will approve it.
            </div>
          </div>
        </div>

        <form onSubmit={handleCreatePayment}>
          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              value={createForm.amount}
              onChange={handleCreateChange}
              placeholder="e.g. 3000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="method">Payment method</label>
            <select
              id="method"
              name="method"
              value={createForm.method}
              onChange={handleCreateChange}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "0.95rem",
                backgroundColor: "#f9fafb",
              }}
            >
              <option value="cash">Cash</option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <input
              id="description"
              name="description"
              type="text"
              value={createForm.description}
              onChange={handleCreateChange}
              placeholder="e.g. Rent, meal advance, etc."
            />
          </div>

          {createError && <div className="error-text">{createError}</div>}
          {createMessage && (
            <div className="text-sm" style={{ color: "#16a34a" }}>
              {createMessage}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary mt-2"
            disabled={createLoading}
          >
            {createLoading ? "Saving..." : "Add payment"}
          </button>
        </form>
      </div>

      {/* Tabs for my vs family payments */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Payments</div>
            <div className="card-subtitle">
              View your payments
              {canModeratePayments ? " and manage others" : ""}.
            </div>
          </div>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === "my" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("my")}
            >
              My payments
            </button>
            {canModeratePayments && (
              <button
                type="button"
                className={`tab ${activeTab === "family" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("family")}
              >
                Family payments
              </button>
            )}
          </div>
        </div>

        {/* My payments */}
        {activeTab === "my" && (
          <>
            {myError && <div className="error-text">{myError}</div>}
            {myLoading ? (
              <p className="text-sm">Loading my payments...</p>
            ) : myPayments.length === 0 ? (
              <p className="text-sm">You haven’t added any payments yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Description</th>
                      <th>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayments.map((p) => (
                      <tr key={p._id}>
                        <td>{p.amount}</td>
                        <td className="text-sm">{p.method}</td>
                        <td>{formatStatusTag(p.status)}</td>
                        <td className="text-sm">
                          {p.description || (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                        <td className="text-sm">{formatDate(p.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Family payments (admin/manager only) */}
        {activeTab === "family" && canModeratePayments && (
          <>
            {familyPaymentsError && (
              <div className="error-text">{familyPaymentsError}</div>
            )}
            {familyPaymentsLoading ? (
              <p className="text-sm">Loading family payments...</p>
            ) : familyPayments.length === 0 ? (
              <p className="text-sm">No payments recorded yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Description</th>
                      <th>Paid at</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyPayments.map((p) => {
                      const memberUser = p.membership?.user;
                      const isPending = p.status === "pending";

                      return (
                        <tr key={p._id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {memberUser?.name || "Unknown"}
                            </div>
                            <div className="text-sm">
                              {memberUser?.email || ""}{" "}
                            </div>
                          </td>
                          <td>{p.amount}</td>
                          <td className="text-sm">{p.method}</td>
                          <td>{formatStatusTag(p.status)}</td>
                          <td className="text-sm">
                            {p.description || (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            )}
                          </td>
                          <td className="text-sm">{formatDate(p.paidAt)}</td>
                          <td>
                            {isPending ? (
                              <div className="text-sm">
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginRight: "0.25rem" }}
                                  onClick={() => handleApprove(p._id)}
                                  disabled={processingPaymentId === p._id}
                                >
                                  {processingPaymentId === p._id
                                    ? "Approving..."
                                    : "Approve"}
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => handleReject(p._id)}
                                  disabled={processingPaymentId === p._id}
                                >
                                  {processingPaymentId === p._id
                                    ? "Rejecting..."
                                    : "Reject"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default PaymentsPage;
