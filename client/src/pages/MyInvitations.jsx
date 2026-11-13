import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { api } from "../lib/api";
import { Avatar, Button, Card, EmptyState, LoadingBlock, Modal, PageHeader } from "../components/ui";
import { useAction } from "../lib/hooks";
import { timeAgo } from "../lib/format";
import { JoinDetails } from "./Join";

export default function MyInvitations() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["invitations", "mine"], queryFn: () => api.get("/invitations/mine") });
  const [open, setOpen] = useState(null);
  const [profile, setProfile] = useState({ room: "", phone: "", emergencyContact: "" });
  const [accepted, setAccepted] = useState(false);

  const accept = useAction((inv) => api.post(`/invitations/${inv._id}/accept`, { rulesAccepted: true, ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v.trim())) }), {
    invalidate: [["invitations"], ["homes"]],
    success: "Welcome to your new home!",
    onSuccess: (r) => navigate(`/h/${r.homeId}`),
  });
  const decline = useAction((inv) => api.post(`/invitations/${inv._id}/decline`), { invalidate: [["invitations"]], success: "Invitation declined" });

  const list = data?.invitations || [];
  return (
    <main className="content content-narrow">
      <PageHeader title="Invitations" description="Homes that invited you directly." />
      <Card>
        {isLoading ? <LoadingBlock rows={2} /> : list.length === 0 ? (
          <EmptyState icon={Mail} title="No pending invitations" description="When someone invites you to their home, it shows up here." />
        ) : (
          <div className="list">
            {list.map((inv) => (
              <div className="list-item" key={inv._id}>
                <Avatar user={inv.createdBy} size={36} />
                <div className="grow">
                  <div className="text-sm"><b>{inv.createdBy?.name}</b> invited you to <b>{inv.home.name}</b></div>
                  <div className="text-xs muted">{inv.message || "No message"} · {timeAgo(inv.createdAt)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => decline.mutate(inv)}>Decline</Button>
                <Button size="sm" variant="primary" onClick={() => { setOpen(inv); setAccepted(false); }}>Review</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={`Join ${open?.home.name}`} size="lg"
        footer={<><Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button><Button variant="primary" disabled={!accepted} loading={accept.isPending} onClick={() => accept.mutate(open)}>Accept & join</Button></>}>
        {open && (
          <JoinDetails
            home={{ ...open.home, rules: open.home.settings?.rules, departureNoticeDays: open.home.settings?.departureNoticeDays ?? 0, memberCount: 0 }}
            profile={profile} setProfile={setProfile} accepted={accepted} setAccepted={setAccepted}
          />
        )}
      </Modal>
    </main>
  );
}
