// src/pages/MealsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MealsPage = () => {
  const { familyId } = useParams();
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState("");
  const [familyLoading, setFamilyLoading] = useState(true);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  const [mealForm, setMealForm] = useState({
    date: today.toISOString().slice(0, 10),
    breakfast: true,
    lunch: true,
    dinner: false,
  });
  const [mealLoading, setMealLoading] = useState(false);
  const [mealMessage, setMealMessage] = useState("");
  const [mealError, setMealError] = useState("");

  const [guestForm, setGuestForm] = useState({
    date: today.toISOString().slice(0, 10),
    breakfastGuests: "",
    lunchGuests: "",
    dinnerGuests: "",
  });
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestMessage, setGuestMessage] = useState("");
  const [guestError, setGuestError] = useState("");

  const [myMeals, setMyMeals] = useState([]);
  const [myMealsChart, setMyMealsChart] = useState([]);
  const [myMealsLoading, setMyMealsLoading] = useState(true);

  const [myGuestMeals, setMyGuestMeals] = useState([]);
  const [myGuestChart, setMyGuestChart] = useState([]);
  const [myGuestLoading, setMyGuestLoading] = useState(true);

  const [summary, setSummary] = useState(null);
  const [guestSummary, setGuestSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [activeTab, setActiveTab] = useState("my"); // "my" | "family"

  // fetch family
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

  // fetch members
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

  // my meals
  const loadMyMeals = async (y, m) => {
    setMyMealsLoading(true);
    try {
      const res = await api.get(
        `/meals/my?familyId=${familyId}&year=${y}&month=${m}`
      );
      setMyMeals(res.data?.meals || []);
      setMyMealsChart(res.data?.chart || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMyMealsLoading(false);
    }
  };

  // my guest meals
  const loadMyGuestMeals = async (y, m) => {
    setMyGuestLoading(true);
    try {
      const res = await api.get(
        `/guest-meals/my?familyId=${familyId}&year=${y}&month=${m}`
      );
      setMyGuestMeals(res.data?.guestMeals || []);
      setMyGuestChart(res.data?.chart || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMyGuestLoading(false);
    }
  };

  // family summaries (if admin/manager)
  const loadSummaries = async (y, m) => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const [resMeals, resGuest] = await Promise.all([
        api.get(
          `/meals/family-summary?familyId=${familyId}&year=${y}&month=${m}`
        ),
        api.get(
          `/guest-meals/family-summary?familyId=${familyId}&year=${y}&month=${m}`
        ),
      ]);
      setSummary(resMeals.data);
      setGuestSummary(resGuest.data);
    } catch (err) {
      setSummaryError(err.message);
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
    loadMyMeals(year, month);
    loadMyGuestMeals(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, year, month]);

  // my membership
  const myMembership = useMemo(
    () => members.find((m) => m.user?._id === user?._id),
    [members, user]
  );
  const isAdmin = myMembership?.roles?.includes("admin");
  const isManager = myMembership?.roles?.includes("manager");
  const canViewFamilySummary = isAdmin || isManager;

  useEffect(() => {
    if (canViewFamilySummary) {
      loadSummaries(year, month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, year, month, canViewFamilySummary]);

  const handleMealFormChange = (e) => {
    const { name, type, checked, value } = e.target;
    setMealForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleGuestFormChange = (e) => {
    const { name, value } = e.target;
    setGuestForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveMeals = async (e) => {
    e.preventDefault();
    setMealError("");
    setMealMessage("");
    setMealLoading(true);
    try {
      await api.post("/meals", {
        familyId,
        date: mealForm.date,
        breakfast: mealForm.breakfast,
        lunch: mealForm.lunch,
        dinner: mealForm.dinner,
      });
      setMealMessage("Meal entry saved.");
      await loadMyMeals(year, month);
    } catch (err) {
      setMealError(err.message);
    } finally {
      setMealLoading(false);
    }
  };

  const handleSaveGuestMeals = async (e) => {
    e.preventDefault();
    setGuestError("");
    setGuestMessage("");
    setGuestLoading(true);
    try {
      await api.post("/guest-meals", {
        familyId,
        date: guestForm.date,
        breakfastGuests: guestForm.breakfastGuests
          ? Number(guestForm.breakfastGuests)
          : 0,
        lunchGuests: guestForm.lunchGuests ? Number(guestForm.lunchGuests) : 0,
        dinnerGuests: guestForm.dinnerGuests
          ? Number(guestForm.dinnerGuests)
          : 0,
      });
      setGuestMessage("Guest meal entry saved.");
      await loadMyGuestMeals(year, month);
    } catch (err) {
      setGuestError(err.message);
    } finally {
      setGuestLoading(false);
    }
  };

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

  const buildCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0-6
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  };

  const mealsMap = useMemo(() => {
    const map = new Map();
    myMealsChart.forEach((item) => {
      map.set(item.date, item);
    });
    return map;
  }, [myMealsChart]);

  const guestMap = useMemo(() => {
    const map = new Map();
    myGuestChart.forEach((item) => {
      map.set(item.date, item);
    });
    return map;
  }, [myGuestChart]);

  const getMealLevelClass = (total) => {
    if (!total || total <= 0) return "";
    if (total === 1) return "level-1";
    if (total === 2) return "level-2";
    if (total === 3) return "level-3";
    return "level-4";
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
        Meals • Family code: <strong>{family.familyCode}</strong>
      </p>

      <div className="text-sm" style={{ marginBottom: "1.25rem" }}>
        <Link to={`/families/${familyId}`} className="link">
          Overview
        </Link>{" "}
        •{" "}
        <Link to={`/families/${familyId}/payments`} className="link">
          Payments
        </Link>{" "}
        • <span style={{ fontWeight: 600 }}>Meals</span>
      </div>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        {/* My meal form */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Today&apos;s meals</div>
                <div className="card-subtitle">
                  Set your meals for a specific day.
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveMeals}>
              <div className="form-group">
                <label htmlFor="meal-date">Date</label>
                <input
                  id="meal-date"
                  type="date"
                  name="date"
                  value={mealForm.date}
                  onChange={handleMealFormChange}
                />
              </div>

              <div className="form-group">
                <label>Meals</label>
                <div className="text-sm">
                  <label style={{ marginRight: "0.75rem" }}>
                    <input
                      type="checkbox"
                      name="breakfast"
                      checked={mealForm.breakfast}
                      onChange={handleMealFormChange}
                    />{" "}
                    Breakfast
                  </label>
                  <label style={{ marginRight: "0.75rem" }}>
                    <input
                      type="checkbox"
                      name="lunch"
                      checked={mealForm.lunch}
                      onChange={handleMealFormChange}
                    />{" "}
                    Lunch
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="dinner"
                      checked={mealForm.dinner}
                      onChange={handleMealFormChange}
                    />{" "}
                    Dinner
                  </label>
                </div>
              </div>

              {mealError && <div className="error-text">{mealError}</div>}
              {mealMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {mealMessage}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary mt-2"
                disabled={mealLoading}
              >
                {mealLoading ? "Saving..." : "Save meals"}
              </button>
            </form>
          </div>
        </div>

        {/* Guest meals form */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Guest meals</div>
                <div className="card-subtitle">
                  Add meals for guests (charged to you).
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGuestMeals}>
              <div className="form-group">
                <label htmlFor="guest-date">Date</label>
                <input
                  id="guest-date"
                  type="date"
                  name="date"
                  value={guestForm.date}
                  onChange={handleGuestFormChange}
                />
              </div>

              <div className="form-group">
                <label>Guests per meal</label>
                <div className="text-sm">
                  <div style={{ marginBottom: "0.35rem" }}>
                    <span style={{ display: "inline-block", width: 80 }}>
                      Breakfast:
                    </span>
                    <input
                      type="number"
                      min="0"
                      name="breakfastGuests"
                      value={guestForm.breakfastGuests}
                      onChange={handleGuestFormChange}
                      className="input-inline"
                    />
                  </div>
                  <div style={{ marginBottom: "0.35rem" }}>
                    <span style={{ display: "inline-block", width: 80 }}>
                      Lunch:
                    </span>
                    <input
                      type="number"
                      min="0"
                      name="lunchGuests"
                      value={guestForm.lunchGuests}
                      onChange={handleGuestFormChange}
                      className="input-inline"
                    />
                  </div>
                  <div>
                    <span style={{ display: "inline-block", width: 80 }}>
                      Dinner:
                    </span>
                    <input
                      type="number"
                      min="0"
                      name="dinnerGuests"
                      value={guestForm.dinnerGuests}
                      onChange={handleGuestFormChange}
                      className="input-inline"
                    />
                  </div>
                </div>
              </div>

              {guestError && <div className="error-text">{guestError}</div>}
              {guestMessage && (
                <div className="text-sm" style={{ color: "#16a34a" }}>
                  {guestMessage}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary mt-2"
                disabled={guestLoading}
              >
                {guestLoading ? "Saving..." : "Save guest meals"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Month controls */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <div>
            <div className="card-title">Monthly meal overview</div>
            <div className="card-subtitle">
              A quick view like a contribution graph.
            </div>
          </div>
          <div className="text-sm">
            <button
              className="btn btn-secondary"
              style={{ marginRight: "0.25rem" }}
              onClick={() => handleMonthChange("prev")}
            >
              ◀
            </button>
            <span>
              {year} - {String(month).padStart(2, "0")}
            </span>
            <button
              className="btn btn-secondary"
              style={{ marginLeft: "0.25rem" }}
              onClick={() => handleMonthChange("next")}
            >
              ▶
            </button>
          </div>
        </div>

        {myMealsLoading && myGuestLoading ? (
          <p className="text-sm">Loading meal data...</p>
        ) : (
          <>
            <div
              className="meal-grid"
              style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}
            >
              {DAYS_SHORT.map((d) => (
                <div
                  key={d}
                  className="meal-cell meal-cell-empty"
                  style={{ fontWeight: 600 }}
                >
                  {d}
                </div>
              ))}
              {buildCalendarDays().map((day, idx) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="meal-cell meal-cell-empty"
                    />
                  );
                }
                const dateStr = `${year}-${String(month).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const myMeal = mealsMap.get(dateStr);
                const myGuest = guestMap.get(dateStr);
                const totalMeals =
                  (myMeal?.totalMeals || 0) + (myGuest?.totalGuestMeals || 0);
                const levelClass = getMealLevelClass(totalMeals);

                return (
                  <div
                    key={dateStr}
                    className="meal-cell"
                    style={{
                      backgroundColor: totalMeals > 0 ? "#bfdbfe" : "#e5e7eb",
                    }}
                  >
                    <div className="meal-cell-day">{day}</div>
                    {totalMeals > 0 && (
                      <div
                        className="meal-cell-count"
                        style={{
                          fontSize: "0.7rem",
                          color: "#1d4ed8",
                        }}
                      >
                        {totalMeals} meal{totalMeals > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="meal-legend">
              <span>My meals + guest meals:</span>
              <span className="meal-legend-box" />
              <span className="meal-legend-box level-1" />
              <span className="meal-legend-box level-2" />
              <span className="meal-legend-box level-3" />
              <span className="meal-legend-box level-4" />
            </div>
          </>
        )}
      </div>

      {/* Family summary for admins/managers */}
      {canViewFamilySummary && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Family meals summary</div>
              <div className="card-subtitle">
                Total meals and guest meals per member ({year}-
                {String(month).padStart(2, "0")}).
              </div>
            </div>
            <span className="badge">Admin / Manager</span>
          </div>

          {summaryError && <div className="error-text">{summaryError}</div>}
          {summaryLoading ? (
            <p className="text-sm">Loading summary...</p>
          ) : !summary ||
            !summary.data ||
            summary.data.members?.length === 0 ? (
            <p className="text-sm">No meal data for this month.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Total meals</th>
                    <th>Breakfast</th>
                    <th>Lunch</th>
                    <th>Dinner</th>
                    <th>Guest meals</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.members.map((m) => {
                    // guestSummary: match by membershipId
                    const gm = guestSummary?.data?.members?.find(
                      (g) => g.membershipId === m.membershipId
                    );
                    return (
                      <tr key={m.membershipId}>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {m.user?.name || "Unknown"}
                          </div>
                          <div className="text-sm">{m.user?.email || ""}</div>
                        </td>
                        <td>{m.totalMeals}</td>
                        <td>{m.breakfastCount}</td>
                        <td>{m.lunchCount}</td>
                        <td>{m.dinnerCount}</td>
                        <td>{gm?.totalGuestMeals || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default MealsPage;
