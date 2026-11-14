import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Pencil, Trash2, Reply } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, LoadingBlock, PageHeader, Textarea } from "../../components/ui";
import { Stars } from "../../components/Stars";
import { HomeReviewModal, ReviewCard } from "../../components/ReviewForms";
import { useT } from "../../i18n/I18nProvider";
import { num } from "../../lib/format";

function Summary({ s }) {
  const t = useT();
  const max = Math.max(1, ...s.distribution);
  return (
    <div className="card card-pad row wrap" style={{ gap: 32, alignItems: "center" }}>
      <div className="col" style={{ gap: 4 }}>
        <span style={{ fontSize: 44, fontWeight: 650, letterSpacing: "-0.05em", lineHeight: 1 }}>{s.avg ? num(Number(s.avg.toFixed(1))) : "–"}</span>
        <Stars value={s.avg || 0} size={15} />
        <span className="text-xs muted">{t("stars.reviews", { count: s.count })}</span>
      </div>
      <div className="grow col" style={{ gap: 5, minWidth: 180 }}>
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n} className="row text-xs muted" style={{ gap: 10 }}>
            <span style={{ width: 10 }}>{num(n)}</span>
            <div className="bar-track grow"><span style={{ width: `${(s.distribution[n - 1] / max) * 100}%`, background: "#f5a524" }} /></div>
          </div>
        ))}
      </div>
      {Object.values(s.scores || {}).some(Boolean) && (
        <div className="col text-sm" style={{ gap: 6, minWidth: 160 }}>
          {["cleanliness", "food", "management", "value"].filter((k) => s.scores[k]).map((k) => (
            <div key={k} className="row between"><span className="muted">{t(`reviews.scores.${k}`)}</span><b>{num(Number(s.scores[k].toFixed(1)))}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeReviews() {
  const { homeId, home, roles } = useHome();
  const t = useT();
  const canReply = roles.some((r) => r === "admin" || r === "manager");
  const [writing, setWriting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["reviews", "home", homeId], queryFn: () => api.get(`/reviews/homes/${homeId}`) });
  const del = useAction(() => api.del(`/reviews/homes/${homeId}`), { invalidate: [["reviews"]], success: t("homeReviews.deleted"), onSuccess: () => setDeleting(false) });
  const sendReply = useAction(() => api.post(`/reviews/homes/${homeId}/${replying._id}/reply`, { body: reply.trim() }), { invalidate: [["reviews"]], success: t("homeReviews.replyPosted"), onSuccess: () => setReplying(null) });

  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader
        title={t("nav.reviews")}
        description={t("homeReviews.desc", { home: home.name })}
        actions={data?.canReview && <Button variant="primary" icon={data.mine ? Pencil : Star} onClick={() => setWriting(true)}>{data.mine ? t("homeReviews.editMine") : t("homeReviews.write")}</Button>}
      />
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : (
        <div className="stack">
          <Summary s={data.summary} />
          {!data.canReview && !data.mine && <p className="hint">{t("homeReviews.minStay", { count: data.minStayDays })}</p>}
          <Card>
            {!data.items.length ? (
              <EmptyState icon={Star} title={t("homeReviews.none")} description={t("homeReviews.noneHint")} />
            ) : (
              data.items.map((r) => (
                <ReviewCard key={r._id} r={r}>
                  <div className="row" style={{ gap: 6 }}>
                    {data.mine?._id === r._id && <>
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setWriting(true)}>{t("common.edit")}</Button>
                      <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>{t("common.delete")}</Button>
                    </>}
                    {canReply && data.mine?._id !== r._id && <Button size="sm" variant="ghost" icon={Reply} onClick={() => { setReply(r.reply?.body || ""); setReplying(r); }}>{r.reply?.body ? t("homeReviews.editReply") : t("homeReviews.reply")}</Button>}
                  </div>
                </ReviewCard>
              ))
            )}
          </Card>
        </div>
      )}
      <HomeReviewModal open={writing} onClose={() => setWriting(false)} homeId={homeId} homeName={home.name} existing={data?.mine} />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={t("homeReviews.deleteTitle")} confirmLabel={t("common.delete")} />
      <FormModal open={Boolean(replying)} onClose={() => setReplying(null)} title={t("homeReviews.replyTitle")} description={t("homeReviews.replyHint")} submitLabel={t("homeReviews.postReply")} loading={sendReply.isPending} disabled={reply.trim().length < 2} onSubmit={() => sendReply.mutate()}>
        <Field label={t("homeReviews.reply")}><Textarea rows={4} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
      </FormModal>
    </div>
  );
}
