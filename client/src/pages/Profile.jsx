import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, UserPlus, Check } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOnline } from "../context/RealtimeContext";
import { useAction } from "../lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageSkeleton } from "../components/ui";
import { Stars } from "../components/Stars";
import { ReviewCard, RoommateReviewModal } from "../components/ReviewForms";
import { ROOMMATE_TAGS, NEGATIVE_TAGS } from "../lib/listing";
import { num, timeAgo } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

export default function Profile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const t = useT();
  const [writing, setWriting] = useState(null);
  const { data: profile, isLoading, error } = useQuery({ queryKey: ["profile", userId], queryFn: () => api.get(`/users/${userId}`) });
  const { data: reviews } = useQuery({ queryKey: ["profile-reviews", userId], queryFn: () => api.get(`/users/${userId}/reviews`) });
  const { data: eligible } = useQuery({ queryKey: ["reviews", "eligible"], queryFn: () => api.get("/reviews/eligible"), enabled: userId !== me._id });
  const online = useOnline(userId, profile?.user?.online);
  const addFriend = useAction(() => api.post("/friends/requests", { userId }), { invalidate: [["friends"]], success: (r) => (r.friendship.status === "accepted" ? t("friends.nowFriends") : t("friends.requestSent")) });

  if (isLoading) return <main className="content content-narrow"><PageSkeleton /></main>;
  if (error) return <main className="content content-narrow"><Card><ErrorState error={error} /></Card></main>;
  const u = profile.user;
  const s = reviews?.summary;
  const canReview = (eligible?.people || []).filter((p) => p.user._id === userId);
  const self = userId === me._id;

  return (
    <main className="content content-narrow">
      <div className="stack-lg">
        <Card pad>
          <div className="row-3 wrap" style={{ gap: 18 }}>
            <Avatar user={u} size={72} online={online} />
            <div className="grow" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: "var(--text-2xl)" }}>{u.name}</h1>
              <div className="text-sm muted">{online ? t("profile.onlineNow") : u.lastSeenAt ? t("friends.lastSeen", { ago: timeAgo(u.lastSeenAt) }) : ""}</div>
              {u.bio && <p className="text-sm" style={{ marginTop: 8, color: "var(--text-2)" }}>{u.bio}</p>}
            </div>
            {!self && (
              <div className="row wrap">
                {canReview.map((p) => (
                  <Button key={p.home._id} variant="primary" icon={Star} onClick={() => setWriting(p)}>{p.reviewed ? t("reviews.update") : t("myReviews.review")}{canReview.length > 1 ? ` (${p.home.name})` : ""}</Button>
                ))}
                <Button icon={UserPlus} onClick={() => addFriend.mutate()} loading={addFriend.isPending}>{t("friends.add")}</Button>
              </div>
            )}
          </div>
        </Card>

        <Card title={t("profile.asRoommate")} actions={s && <Stars value={s.avg || 0} size={14} showValue count={s.count} />}>
          {!reviews ? <LoadingBlock rows={2} /> : (
            <>
              {s.topTags.length > 0 && (
                <div className="card-body row wrap" style={{ gap: 6, borderBottom: "1px solid var(--border)" }}>
                  <span className="text-xs muted">{t("profile.mostMentioned")}</span>
                  {s.topTags.map((x) => <Badge key={x.tag} tone={NEGATIVE_TAGS.has(x.tag) ? "danger" : "accent"} icon={NEGATIVE_TAGS.has(x.tag) ? undefined : Check}>{ROOMMATE_TAGS[x.tag]} · {num(x.n)}</Badge>)}
                </div>
              )}
              {!reviews.items.length ? (
                <EmptyState icon={Star} title={t("profile.noReviews")} description={self ? t("profile.noReviewsSelf") : t("profile.noReviewsOther")} />
              ) : reviews.items.map((r) => <ReviewCard key={r._id} r={r} />)}
            </>
          )}
        </Card>
      </div>
      <RoommateReviewModal open={Boolean(writing)} onClose={() => setWriting(null)} person={u} home={writing?.home} />
    </main>
  );
}
