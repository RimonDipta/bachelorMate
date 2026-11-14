import { useState } from "react";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { Avatar, Field, FormModal, Textarea } from "./ui";
import { Stars, StarInput } from "./Stars";
import { ROOMMATE_TAGS, NEGATIVE_TAGS } from "../lib/listing";
import { fmtDate } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

const SCORES = ["cleanliness", "food", "management", "value"];

export const HomeReviewModal = (props) => (props.open ? <HomeReviewForm {...props} /> : null);

function HomeReviewForm({ open, onClose, homeId, homeName, existing, invalidate = [] }) {
  const t = useT();
  const [f, setF] = useState(() => ({ rating: existing?.rating || 0, body: existing?.body || "", scores: { ...(existing?.scores || {}) } }));
  const save = useAction(() => api.post(`/reviews/homes/${homeId}`, { rating: f.rating, body: f.body.trim(), scores: Object.fromEntries(Object.entries(f.scores).filter(([, v]) => v)) }), {
    invalidate: [["reviews"], ...invalidate],
    success: existing ? t("reviews.updated") : t("reviews.thanks"),
    onSuccess: onClose,
  });
  return (
    <FormModal open={open} onClose={onClose} title={existing ? t("reviews.editTitle") : t("reviews.reviewOf", { name: homeName })} description={t("reviews.homeDesc")}
      submitLabel={existing ? t("reviews.update") : t("reviews.post")} loading={save.isPending} disabled={!f.rating || f.body.trim().length < 10} onSubmit={() => save.mutate()}>
      <Field label={t("reviews.overall")}><StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></Field>
      <div className="form-grid">
        {SCORES.map((k) => (
          <Field key={k} label={t(`reviews.scores.${k}`)} optional><StarInput size={18} value={f.scores[k] || 0} onChange={(v) => setF({ ...f, scores: { ...f.scores, [k]: v } })} label={t(`reviews.scores.${k}`)} /></Field>
        ))}
      </div>
      <Field label={t("reviews.experience")} hint={t("reviews.charCount", { n: f.body.trim().length })}>
        <Textarea rows={5} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={t("reviews.experiencePlaceholder")} />
      </Field>
    </FormModal>
  );
}

export const RoommateReviewModal = (props) => (props.open ? <RoommateReviewForm {...props} /> : null);

function RoommateReviewForm({ open, onClose, person, home, existing }) {
  const t = useT();
  const [f, setF] = useState(() => ({ rating: existing?.rating || 0, body: existing?.body || "", tags: existing?.tags || [] }));
  const save = useAction(() => api.post(`/reviews/users/${person._id}`, { homeId: home._id, rating: f.rating, body: f.body.trim(), tags: f.tags }), {
    invalidate: [["reviews"], ["profile-reviews", person._id]],
    success: t("reviews.posted"),
    onSuccess: onClose,
  });
  const toggle = (tag) => setF({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((x) => x !== tag) : f.tags.length < 6 ? [...f.tags, tag] : f.tags });
  return (
    <FormModal open={open} onClose={onClose} title={t("reviews.reviewOf", { name: person.name })} description={t("reviews.roommateDesc", { home: home.name })}
      submitLabel={t("reviews.post")} loading={save.isPending} disabled={!f.rating || f.body.trim().length < 10} onSubmit={() => save.mutate()}>
      <div className="row-3"><Avatar user={person} size={40} /><div><b>{person.name}</b><div className="text-xs muted">{home.name}</div></div></div>
      <Field label={t("reviews.rating")}><StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></Field>
      <Field label={t("reviews.describe")} optional hint={t("reviews.pickUpTo")}>
        <div className="row wrap" style={{ gap: 6 }}>
          {Object.entries(ROOMMATE_TAGS).map(([k, l]) => (
            <button type="button" key={k} className={`tag-chip ${NEGATIVE_TAGS.has(k) ? "neg" : ""}`} aria-pressed={f.tags.includes(k)} onClick={() => toggle(k)}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label={t("reviews.review")} hint={t("reviews.beFair")}>
        <Textarea rows={4} maxLength={1500} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </Field>
    </FormModal>
  );
}

/** Compact review card used in app pages. */
export function ReviewCard({ r, title, children }) {
  const t = useT();
  return (
    <div className="review-card">
      <div className="row-3">
        <Avatar user={r.user || r.reviewer} size={32} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong text-sm truncate">{title || (r.user || r.reviewer)?.name}</div>
          <div className="text-xs muted">{fmtDate(r.createdAt)}{r.home?.name ? ` · ${r.home.name}` : ""}{r.stayedTo === null ? ` · ${t("reviews.livesHere")}` : r.stayedTo ? ` · ${t("reviews.former")}` : ""}</div>
        </div>
        <Stars value={r.rating} size={13} />
      </div>
      {r.tags?.length > 0 && (
        <div className="row wrap" style={{ gap: 4 }}>
          {r.tags.map((tag) => <span key={tag} className={`badge ${NEGATIVE_TAGS.has(tag) ? "badge-danger" : "badge-accent"}`}>{ROOMMATE_TAGS[tag]}</span>)}
        </div>
      )}
      <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-2)", margin: 0 }}>{r.body}</p>
      {r.reply?.body && <div className="review-reply"><b className="text-xs" style={{ color: "var(--accent-text)" }}>{t("reviews.replyFromHome")}{r.reply.by?.name ? ` · ${r.reply.by.name}` : ""}</b><div>{r.reply.body}</div></div>}
      {children}
    </div>
  );
}
