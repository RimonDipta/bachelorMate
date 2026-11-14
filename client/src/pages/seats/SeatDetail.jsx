import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, BedDouble, Users, CalendarDays, Wallet, Utensils, UserRound, Send, ImageOff, ShieldCheck, Home as HomeIcon } from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { money, fmtDay, fmtDate, localDay, num, HOME_TYPES } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { AMENITIES, ROOM_TYPES, GENDER, OCCUPATION } from "../../lib/listing";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../../components/ui";
import { Stars } from "../../components/Stars";
import Nav from "../landing/Nav";
import { Footer } from "../landing/Showcases";
import "../../styles/landing.css";
import "../../styles/seats.css";

// Drop a zero fraction (৳4,500.00 → ৳4,500) in either script.
const whole = (s) => s.replace(/[.][0০]{2}(?=\D*$)/, "");

export function ReviewSummary({ summary }) {
  const t = useT();
  const max = Math.max(1, ...summary.distribution);
  return (
    <div className="lp-rev-summary">
      <div>
        <div className="lp-rev-big">{summary.avg ? num(Number(summary.avg.toFixed(1))) : "–"}</div>
        <Stars value={summary.avg || 0} size={15} />
        <small>{t("stars.reviews", { count: summary.count })}</small>
      </div>
      <div className="lp-rev-bars">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n}><span>{num(n)}</span><i><b style={{ width: `${(summary.distribution[n - 1] / max) * 100}%` }} /></i></div>
        ))}
      </div>
      {Object.values(summary.scores || {}).some(Boolean) && (
        <div className="lp-rev-scores">
          {["cleanliness", "food", "management", "value"].filter((k) => summary.scores[k]).map((k) => (
            <div key={k}><span>{t(`reviews.scores.${k}`)}</span><b>{num(Number(summary.scores[k].toFixed(1)))}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewItem({ r }) {
  const t = useT();
  return (
    <article className="lp-rev">
      <div className="lp-rev-head">
        <Avatar user={r.user} size={34} />
        <div>
          <b>{r.user?.name || t("seats.formerMember")}</b>
          <small>{r.stayedTo ? t("seats.formerMember") : t("seats.livesHere")} · {fmtDate(r.createdAt)}</small>
        </div>
        <Stars value={r.rating} size={13} />
      </div>
      <p>{r.body}</p>
      {r.reply?.body && <div className="lp-rev-reply"><b>{t("reviews.replyFromHome")}</b><p>{r.reply.body}</p></div>}
    </article>
  );
}

export default function SeatDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const { data, isLoading, error: loadError } = useQuery({ queryKey: ["public-listing", id], queryFn: () => api.get(`/public/listings/${id}`), retry: false });

  const contact = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const r = await api.post(`/listings/${id}/contact`, { message });
      navigate(`/friends/chat/${r.conversationId}`);
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") navigate(`/verify-email?next=${encodeURIComponent(`/seats/${id}`)}`);
      else setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const l = data?.listing;
  const cur = l?.home.currency;
  return (
    <div className="lp">
      <Nav />
      <main className="lp-seats">
        <div className="lp-wrap">
          <Link to="/seats" className="lp-navlink" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: -14 }}><ArrowLeft size={15} /> {t("seats.all")}</Link>
          {isLoading ? (
            <div className="skeleton" style={{ height: 420, borderRadius: 24, marginTop: 20 }} />
          ) : loadError ? (
            <div className="lp-seat-empty"><h3>{t("seats.unavailable")}</h3><p>{loadError.message}</p><Link to="/seats" className="lp-btn lp-btn-primary">{t("seats.browseOther")}</Link></div>
          ) : (
            <>
              <div className="lp-gallery">
                <div className="lp-gallery-main">
                  {l.photos.length ? <img src={assetUrl(l.photos[photo])} alt={t("seats.photoOf", { n: photo + 1, title: l.title })} /> : <div className="lp-seat-nophoto"><ImageOff size={30} /><span>{t("seats.noPhotos")}</span></div>}
                </div>
                {l.photos.length > 1 && (
                  <div className="lp-gallery-thumbs">
                    {l.photos.map((p, i) => (
                      <button key={p} type="button" aria-pressed={i === photo} onClick={() => setPhoto(i)} aria-label={t("seats.showPhoto", { n: i + 1 })}><img src={assetUrl(p)} alt="" loading="lazy" /></button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lp-detail-grid">
                <div className="lp-detail-main">
                  <span className="lp-seat-area"><MapPin size={14} /> {l.area}, {l.city}</span>
                  <h1 className="lp-detail-title">{l.title}</h1>
                  <div className="lp-seat-row" style={{ justifyContent: "flex-start", gap: 14 }}>
                    <Stars value={l.rating.avg || 0} size={15} showValue count={l.rating.count} />
                    <span className="lp-seat-area"><HomeIcon size={14} /> {l.home.name} · {HOME_TYPES[l.home.type] || t("seats.sharedHome")} · {t("seats.living", { count: l.home.memberCount })}</span>
                  </div>

                  <div className="lp-facts">
                    <div><BedDouble /><span>{t("seats.room")}</span><b>{ROOM_TYPES[l.roomType]}</b></div>
                    <div><Users /><span>{t("seats.seats")}</span><b>{t("seats.available", { count: l.seats })}</b></div>
                    <div><CalendarDays /><span>{t("seats.moveIn")}</span><b>{l.availableFrom <= localDay() ? t("seats.now") : fmtDay(l.availableFrom, { month: "short", day: "numeric", year: "numeric" })}</b></div>
                    <div><UserRound /><span>{t("seats.for")}</span><b>{GENDER[l.gender]}</b></div>
                  </div>

                  {l.description && <section className="lp-detail-sec"><h2>{t("seats.about")}</h2><p style={{ whiteSpace: "pre-wrap" }}>{l.description}</p><p className="lp-muted">{t("seats.bestFor", { who: OCCUPATION[l.occupation] })}</p></section>}

                  {l.amenities.length > 0 && (
                    <section className="lp-detail-sec">
                      <h2>{t("listings.included")}</h2>
                      <div className="lp-amen-grid">{l.amenities.map((a) => { const A = AMENITIES[a]; return A && <span key={a}><A.icon size={17} /> {A.label}</span>; })}</div>
                    </section>
                  )}

                  {l.home.rules?.length > 0 && (
                    <section className="lp-detail-sec"><h2>{t("homeSettings.houseRules")}</h2><ol className="lp-rules">{l.home.rules.map((r) => <li key={r}>{r}</li>)}</ol></section>
                  )}

                  <section className="lp-detail-sec">
                    <h2>{t("seats.reviewsTitle")}</h2>
                    {data.reviews.summary.count === 0 ? (
                      <p className="lp-muted">{t("seats.noReviews")}</p>
                    ) : (
                      <>
                        <ReviewSummary summary={data.reviews.summary} />
                        <div className="lp-rev-list">{data.reviews.items.map((r) => <ReviewItem key={r._id} r={r} />)}</div>
                      </>
                    )}
                  </section>
                </div>

                <aside className="lp-detail-side">
                  <div className="lp-contact">
                    <div className="lp-contact-price"><b>{whole(money(l.rent, cur))}</b><span>{t("listings.perMonth")}</span></div>
                    <div className="lp-contact-rows">
                      <div><Wallet size={15} /> {t("seats.deposit")} <b>{l.deposit ? whole(money(l.deposit, cur)) : t("seats.none")}</b></div>
                      {l.mealCostEstimate ? <div><Utensils size={15} /> {t("seats.meals")} ≈ <b>{whole(money(l.mealCostEstimate, cur))}{t("listings.perMonth")}</b></div> : null}
                    </div>
                    <div className="lp-contact-poster"><Avatar user={l.postedBy} size={36} /><div><small>{t("seats.postedBy")}</small><b>{l.postedBy?.name}</b></div></div>
                    {!user ? (
                      <Link to={`/login?next=${encodeURIComponent(`/seats/${id}`)}`} className="lp-btn lp-btn-primary" style={{ width: "100%" }}>{t("seats.loginToContact")}</Link>
                    ) : String(user._id) === String(l.postedBy?._id) ? (
                      <p className="lp-muted">{t("seats.yours")}</p>
                    ) : (
                      <form onSubmit={contact} className="lp-contact-form">
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={4} placeholder={t("seats.messagePlaceholder")} aria-label={t("seats.messageLabel")} />
                        {error && <p className="lp-contact-err">{error}</p>}
                        <button type="submit" className="lp-btn lp-btn-primary" style={{ width: "100%" }} disabled={sending || message.trim().length < 5}><Send /> {sending ? t("seats.sending") : t("seats.send")}</button>
                      </form>
                    )}
                    <p className="lp-contact-note"><ShieldCheck size={14} /> {t("seats.safety")}</p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
