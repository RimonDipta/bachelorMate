import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, LogIn, House, Clock, ChevronRight, Mail, Archive } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge } from "../components/ui";
import { HOME_TYPES, initials, rolesLabel, pluralize } from "../lib/format";

export default function Homes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["homes"], queryFn: () => api.get("/homes") });
  const { data: inv } = useQuery({ queryKey: ["invitations", "mine"], queryFn: () => api.get("/invitations/mine") });
  const homes = data?.homes || [];
  const active = homes.filter((h) => h.myMembership.status === "active");
  const pending = homes.filter((h) => h.myMembership.status === "pending");

  return (
    <main className="content">
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Pick a home, or start a new one."
        actions={
          <>
            <Link to="/join" className="btn btn-secondary"><LogIn size={16} /> Join a home</Link>
            <Link to="/onboarding" className="btn btn-primary"><Plus size={16} /> Create home</Link>
          </>
        }
      />
      <div className="stack-lg">
        {!user.emailVerified && (
          <div className="alert alert-neutral">
            <Mail />
            <div className="grow">Verify your email to create or join homes, post seats and write reviews.</div>
            <Link to="/verify-email?next=/homes" className="btn btn-sm btn-primary">Enter code</Link>
          </div>
        )}
        {inv?.invitations?.length > 0 && (
          <Link to="/invitations" className="card card-link home-tile">
            <div className="home-mark"><Mail size={18} /></div>
            <div className="grow">
              <div className="strong">You have {pluralize(inv.invitations.length, "invitation")}</div>
              <div className="text-sm muted">Review and accept to join.</div>
            </div>
            <ChevronRight size={18} className="subtle" />
          </Link>
        )}
        {isLoading ? (
          <Card><LoadingBlock rows={3} /></Card>
        ) : error ? (
          <Card><ErrorState error={error} retry={refetch} /></Card>
        ) : active.length === 0 && pending.length === 0 ? (
          <Card>
            <EmptyState
              icon={House}
              title="You're not in a home yet"
              description="Create a home for your mess or flat, or join one using an invite link or home code."
              action={
                <div className="row wrap" style={{ justifyContent: "center" }}>
                  <button className="btn btn-primary" onClick={() => navigate("/onboarding")}><Plus size={16} /> Create a home</button>
                  <button className="btn btn-secondary" onClick={() => navigate("/join")}><LogIn size={16} /> Join with a code</button>
                </div>
              }
            />
          </Card>
        ) : (
          <div className="grid-3">
            {active.map((h) => (
              <Link key={h._id} to={`/h/${h._id}`} className="card card-link">
                <div className="home-tile">
                  <div className="home-mark">{initials(h.name)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong truncate">{h.name}</div>
                    <div className="text-xs muted truncate">{HOME_TYPES[h.type]} · {pluralize(h.memberCount, "member")}</div>
                  </div>
                </div>
                <div className="card-foot row between">
                  <span className="text-xs muted">{rolesLabel(h.myMembership.roles)}</span>
                  {h.status === "archived" ? <Badge icon={Archive}>Archived</Badge> : <ChevronRight size={16} className="subtle" />}
                </div>
              </Link>
            ))}
            {pending.map((h) => (
              <div key={h._id} className="card">
                <div className="home-tile">
                  <div className="home-mark" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}><Clock size={18} /></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong truncate">{h.name}</div>
                    <div className="text-xs muted">Waiting for approval</div>
                  </div>
                  <StatusBadge status="pending" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
