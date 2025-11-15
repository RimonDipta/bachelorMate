// src/pages/FamilyPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

const FamilyPage = () => {
  const { familyId } = useParams();
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState("");
  const [membersError, setMembersError] = useState("");

  const [billForm, setBillForm] = useState({
    homeRent: "",
    wifiBill: "",
    waterBill: "",
    dustBill: "",
    electricityBill: "",
  });
  const [billSaving, setBillSaving] = useState(false);
  const [billMessage, setBillMessage] = useState("");

  const [rolesSavingId, setRolesSavingId] = useState(null);
  const [kickProcessingId, setKickProcessingId] = useState(null);
  const [approveProcessingId, setApproveProcessingId] = useState(null);

  // Load family
  const loadFamily = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/families/${familyId}`);
      setFamily(res.data);
      const bc = res.data.billConfig || {};
      setBillForm({
        homeRent: bc.homeRent ?? "",
        wifiBill: bc.wifiBill ?? "",
        waterBill: bc.waterBill ?? "",
        dustBill: bc.dustBill ?? "",
        electricityBill: bc.electricityBill ?? "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load members
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

  useEffect(() => {
    loadFamily();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  // Determine my membership in this family (to know if admin/manager)
  const myMembership = useMemo(
    () => members.find((m) => m.user?._id === user?._id),
    [members, user]
  );

  const isAdmin = myMembership?.roles?.includes("admin");
  const isManager = myMembership?.roles?.includes("manager");
  const canManageMembers = isAdmin || isManager;
  const canEditBills = isAdmin; // only admins

  const handleBillChange = (e) => {
    const { name, value } = e.target;
    setBillForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveBills = async (e) => {
    e.preventDefault();
    if (!canEditBills) return;
    setBillSaving(true);
    setBillMessage("");
    try {
      const payload = {};
      Object.entries(billForm).forEach(([key, value]) => {
        if (value !== "" && value !== null) {
          payload[key] = Number(value);
        }
      });

      const res = await api.patch(`/families/${familyId}/bill-config`, payload);

      setBillMessage("Bill configuration updated.");
      const updated = { ...family, billConfig: res.data };
      setFamily(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBillSaving(false);
    }
  };

  const handleRoleToggle = (membershipId, role) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m._id !== membershipId) return m;
        let roles = Array.isArray(m.roles) ? [...m.roles] : [];
        if (roles.includes(role)) {
          roles = roles.filter((r) => r !== role);
        } else {
          roles.push(role);
        }
        if (!roles.includes("member")) roles.push("member");
        return { ...m, roles };
      })
    );
  };

  const handleSaveRoles = async (membership) => {
    if (!isAdmin) return;
    setRolesSavingId(membership._id);
    try {
      const payload = { roles: membership.roles };
      const res = await api.patch(
        `/families/${familyId}/members/${membership._id}/roles`,
        payload
      );
      setMembers((prev) =>
        prev.map((m) => (m._id === membership._id ? res.data : m))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setRolesSavingId(null);
    }
  };

  const handleApprove = async (membership) => {
    if (!canManageMembers) return;
    setApproveProcessingId(membership._id);
    try {
      const res = await api.patch(
        `/families/${familyId}/members/${membership._id}/approve`,
        {}
      );
      setMembers((prev) =>
        prev.map((m) => (m._id === membership._id ? res.data : m))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setApproveProcessingId(null);
    }
  };

  const handleKick = async (membership) => {
    if (!canManageMembers) return;
    if (!window.confirm(`Kick ${membership.user?.name || "this member"}?`)) {
      return;
    }
    setKickProcessingId(membership._id);
    try {
      const res = await api.patch(
        `/families/${familyId}/members/${membership._id}/kick`,
        {}
      );
      setMembers((prev) =>
        prev.map((m) => (m._id === membership._id ? res.data : m))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setKickProcessingId(null);
    }
  };

  const formatMoney = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    return Number(value);
  };

  if (loading) {
    return (
      <Layout>
        <p>Loading family...</p>
      </Layout>
    );
  }

  if (error || !family) {
    return (
      <Layout>
        <p className="error-text">Error: {error || "Family not found"}</p>
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
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}
      >
        {family.name}
      </h1>
      <p className="text-sm" style={{ marginBottom: "0.5rem" }}>
        Family code: <strong>{family.familyCode}</strong> • Invite code:{" "}
        <strong>{family.inviteCode}</strong>
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
        •{" "}
        <Link to={`/families/${familyId}/summary`} className="link">
          Summary
        </Link>
      </div>

      {myMembership && (
        <p className="text-sm" style={{ marginBottom: "1.5rem" }}>
          Your roles: {myMembership.roles.join(", ")} • Status:{" "}
          <span
            style={{
              textTransform: "capitalize",
              color:
                myMembership.status === "approved"
                  ? "#16a34a"
                  : myMembership.status === "pending"
                  ? "#d97706"
                  : "#dc2626",
            }}
          >
            {myMembership.status}
          </span>
        </p>
      )}
      <div className="grid-2">
        {/* Left: bill config */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Bill configuration</div>
                <div className="card-subtitle">
                  Fixed monthly bills shared among members.
                </div>
              </div>
              {canEditBills ? (
                <span className="badge">Admin</span>
              ) : (
                <span className="badge tag-warning">View only</span>
              )}
            </div>

            <form onSubmit={handleSaveBills}>
              <div className="form-group">
                <label htmlFor="homeRent">Home rent</label>
                <input
                  id="homeRent"
                  name="homeRent"
                  type="number"
                  className="input-inline"
                  min="0"
                  value={billForm.homeRent}
                  onChange={handleBillChange}
                  disabled={!canEditBills}
                />
              </div>

              <div className="form-group">
                <label htmlFor="wifiBill">Wifi bill</label>
                <input
                  id="wifiBill"
                  name="wifiBill"
                  type="number"
                  className="input-inline"
                  min="0"
                  value={billForm.wifiBill}
                  onChange={handleBillChange}
                  disabled={!canEditBills}
                />
              </div>

              <div className="form-group">
                <label htmlFor="waterBill">Water bill</label>
                <input
                  id="waterBill"
                  name="waterBill"
                  type="number"
                  className="input-inline"
                  min="0"
                  value={billForm.waterBill}
                  onChange={handleBillChange}
                  disabled={!canEditBills}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dustBill">Dust bill</label>
                <input
                  id="dustBill"
                  name="dustBill"
                  type="number"
                  className="input-inline"
                  min="0"
                  value={billForm.dustBill}
                  onChange={handleBillChange}
                  disabled={!canEditBills}
                />
              </div>

              <div className="form-group">
                <label htmlFor="electricityBill">Electricity bill</label>
                <input
                  id="electricityBill"
                  name="electricityBill"
                  type="number"
                  className="input-inline"
                  min="0"
                  value={billForm.electricityBill}
                  onChange={handleBillChange}
                  disabled={!canEditBills}
                />
              </div>

              {billMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {billMessage}
                </div>
              )}

              {canEditBills && (
                <button
                  type="submit"
                  className="btn btn-primary mt-2"
                  disabled={billSaving}
                >
                  {billSaving ? "Saving..." : "Save bills"}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right: members list */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Members</div>
                <div className="card-subtitle">
                  Approve, kick, and assign roles.
                </div>
              </div>
              {canManageMembers ? (
                <span className="badge">Admin / Manager</span>
              ) : (
                <span className="badge tag-warning">View only</span>
              )}
            </div>

            {membersError && <div className="error-text">{membersError}</div>}

            {membersLoading ? (
              <p className="text-sm">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-sm">No members yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Roles</th>
                      <th style={{ minWidth: "160px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const isSelf = m.user?._id === user?._id;
                      const isPending = m.status === "pending";
                      const isKicked = m.status === "kicked";

                      const roles = Array.isArray(m.roles) ? m.roles : [];
                      const hasRole = (role) => roles.includes(role);

                      return (
                        <tr key={m._id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {m.user?.name || "Unknown"}
                            </div>
                            <div className="text-sm">
                              {hasRole("admin") && (
                                <span className="tag tag-danger">Admin</span>
                              )}
                              {hasRole("manager") && (
                                <span className="tag">Manager</span>
                              )}
                              {hasRole("member") && (
                                <span className="tag tag-success">Member</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm">
                              {m.user?.email || "-"}
                            </div>
                            <div className="text-sm">{m.user?.phone || ""}</div>
                          </td>
                          <td>
                            <span
                              className={
                                isPending
                                  ? "tag tag-warning"
                                  : isKicked
                                  ? "tag tag-danger"
                                  : "tag tag-success"
                              }
                            >
                              {m.status}
                            </span>
                          </td>
                          <td>
                            {canManageMembers && !isKicked ? (
                              <div className="text-sm">
                                <label style={{ marginRight: "0.4rem" }}>
                                  <input
                                    type="checkbox"
                                    checked={hasRole("admin")}
                                    onChange={() =>
                                      handleRoleToggle(m._id, "admin")
                                    }
                                    disabled={!isAdmin || isSelf} // can't edit own admin flag easily here
                                  />{" "}
                                  Admin
                                </label>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={hasRole("manager")}
                                    onChange={() =>
                                      handleRoleToggle(m._id, "manager")
                                    }
                                    disabled={!isAdmin}
                                  />{" "}
                                  Manager
                                </label>
                              </div>
                            ) : (
                              <span className="text-sm">
                                {roles.join(", ")}
                              </span>
                            )}
                          </td>
                          <td>
                            {canManageMembers && !isKicked ? (
                              <div className="text-sm">
                                {isPending && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ marginBottom: "0.25rem" }}
                                    onClick={() => handleApprove(m)}
                                    disabled={
                                      approveProcessingId === m._id || isSelf
                                    }
                                  >
                                    {approveProcessingId === m._id
                                      ? "Approving..."
                                      : "Approve"}
                                  </button>
                                )}
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => handleSaveRoles(m)}
                                  disabled={rolesSavingId === m._id || !isAdmin}
                                  style={{
                                    marginLeft: "0.25rem",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  {rolesSavingId === m._id
                                    ? "Saving..."
                                    : "Save roles"}
                                </button>
                                {!isSelf && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ marginLeft: "0.25rem" }}
                                    onClick={() => handleKick(m)}
                                    disabled={kickProcessingId === m._id}
                                  >
                                    {kickProcessingId === m._id
                                      ? "Kicking..."
                                      : "Kick"}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FamilyPage;
