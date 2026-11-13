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
import { timeAgo } from "../lib/format";

export default function Profile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const [writing, setWriting] = useState(null);
  const { data: profile, isLoading, error } = useQuery({ queryKey: ["profile", userId], queryFn: () => api.get(`/users/${userId}`) });
  const { data: reviews } = useQuery({ queryKey: ["profile-reviews", userId], queryFn: () => api.get(`/users/${userId}/reviews`) });
  const { data: eligible } = useQuery({ queryKey: ["reviews", "eligible"], queryFn: () => api.get("/reviews/eligible"), enabled: userId !== me._id });
  const online = useOnline(userId, profile?.user?.online);
  const addFriend = useAction(() => api.post("/friends/requests", { userId }), { invalidate: [["friends"]], success: (r) => (r.friendship.status === "accepted" ? "You're now friends" : "Friend request sent") });

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
              <div className="text-sm muted">{online ? "Online now" : u.lastSeenAt ? `Last seen ${timeAgo(u.lastSeenAt)}` : ""}</div>
              {u.bio && <p className="text-sm" style={{ marginTop: 8, color: "var(--text-2)" }}>{u.bio}</p>}
            </div>
            {!self && (
              <div className="row wrap">
                {canReview.map((p) => (
                  <Button key={p.home._id} variant="primary" icon={Star} onClick={() => setWriting(p)}>{p.reviewed ? "Update review" : "Review"}{canReview.length > 1 ? ` (${p.home.name})` : ""}</Button>
                ))}
                <Button icon={UserPlus} onClick={() => addFriend.mutate()} loading={addFriend.isPending}>Add friend</Button>
              </div>
            )}
          </div>
        </Card>

        <Card title="As a roommate" actions={s && <Stars value={s.avg || 0} size={14} showValue count={s.count} />}>
          {!reviews ? <LoadingBlock rows={2} /> : (
            <>
              {s.topTags.length > 0 && (
                <div className="card-body row wrap" style={{ gap: 6, borderBottom: "1px solid var(--border)" }}>
                  <span className="text-xs muted">Most mentioned:</span>
                  {s.topTags.map((t) => <Badge key={t.tag} tone={NEGATIVE_TAGS.has(t.tag) ? "danger" : "accent"} icon={NEGATIVE_TAGS.has(t.tag) ? undefined : Check}>{ROOMMATE_TAGS[t.tag]} · {t.n}</Badge>)}
                </div>
              )}
              {!reviews.items.length ? (
                <EmptyState icon={Star} title="No roommate reviews yet" description={self ? "People you live with can review you after staying together for a while." : "Only people who've lived with them can leave a review."} />
              ) : reviews.items.map((r) => <ReviewCard key={r._id} r={r} />)}
            </>
          )}
        </Card>
      </div>
      <RoommateReviewModal open={Boolean(writing)} onClose={() => setWriting(null)} person={u} home={writing?.home} />
    </main>
  );
}
