import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, BedDouble, Users, ImageOff, SlidersHorizontal, X } from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { money, fmtDay, localDay, num } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { useDebounced } from "../../lib/hooks";
import { AMENITIES, ROOM_TYPES, GENDER } from "../../lib/listing";
import { Stars } from "../../components/Stars";
import Nav from "../landing/Nav";
import { Footer } from "../landing/Showcases";
import "../../styles/landing.css";
import "../../styles/seats.css";

export function SeatCard({ l }) {
  const photo = l.photos?.[0];
  const t = useT();
  return (
    <Link to={`/seats/${l._id}`} className="lp-seat-card">
      <div className="lp-seat-photo">
        {photo ? <img src={assetUrl(photo)} alt="" loading="lazy" /> : <div className="lp-seat-nophoto"><ImageOff size={22} /></div>}
        <span className="lp-seat-price"><b>{money(l.rent, l.home.currency).replace(/[.][0০]{2}(?=\D*$)/, "")}</b> {t("listings.perMonth")}</span>
        {l.photos?.length > 1 && <span className="lp-seat-count">{num(1)}/{num(l.photos.length)}</span>}
      </div>
      <div className="lp-seat-body">
        <div className="lp-seat-row">
          <span className="lp-seat-area"><MapPin size={13} /> {l.area}, {l.city}</span>
          <Stars value={l.rating.avg || 0} size={12} showValue count={l.rating.count} />
        </div>
        <h3>{l.title}</h3>
        <div className="lp-seat-tags">
          <span><BedDouble size={13} /> {ROOM_TYPES[l.roomType]}</span>
          <span><Users size={13} /> {t("listings.seatsN", { count: l.seats })}</span>
          {l.gender !== "any" && <span>{GENDER[l.gender]}</span>}
        </div>
        <div className="lp-seat-foot">
          <span className="lp-seat-amen">
            {l.amenities.slice(0, 5).map((a) => {
              const A = AMENITIES[a];
              return A ? <span key={a} title={A.label} aria-label={A.label} role="img"><A.icon size={14} aria-hidden /></span> : null;
            })}
            {l.amenities.length > 5 && <small>+{num(l.amenities.length - 5)}</small>}
          </span>
          <small>{l.availableFrom <= localDay() ? t("seats.availableNow") : t("seats.fromDay", { day: fmtDay(l.availableFrom) })}</small>
        </div>
      </div>
    </Link>
  );
}

export default function SeatSearch() {
  const [params, setParams] = useSearchParams();
  const t = useT();
  const [q, setQ] = useState(params.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);
  const dq = useDebounced(q, 350);
  const filters = {
    q: dq,
    city: params.get("city") || "",
    maxRent: params.get("maxRent") || "",
    gender: params.get("gender") || "",
    roomType: params.get("roomType") || "",
    amenities: params.get("amenities") || "",
    sort: params.get("sort") || "newest",
    page: params.get("page") || 1,
  };
  const { data, isLoading, isError } = useQuery({ queryKey: ["public-listings", filters], queryFn: () => api.get("/public/listings", filters), placeholderData: (p) => p });
  const set = (k, v) => {
    const next = Object.fromEntries(params);
    if (v) next[k] = v;
    else delete next[k];
    if (k !== "page") delete next.page;
    setParams(next, { replace: true });
  };
  const amen = filters.amenities ? filters.amenities.split(",") : [];
  const toggleAmen = (a) => set("amenities", (amen.includes(a) ? amen.filter((x) => x !== a) : [...amen, a]).join(","));
  const activeCount = ["city", "maxRent", "gender", "roomType"].filter((k) => filters[k]).length + amen.length;

  return (
    <div className="lp">
      <Nav />
      <main className="lp-seats">
        <div className="lp-wrap">
          <header className="lp-seats-head">
            <span className="lp-kicker">{t("shell.findSeat")}</span>
            <h1 className="lp-h2" style={{ marginTop: 12 }}>{t("seats.titleBefore")}<span className="lp-serif lp-brandword">{t("seats.titleWord")}</span>{t("seats.titleAfter")}</h1>
            <p className="lp-lead">{t("seats.lead")}</p>
          </header>

          <div className="lp-seat-search">
            <label className="lp-seat-input">
              <Search size={18} />
              <input value={q} onChange={(e) => { setQ(e.target.value); set("q", e.target.value); }} placeholder={t("seats.searchPlaceholder")} aria-label={t("seats.searchLabel")} />
              {q && <button type="button" onClick={() => { setQ(""); set("q", ""); }} aria-label={t("seats.clearSearch")}><X size={16} /></button>}
            </label>
            <button type="button" className="lp-btn lp-btn-ghost" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <SlidersHorizontal /> {t("seats.filters")}{activeCount ? ` · ${num(activeCount)}` : ""}
            </button>
            <select className="lp-seat-select" value={filters.sort} onChange={(e) => set("sort", e.target.value)} aria-label={t("seats.sort")}>
              <option value="newest">{t("seats.newest")}</option>
              <option value="rent_asc">{t("seats.rentAsc")}</option>
              <option value="rent_desc">{t("seats.rentDesc")}</option>
            </select>
          </div>

          {showFilters && (
            <div className="lp-seat-filters">
              <label>{t("listings.city")}<input value={filters.city} onChange={(e) => set("city", e.target.value)} placeholder={t("listings.cityPlaceholder")} /></label>
              <label>{t("seats.maxRent")}<input inputMode="numeric" value={filters.maxRent} onChange={(e) => set("maxRent", e.target.value.replace(/\D/g, ""))} placeholder="6000" /></label>
              <label>{t("seats.for")}
                <select value={filters.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">{t("listing.gender.any")}</option><option value="male">{t("seats.male")}</option><option value="female">{t("seats.female")}</option>
                </select>
              </label>
              <label>{t("seats.room")}
                <select value={filters.roomType} onChange={(e) => set("roomType", e.target.value)}>
                  <option value="">{t("seats.any")}</option>
                  {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <div className="lp-seat-amenpick">
                {Object.entries(AMENITIES).map(([k, a]) => (
                  <button type="button" key={k} aria-pressed={amen.includes(k)} onClick={() => toggleAmen(k)}><a.icon size={14} /> {a.label}</button>
                ))}
              </div>
              {activeCount > 0 && <button type="button" className="lp-navlink" onClick={() => setParams({})}>{t("seats.clearAll")}</button>}
            </div>
          )}

          <p className="lp-seat-total">{isLoading ? t("seats.searching") : isError ? t("seats.loadError") : t("seats.total", { count: data.total })}</p>

          {data?.listings?.length === 0 ? (
            <div className="lp-seat-empty">
              <h3>{t("seats.noneTitle")}</h3>
              <p>{t("seats.noneHint")} <Link to="/register">{t("seats.listFree")}</Link></p>
            </div>
          ) : (
            <div className="lp-seat-grid">
              {(data?.listings || []).map((l) => <SeatCard key={l._id} l={l} />)}
              {isLoading && !data && [0, 1, 2].map((i) => <div key={i} className="lp-seat-card skeleton" style={{ height: 340 }} />)}
            </div>
          )}

          {data?.pages > 1 && (
            <div className="lp-hero-ctas" style={{ justifyContent: "center" }}>
              <button className="lp-btn lp-btn-ghost lp-btn-sm" disabled={data.page <= 1} onClick={() => set("page", data.page - 1)}>{t("common.previous")}</button>
              <span className="lp-seat-total" style={{ margin: 0, alignSelf: "center" }}>{t("seats.page", { page: data.page, pages: data.pages })}</span>
              <button className="lp-btn lp-btn-ghost lp-btn-sm" disabled={data.page >= data.pages} onClick={() => set("page", data.page + 1)}>{t("common.next")}</button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
