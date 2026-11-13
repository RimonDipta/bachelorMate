import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, MoreHorizontal, Pencil, Eye, EyeOff, Trash2, ImagePlus, X, MessageCircle, UserPlus, ExternalLink, Loader2 } from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, Modal, PageHeader, Select, StatusBadge, Textarea } from "../../components/ui";
import { addDays, fmtDay, localDay, money, timeAgo } from "../../lib/format";
import { minorToInput } from "../../lib/money";
import { AMENITIES, ROOM_TYPES, GENDER, OCCUPATION } from "../../lib/listing";

const ListingModal = (props) => (props.open ? <ListingForm {...props} /> : null);

function ListingForm({ open, onClose, listing }) {
  const { homeId, home, currency } = useHome();
  const [f, setF] = useState(() =>
    listing
      ? { ...listing, rent: minorToInput(listing.rent), deposit: listing.deposit ? minorToInput(listing.deposit) : "", mealCostEstimate: listing.mealCostEstimate ? minorToInput(listing.mealCostEstimate) : "", description: listing.description || "" }
      : { title: "", description: "", seats: 1, roomType: "shared_room", rent: "", deposit: "", mealCostEstimate: "", availableFrom: addDays(localDay(), 7), gender: "any", occupation: "any", city: "", area: home.address?.split(",").slice(-1)[0]?.trim() || "", amenities: home.settings.mealTypes?.length ? ["meals"] : [] }
  );
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const save = useAction(
    () => {
      const body = {
        title: f.title.trim(), description: f.description || undefined, seats: Number(f.seats), roomType: f.roomType, rent: f.rent || "0",
        deposit: f.deposit || undefined, mealCostEstimate: f.mealCostEstimate || null, availableFrom: f.availableFrom, gender: f.gender, occupation: f.occupation,
        city: f.city.trim(), area: f.area.trim(), amenities: f.amenities,
      };
      return listing ? api.patch(`/homes/${homeId}/listings/${listing._id}`, body) : api.post(`/homes/${homeId}/listings`, body);
    },
    { invalidate: [["listings", homeId], ["public-listings"]], success: listing ? "Listing updated" : "Listing posted — add photos next", onSuccess: onClose }
  );
  const valid = f.title.trim().length >= 5 && /^\d+(\.\d{1,2})?$/.test(String(f.rent)) && f.city.trim().length >= 2 && f.area.trim().length >= 2 && f.availableFrom;
  return (
    <FormModal open={open} onClose={onClose} size="lg" title={listing ? "Edit listing" : "Post an empty seat"} description="Shown publicly on Find a seat. Only the area and city are shown — never your address."
      submitLabel={listing ? "Save changes" : "Post listing"} loading={save.isPending} disabled={!valid} onSubmit={() => save.mutate()}>
      <Field label="Title" hint="e.g. 1 seat in a quiet 4-person mess near Mirpur 10"><Input value={f.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} autoFocus /></Field>
      <div className="form-grid">
        <Field label="Area"><Input value={f.area} maxLength={80} placeholder="Mirpur 10" onChange={(e) => set({ area: e.target.value })} /></Field>
        <Field label="City"><Input value={f.city} maxLength={60} placeholder="Dhaka" onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label={`Rent per month (${currency})`}><Input inputMode="decimal" value={f.rent} onChange={(e) => set({ rent: e.target.value })} placeholder="4500" /></Field>
        <Field label={`Deposit (${currency})`} optional><Input inputMode="decimal" value={f.deposit} onChange={(e) => set({ deposit: e.target.value })} placeholder="0" /></Field>
        <Field label="Seats available"><Input type="number" min={1} max={20} value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
        <Field label="Room type"><Select value={f.roomType} onChange={(e) => set({ roomType: e.target.value })} options={Object.entries(ROOM_TYPES).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Available from"><Input type="date" value={f.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} /></Field>
        <Field label={`Meal cost estimate / month (${currency})`} optional><Input inputMode="decimal" value={f.mealCostEstimate} onChange={(e) => set({ mealCostEstimate: e.target.value })} placeholder="e.g. 3000" /></Field>
        <Field label="Who can apply"><Select value={f.gender} onChange={(e) => set({ gender: e.target.value })} options={Object.entries(GENDER).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Best for"><Select value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} options={Object.entries(OCCUPATION).map(([value, label]) => ({ value, label }))} /></Field>
      </div>
      <Field label="What's included">
        <div className="row wrap" style={{ gap: 6 }}>
          {Object.entries(AMENITIES).map(([k, a]) => (
            <button type="button" key={k} className="tag-chip" aria-pressed={f.amenities.includes(k)} onClick={() => set({ amenities: f.amenities.includes(k) ? f.amenities.filter((x) => x !== k) : [...f.amenities, k] })}>
              <a.icon size={13} style={{ marginRight: 5 }} />{a.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Description" optional hint="The vibe, who lives there, distance to transport or campus, anything a newcomer should know.">
        <Textarea rows={5} value={f.description} maxLength={3000} onChange={(e) => set({ description: e.target.value })} />
      </Field>
    </FormModal>
  );
}

function Photos({ listing }) {
  const { homeId } = useHome();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["listings", homeId] });
    qc.invalidateQueries({ queryKey: ["public-listings"] });
  };
  const upload = async (files) => {
    setBusy(true);
    try {
      for (const file of [...files].slice(0, 8 - listing.photos.length)) {
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is over 5 MB`); continue; }
        const fd = new FormData();
        fd.append("photo", file);
        await api.post(`/homes/${homeId}/listings/${listing._id}/photos`, fd);
      }
      refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (url) => {
    try {
      await api.del(`/homes/${homeId}/listings/${listing._id}/photos`, { url });
      refresh();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <div className="photo-grid">
      {listing.photos.map((p, i) => (
        <div key={p}>
          <img src={assetUrl(p)} alt={`Photo ${i + 1}`} loading="lazy" />
          <button type="button" className="btn btn-sm btn-icon photo-remove" aria-label="Remove photo" onClick={() => remove(p)}><X size={14} /></button>
        </div>
      ))}
      {listing.photos.length < 8 && (
        <label className="photo-add">
          {busy ? <Loader2 size={18} style={{ animation: "spin .8s linear infinite" }} /> : <ImagePlus size={20} />}
          <span>{busy ? "Uploading…" : "Add photos"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

function Inquiries({ listing, onClose }) {
  const { homeId } = useHome();
  const { data, isLoading } = useQuery({ queryKey: ["listings", homeId, "inquiries", listing._id], queryFn: () => api.get(`/homes/${homeId}/listings/${listing._id}/inquiries`) });
  const invite = useAction((u) => api.post(`/homes/${homeId}/invitations`, { kind: "direct", userId: u._id, message: `Following up on your interest in "${listing.title}"` }), { invalidate: [["invitations", homeId]], success: (_, u) => `Invitation sent to ${u.name}` });
  return (
    <Modal open onClose={onClose} title="Inquiries" description={listing.title} size="lg">
      {isLoading ? <LoadingBlock rows={2} /> : !data.inquiries.length ? (
        <EmptyState compact icon={MessageCircle} title="No inquiries yet" description="When someone contacts you about this seat, it shows up here and in Messages." />
      ) : (
        <div className="card">
          {data.inquiries.map((q) => (
            <div key={q.conversationId} className="list-item">
              <Avatar user={q.user} size={34} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}><b className="text-sm">{q.user?.name}</b><span className="text-xs subtle">{timeAgo(q.lastMessageAt)}</span></div>
                <div className="text-sm muted truncate">{q.lastMessage?.body}</div>
              </div>
              {q.mine && <Link to={`/friends/chat/${q.conversationId}`} className="btn btn-sm btn-secondary"><MessageCircle size={14} /> Reply</Link>}
              {q.user && <Button size="sm" variant="primary" icon={UserPlus} onClick={() => invite.mutate(q.user)} loading={invite.isPending && invite.variables?._id === q.user._id}>Invite</Button>}
            </div>
          ))}
        </div>
      )}
      <p className="hint" style={{ marginTop: 10 }}>Replies happen privately in Messages. “Invite” sends them an in-app invitation to join this home.</p>
    </Modal>
  );
}

export default function HomeListings() {
  const { homeId, can, currency } = useHome();
  const manage = can("invites.manage");
  const [modal, setModal] = useState(null);
  const [inquiries, setInquiries] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["listings", homeId], queryFn: () => api.get(`/homes/${homeId}/listings`) });
  const inv = [["listings", homeId], ["public-listings"]];
  const status = useAction((l) => api.post(`/homes/${homeId}/listings/${l._id}/status`, { status: l.status === "open" ? "closed" : "open" }), { invalidate: inv, success: (r) => (r.listing.status === "open" ? "Listing is live again" : "Listing hidden from search") });
  const del = useAction((l) => api.del(`/homes/${homeId}/listings/${l._id}`), { invalidate: inv, success: "Listing deleted", onSuccess: () => setDeleting(null) });
  const listings = data?.listings || [];

  return (
    <>
      <PageHeader
        title="Seat listings"
        description="Have an empty seat? Post it on Find a seat — people message you directly."
        actions={<>
          <Link to="/seats" className="btn btn-secondary"><ExternalLink size={15} /> Find a seat</Link>
          {manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>Post a seat</Button>}
        </>}
      />
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : !listings.length ? (
        <Card><EmptyState icon={Megaphone} title="No listings yet" description={manage ? "Post your empty seat with photos, rent and what's included. Reviews from your members appear on it automatically." : "Your managers haven't posted any empty seats."} action={manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>Post a seat</Button>} /></Card>
      ) : (
        <div className="stack">
          {listings.map((l) => (
            <Card key={l._id} style={l.status === "closed" ? { opacity: 0.75 } : undefined}>
              <div className="card-body stack" style={{ gap: 14 }}>
                <div className="row between wrap" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div className="col" style={{ gap: 6, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <h2 className="truncate">{l.title}</h2>
                      <StatusBadge status={l.status === "open" ? "active" : "cancelled"} label={l.status === "open" ? "Live" : "Hidden"} />
                    </div>
                    <div className="text-sm muted">
                      <b className="num" style={{ color: "var(--text)" }}>{money(l.rent, currency)}</b>/month · {l.seats} seat{l.seats > 1 ? "s" : ""} · {ROOM_TYPES[l.roomType]} · {l.area}, {l.city} · from {fmtDay(l.availableFrom)}
                    </div>
                    <div className="row wrap text-xs muted" style={{ gap: 10 }}>
                      <span><Eye size={12} style={{ verticalAlign: -2 }} /> {l.views} views</span>
                      <span><MessageCircle size={12} style={{ verticalAlign: -2 }} /> {l.inquiries} inquir{l.inquiries === 1 ? "y" : "ies"}</span>
                      <span>Posted by {l.postedBy?.name} · {timeAgo(l.createdAt)}</span>
                    </div>
                  </div>
                  <div className="row wrap">
                    <Link to={`/seats/${l._id}`} className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer"><ExternalLink size={14} /> View</Link>
                    {manage && <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => setInquiries(l)}>Inquiries{l.inquiries ? <Badge tone="accent">{l.inquiries}</Badge> : null}</Button>}
                    {manage && (
                      <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={`Actions for ${l.title}`} />}>
                        <MenuItem icon={Pencil} onClick={() => setModal({ listing: l })}>Edit details</MenuItem>
                        <MenuItem icon={l.status === "open" ? EyeOff : Eye} onClick={() => status.mutate(l)}>{l.status === "open" ? "Hide (seat filled)" : "Make live again"}</MenuItem>
                        <div className="menu-sep" />
                        <MenuItem icon={Trash2} danger onClick={() => setDeleting(l)}>Delete</MenuItem>
                      </Menu>
                    )}
                  </div>
                </div>
                {manage ? <Photos listing={l} /> : l.photos.length > 0 && <div className="photo-grid">{l.photos.map((p) => <div key={p}><img src={assetUrl(p)} alt="" loading="lazy" /></div>)}</div>}
                {manage && !l.photos.length && <p className="hint">Listings with photos get far more replies. Add up to 8 — they're resized and compressed automatically.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <ListingModal open={Boolean(modal)} listing={modal?.listing} onClose={() => setModal(null)} />
      {inquiries && <Inquiries listing={inquiries} onClose={() => setInquiries(null)} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting)} loading={del.isPending} danger title={`Delete “${deleting?.title}”?`} confirmLabel="Delete listing" description="It disappears from Find a seat and its photos are deleted. Existing conversations stay in Messages." />
    </>
  );
}
