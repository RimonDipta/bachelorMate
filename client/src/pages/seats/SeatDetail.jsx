import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, BedDouble, Users, CalendarDays, Wallet, Utensils, UserRound, Send, ImageOff, ShieldCheck, Home as HomeIcon } from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { money, fmtDay, fmtDate, localDay, HOME_TYPES } from "../../lib/format";
import { AMENITIES, ROOM_TYPES, GENDER, OCCUPATION } from "../../lib/listing";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../../components/ui";
import { Stars } from "../../components/Stars";
import Nav from "../landing/Nav";
import { Footer } from "../landing/Showcases";
import "../../styles/landing.css";
import "../../styles/seats.css";

export function ReviewSummary({ summary }) {
  const max = Math.max(1, ...summary.distribution);
  return (
    <div className="lp-rev-summary">
      <div>
        <div className="lp-rev-big">{summary.avg ? summary.avg.toFixed(1) : "–"}</div>
        <Stars value={summary.avg || 0} size={15} />
        <small>{summary.count} review{summary.count === 1 ? "" : "s"}</small>
      </div>
      <div className="lp-rev-bars">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n}><span>{n}</span><i><b style={{ width: `${(summary.distribution[n - 1] / max) * 100}%` }} /></i></div>
        ))}
      </div>
      {Object.values(summary.scores || {}).some(Boolean) && (
        <div className="lp-rev-scores">
          {[["cleanliness", "Cleanliness"], ["food", "Food"], ["management", "Management"], ["value", "Value"]].filter(([k]) => summary.scores[k]).map(([k, l]) => (
            <div key={k}><span>{l}</span><b>{summary.scores[k].toFixed(1)}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewItem({ r }) {
  return (
    <article className="lp-rev">
      <div className="lp-rev-head">
        <Avatar user={r.user} size={34} />
        <div>
          <b>{r.user?.name || "Former member"}</b>
          <small>{r.stayedTo ? "Former member" : "Lives here"} · {fmtDate(r.createdAt)}</small>
        </div>
        <Stars value={r.rating} size={13} />
      </div>
      <p>{r.body}</p>
      {r.reply?.body && <div className="lp-rev-reply"><b>Reply from the home</b><p>{r.reply.body}</p></div>}
    </article>
  );
}

export default function SeatDetail() {
  const { id } = useParams();
  const { user } = useAuth();
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
          <Link to="/seats" className="lp-navlink" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: -14 }}><ArrowLeft size={15} /> All seats</Link>
          {isLoading ? (
            <div className="skeleton" style={{ height: 420, borderRadius: 24, marginTop: 20 }} />
          ) : loadError ? (
            <div className="lp-seat-empty"><h3>Listing not available</h3><p>{loadError.message}</p><Link to="/seats" className="lp-btn lp-btn-primary">Browse other seats</Link></div>
          ) : (
            <>
              <div className="lp-gallery">
                <div className="lp-gallery-main">
                  {l.photos.length ? <img src={assetUrl(l.photos[photo])} alt={`Photo ${photo + 1} of ${l.title}`} /> : <div className="lp-seat-nophoto"><ImageOff size={30} /><span>No photos yet</span></div>}
                </div>
                {l.photos.length > 1 && (
                  <div className="lp-gallery-thumbs">
                    {l.photos.map((p, i) => (
                      <button key={p} type="button" aria-pressed={i === photo} onClick={() => setPhoto(i)} aria-label={`Show photo ${i + 1}`}><img src={assetUrl(p)} alt="" loading="lazy" /></button>
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
                    <span className="lp-seat-area"><HomeIcon size={14} /> {l.home.name} · {HOME_TYPES[l.home.type] || "Shared home"} · {l.home.memberCount} living there</span>
                  </div>

                  <div className="lp-facts">
                    <div><BedDouble /><span>Room</span><b>{ROOM_TYPES[l.roomType]}</b></div>
                    <div><Users /><span>Seats</span><b>{l.seats} available</b></div>
                    <div><CalendarDays /><span>Move in</span><b>{l.availableFrom <= localDay() ? "Now" : fmtDay(l.availableFrom, { month: "short", day: "numeric", year: "numeric" })}</b></div>
                    <div><UserRound /><span>For</span><b>{GENDER[l.gender]}</b></div>
                  </div>

                  {l.description && <section className="lp-detail-sec"><h2>About this seat</h2><p style={{ whiteSpace: "pre-wrap" }}>{l.description}</p><p className="lp-muted">Best for: {OCCUPATION[l.occupation]}</p></section>}

                  {l.amenities.length > 0 && (
                    <section className="lp-detail-sec">
                      <h2>What's included</h2>
                      <div className="lp-amen-grid">{l.amenities.map((a) => { const A = AMENITIES[a]; return A && <span key={a}><A.icon size={17} /> {A.label}</span>; })}</div>
                    </section>
                  )}

                  {l.home.rules?.length > 0 && (
                    <section className="lp-detail-sec"><h2>House rules</h2><ol className="lp-rules">{l.home.rules.map((r) => <li key={r}>{r}</li>)}</ol></section>
                  )}

                  <section className="lp-detail-sec">
                    <h2>Reviews from people who lived here</h2>
                    {data.reviews.summary.count === 0 ? (
                      <p className="lp-muted">No reviews yet. Reviews come only from current and former members of this home.</p>
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
                    <div className="lp-contact-price"><b>{money(l.rent, cur).replace(/\.00$/, "")}</b><span>/ month</span></div>
                    <div className="lp-contact-rows">
                      <div><Wallet size={15} /> Deposit <b>{l.deposit ? money(l.deposit, cur).replace(/\.00$/, "") : "None"}</b></div>
                      {l.mealCostEstimate ? <div><Utensils size={15} /> Meals ≈ <b>{money(l.mealCostEstimate, cur).replace(/\.00$/, "")}/mo</b></div> : null}
                    </div>
                    <div className="lp-contact-poster"><Avatar user={l.postedBy} size={36} /><div><small>Posted by</small><b>{l.postedBy?.name}</b></div></div>
                    {!user ? (
                      <Link to={`/login?next=${encodeURIComponent(`/seats/${id}`)}`} className="lp-btn lp-btn-primary" style={{ width: "100%" }}>Log in to contact</Link>
                    ) : String(user._id) === String(l.postedBy?._id) ? (
                      <p className="lp-muted">This is your listing.</p>
                    ) : (
                      <form onSubmit={contact} className="lp-contact-form">
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={4} placeholder={`Hi! I'm interested in the seat. A bit about me…`} aria-label="Message to the poster" />
                        {error && <p className="lp-contact-err">{error}</p>}
                        <button type="submit" className="lp-btn lp-btn-primary" style={{ width: "100%" }} disabled={sending || message.trim().length < 5}><Send /> {sending ? "Sending…" : "Send message"}</button>
                      </form>
                    )}
                    <p className="lp-contact-note"><ShieldCheck size={14} /> Your message goes privately to the poster. Never pay before visiting.</p>
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
