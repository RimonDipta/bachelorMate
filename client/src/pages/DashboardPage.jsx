// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api";

const DashboardPage = () => {
  const { user } = useAuth();

  const [families, setFamilies] = useState([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [familyError, setFamilyError] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    homeRent: "",
    wifiBill: "",
    waterBill: "",
    dustBill: "",
    electricityBill: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [joinCodeMessage, setJoinCodeMessage] = useState("");
  const [joinCodeError, setJoinCodeError] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

  const loadFamilies = async () => {
    setLoadingFamilies(true);
    setFamilyError("");
    try {
      const res = await api.get("/families/my");
      setFamilies(res.data || []);
    } catch (err) {
      setFamilyError(err.message);
    } finally {
      setLoadingFamilies(false);
    }
  };

  useEffect(() => {
    loadFamilies();
  }, []);

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateMessage("");
    setFamilyError("");

    try {
      const { name, homeRent, wifiBill, waterBill, dustBill, electricityBill } =
        createForm;

      if (!name.trim()) {
        throw new Error("Family name is required");
      }

      const billConfig = {
        homeRent: homeRent ? Number(homeRent) : 0,
        wifiBill: wifiBill ? Number(wifiBill) : 0,
        waterBill: waterBill ? Number(waterBill) : 0,
        dustBill: dustBill ? Number(dustBill) : 0,
        electricityBill: electricityBill ? Number(electricityBill) : 0,
      };

      const res = await api.post("/families", {
        name: name.trim(),
        billConfig,
      });

      setCreateMessage("Family created successfully!");
      setCreateForm({
        name: "",
        homeRent: "",
        wifiBill: "",
        waterBill: "",
        dustBill: "",
        electricityBill: "",
      });

      // add to list or reload
      await loadFamilies();
    } catch (err) {
      setFamilyError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    setJoinCodeLoading(true);
    setJoinCodeError("");
    setJoinCodeMessage("");

    try {
      if (!joinCode.trim()) {
        throw new Error("Family code is required");
      }

      await api.post("/families/join", {
        familyCode: joinCode.trim(),
      });

      setJoinCodeMessage("Join request sent! Waiting for approval.");
      setJoinCode("");
      await loadFamilies();
    } catch (err) {
      setJoinCodeError(err.message);
    } finally {
      setJoinCodeLoading(false);
    }
  };

  const handleJoinByInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteMessage("");

    try {
      if (!inviteCode.trim()) {
        throw new Error("Invite code is required");
      }

      await api.post("/families/join-by-invite", {
        inviteCode: inviteCode.trim(),
      });

      setInviteMessage("Join request sent! Waiting for approval.");
      setInviteCode("");
      await loadFamilies();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const formatRoles = (roles) => {
    if (!roles || roles.length === 0) return "member";
    return roles.join(", ");
  };

  return (
    <Layout>
      <h1
        style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}
      >
        Dashboard
      </h1>
      <p className="text-sm" style={{ marginBottom: "1.5rem" }}>
        Logged in as <strong>{user?.name}</strong> ({user?.email})
      </p>

      <div className="grid-2">
        {/* Left side: families list */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Your Families</div>
                <div className="card-subtitle">
                  See the houses you are part of.
                </div>
              </div>
            </div>

            {familyError && <div className="error-text">{familyError}</div>}

            {loadingFamilies ? (
              <p className="text-sm">Loading families...</p>
            ) : families.length === 0 ? (
              <p className="text-sm">
                You’re not in any family yet. Create one or join using a code.
              </p>
            ) : (
              <ul style={{ listStyle: "none", marginTop: "0.5rem" }}>
                {families.map((m) => (
                  <li
                    key={m._id}
                    style={{
                      padding: "0.7rem 0",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div className="flex flex-between">
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {m.family?.name || "Unnamed family"}
                        </div>
                        <div
                          className="text-sm"
                          style={{ marginTop: "0.15rem" }}
                        >
                          Roles: {formatRoles(m.roles)} • Status:{" "}
                          <span
                            style={{
                              textTransform: "capitalize",
                              color:
                                m.status === "approved"
                                  ? "#16a34a"
                                  : m.status === "pending"
                                  ? "#d97706"
                                  : "#dc2626",
                            }}
                          >
                            {m.status}
                          </span>
                        </div>
                        {m.family && (
                          <div
                            className="text-sm"
                            style={{ marginTop: "0.25rem" }}
                          >
                            <span className="chip">
                              Family code: {m.family.familyCode}
                            </span>
                            <span className="chip">
                              Invite code: {m.family.inviteCode}
                            </span>
                          </div>
                        )}
                      </div>

                      {m.family && (
                        <div>
                          <Link to={`/families/${m.family._id}`}>
                            <button className="btn btn-secondary">Open</button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right side: create & join forms */}
        <div>
          {/* Create family */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Create a new family</div>
                <div className="card-subtitle">
                  You will become admin of this house.
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateFamily}>
              <div className="form-group">
                <label htmlFor="family-name">Family name</label>
                <input
                  id="family-name"
                  name="name"
                  type="text"
                  placeholder="House 21 Bashundhara"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  required
                />
              </div>

              <div className="text-sm" style={{ marginBottom: "0.5rem" }}>
                Fixed monthly bills (optional now, can edit later):
              </div>

              <div className="form-group">
                <label htmlFor="homeRent">Home rent</label>
                <input
                  id="homeRent"
                  name="homeRent"
                  type="number"
                  min="0"
                  placeholder="25000"
                  value={createForm.homeRent}
                  onChange={handleCreateChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="wifiBill">Wifi bill</label>
                <input
                  id="wifiBill"
                  name="wifiBill"
                  type="number"
                  min="0"
                  placeholder="1200"
                  value={createForm.wifiBill}
                  onChange={handleCreateChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="waterBill">Water bill</label>
                <input
                  id="waterBill"
                  name="waterBill"
                  type="number"
                  min="0"
                  placeholder="500"
                  value={createForm.waterBill}
                  onChange={handleCreateChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dustBill">Dust bill</label>
                <input
                  id="dustBill"
                  name="dustBill"
                  type="number"
                  min="0"
                  placeholder="400"
                  value={createForm.dustBill}
                  onChange={handleCreateChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="electricityBill">Electricity bill</label>
                <input
                  id="electricityBill"
                  name="electricityBill"
                  type="number"
                  min="0"
                  placeholder="0 (update later)"
                  value={createForm.electricityBill}
                  onChange={handleCreateChange}
                />
              </div>

              {createMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {createMessage}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block mt-4"
                disabled={createLoading}
              >
                {createLoading ? "Creating..." : "Create family"}
              </button>
            </form>
          </div>

          {/* Join family */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Join a family</div>
                <div className="card-subtitle">
                  Use a 6-digit family code or invite code.
                </div>
              </div>
            </div>

            {/* Join by family code */}
            <form onSubmit={handleJoinByCode} style={{ marginBottom: "1rem" }}>
              <div className="form-group">
                <label htmlFor="joinCode">Family code (6 digits)</label>
                <input
                  id="joinCode"
                  name="joinCode"
                  type="text"
                  placeholder="e.g. 123456"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              {joinCodeError && (
                <div className="error-text">{joinCodeError}</div>
              )}
              {joinCodeMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {joinCodeMessage}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-secondary btn-block mt-2"
                disabled={joinCodeLoading}
              >
                {joinCodeLoading ? "Joining..." : "Join by family code"}
              </button>
            </form>

            {/* Join by invite code */}
            <form onSubmit={handleJoinByInvite}>
              <div className="form-group">
                <label htmlFor="inviteCode">Invite code</label>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  placeholder="Paste invite code here"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
              {inviteError && <div className="error-text">{inviteError}</div>}
              {inviteMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {inviteMessage}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-secondary btn-block mt-2"
                disabled={inviteLoading}
              >
                {inviteLoading ? "Joining..." : "Join by invite code"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
