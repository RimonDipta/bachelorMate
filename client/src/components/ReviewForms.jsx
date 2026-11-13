import { useState } from "react";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { Avatar, Field, FormModal, Textarea } from "./ui";
import { Stars, StarInput } from "./Stars";
import { ROOMMATE_TAGS, NEGATIVE_TAGS } from "../lib/listing";
import { fmtDate } from "../lib/format";

const SCORES = [["cleanliness", "Cleanliness"], ["food", "Food"], ["management", "Management"], ["value", "Value for money"]];

export const HomeReviewModal = (props) => (props.open ? <HomeReviewForm {...props} /> : null);

function HomeReviewForm({ open, onClose, homeId, homeName, existing, invalidate = [] }) {
  const [f, setF] = useState(() => ({ rating: existing?.rating || 0, body: existing?.body || "", scores: { ...(existing?.scores || {}) } }));
  const save = useAction(() => api.post(`/reviews/homes/${homeId}`, { rating: f.rating, body: f.body.trim(), scores: Object.fromEntries(Object.entries(f.scores).filter(([, v]) => v)) }), {
    invalidate: [["reviews"], ...invalidate],
    success: existing ? "Review updated" : "Thanks for your review!",
    onSuccess: onClose,
  });
  return (
    <FormModal open={open} onClose={onClose} title={existing ? "Edit your review" : `Review ${homeName}`} description="Shown publicly with your name on this home's seat listings."
      submitLabel={existing ? "Update review" : "Post review"} loading={save.isPending} disabled={!f.rating || f.body.trim().length < 10} onSubmit={() => save.mutate()}>
      <Field label="Overall"><StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></Field>
      <div className="form-grid">
        {SCORES.map(([k, l]) => (
          <Field key={k} label={l} optional><StarInput size={18} value={f.scores[k] || 0} onChange={(v) => setF({ ...f, scores: { ...f.scores, [k]: v } })} label={l} /></Field>
        ))}
      </div>
      <Field label="Your experience" hint={`${f.body.trim().length}/2000 · at least 10 characters`}>
        <Textarea rows={5} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="What's it like living here? Food, people, how bills are handled…" />
      </Field>
    </FormModal>
  );
}

export const RoommateReviewModal = (props) => (props.open ? <RoommateReviewForm {...props} /> : null);

function RoommateReviewForm({ open, onClose, person, home, existing }) {
  const [f, setF] = useState(() => ({ rating: existing?.rating || 0, body: existing?.body || "", tags: existing?.tags || [] }));
  const save = useAction(() => api.post(`/reviews/users/${person._id}`, { homeId: home._id, rating: f.rating, body: f.body.trim(), tags: f.tags }), {
    invalidate: [["reviews"], ["profile-reviews", person._id]],
    success: "Review posted",
    onSuccess: onClose,
  });
  const toggle = (t) => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : f.tags.length < 6 ? [...f.tags, t] : f.tags });
  return (
    <FormModal open={open} onClose={onClose} title={`Review ${person.name}`} description={`As a roommate at ${home.name}. Shown on their profile.`}
      submitLabel="Post review" loading={save.isPending} disabled={!f.rating || f.body.trim().length < 10} onSubmit={() => save.mutate()}>
      <div className="row-3"><Avatar user={person} size={40} /><div><b>{person.name}</b><div className="text-xs muted">{home.name}</div></div></div>
      <Field label="Rating"><StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></Field>
      <Field label="Describe them" optional hint="Pick up to 6.">
        <div className="row wrap" style={{ gap: 6 }}>
          {Object.entries(ROOMMATE_TAGS).map(([k, l]) => (
            <button type="button" key={k} className={`tag-chip ${NEGATIVE_TAGS.has(k) ? "neg" : ""}`} aria-pressed={f.tags.includes(k)} onClick={() => toggle(k)}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Review" hint="Be fair and specific — this helps their future homes.">
        <Textarea rows={4} maxLength={1500} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </Field>
    </FormModal>
  );
}

/** Compact review card used in app pages. */
export function ReviewCard({ r, title, children }) {
  return (
    <div className="review-card">
      <div className="row-3">
        <Avatar user={r.user || r.reviewer} size={32} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong text-sm truncate">{title || (r.user || r.reviewer)?.name}</div>
          <div className="text-xs muted">{fmtDate(r.createdAt)}{r.home?.name ? ` · ${r.home.name}` : ""}{r.stayedTo === null ? " · lives here" : r.stayedTo ? " · former member" : ""}</div>
        </div>
        <Stars value={r.rating} size={13} />
      </div>
      {r.tags?.length > 0 && (
        <div className="row wrap" style={{ gap: 4 }}>
          {r.tags.map((t) => <span key={t} className={`badge ${NEGATIVE_TAGS.has(t) ? "badge-danger" : "badge-accent"}`}>{ROOMMATE_TAGS[t]}</span>)}
        </div>
      )}
      <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-2)", margin: 0 }}>{r.body}</p>
      {r.reply?.body && <div className="review-reply"><b className="text-xs" style={{ color: "var(--accent-text)" }}>Reply from the home{r.reply.by?.name ? ` · ${r.reply.by.name}` : ""}</b><div>{r.reply.body}</div></div>}
      {children}
    </div>
  );
}
