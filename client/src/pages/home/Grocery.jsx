import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ShoppingBasket, MoreHorizontal, Pencil, Trash2, Check, RotateCcw, Receipt } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, PageHeader, Select, SettingRow, Switch } from "../../components/ui";
import { fmtDay, money, num, toMajorString, timeAgo } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { useActiveMembers } from "../../components/FinanceForms";

export default function Grocery() {
  const { homeId, can, currency, membershipId } = useHome();
  const t = useT();
  const members = useActiveMembers();
  const [editing, setEditing] = useState(null);
  const [buying, setBuying] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["grocery", homeId], queryFn: () => api.get(`/homes/${homeId}/grocery`) });
  const inv = [["grocery", homeId], ["expenses"], ["finance"]];
  const manage = can("grocery.manage");
  const canRecord = can("expenses.manage", "expenses.meal");

  const save = useAction(() => {
    const body = { name: editing.name, quantity: Number(editing.quantity) || 0, unit: editing.unit || "pcs", assignedTo: editing.assignedTo || null, estimatedCost: editing.estimatedCost || "0", neededBy: editing.neededBy || "" };
    return editing._id ? api.patch(`/homes/${homeId}/grocery/${editing._id}`, body) : api.post(`/homes/${homeId}/grocery`, body);
  }, { invalidate: inv, success: t("grocery.saved"), onSuccess: () => setEditing(null) });
  const del = useAction((i) => api.del(`/homes/${homeId}/grocery/${i._id}`), { invalidate: inv, success: t("grocery.removed") });
  const purchase = useAction(({ item, ...body }) => api.post(`/homes/${homeId}/grocery/${item._id}/purchase`, body), { invalidate: inv, success: (_, v) => (v.purchased === false ? t("grocery.markedNot") : v.createExpense ? t("grocery.boughtRecorded") : t("grocery.markedBought")), onSuccess: () => setBuying(null) });

  const items = data?.items || [];
  const open = items.filter((i) => !i.purchased);
  const done = items.filter((i) => i.purchased);
  const est = open.reduce((a, i) => a + (i.estimatedCost || 0), 0);
  const mayBuy = (i) => manage || i.assignedTo?._id === membershipId;

  const Row = ({ i }) => (
    <div className="list-item">
      <button className="btn btn-secondary btn-sm btn-icon" style={i.purchased ? { background: "var(--success-soft)", color: "var(--success)", borderColor: "transparent" } : undefined} disabled={!mayBuy(i)}
        aria-label={i.purchased ? t("grocery.markNot") : t("grocery.markBought")} onClick={() => (i.purchased ? purchase.mutate({ item: i, purchased: false }) : setBuying({ item: i, actualCost: toMajorString(i.estimatedCost), createExpense: canRecord }))}>
        {i.purchased ? <Check size={14} /> : null}
      </button>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="text-sm strong truncate" style={i.purchased ? { textDecoration: "line-through", color: "var(--text-3)" } : undefined}>{i.name}</div>
        <div className="row wrap text-xs muted" style={{ gap: 6 }}>
          <span>{num(i.quantity)} {t(`grocery.units.${i.unit}`)}</span>
          {i.estimatedCost > 0 && !i.purchased && <span>· {t("grocery.est", { amount: money(i.estimatedCost, currency) })}</span>}
          {i.actualCost > 0 && i.purchased && <span>· {money(i.actualCost, currency)}</span>}
          {i.neededBy && !i.purchased && <span>· {t("grocery.by", { day: fmtDay(i.neededBy) })}</span>}
          {i.purchased && <span>· {timeAgo(i.purchasedAt)}</span>}
          {i.expense && <Badge icon={Receipt}>{t("expenses.expense")}</Badge>}
        </div>
      </div>
      {i.assignedTo?.user && <span className="row text-xs muted hide-sm"><Avatar user={i.assignedTo.user} size={22} />{i.assignedTo.user.name.split(" ")[0]}</span>}
      {manage && (
        <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t("grocery.actions")} />}>
          {!i.purchased && <MenuItem icon={Pencil} onClick={() => setEditing({ ...i, assignedTo: i.assignedTo?._id || "", estimatedCost: toMajorString(i.estimatedCost), neededBy: i.neededBy || "" })}>{t("common.edit")}</MenuItem>}
          {i.purchased && !i.expense && <MenuItem icon={RotateCcw} onClick={() => purchase.mutate({ item: i, purchased: false })}>{t("grocery.markNot")}</MenuItem>}
          {!i.expense && <MenuItem icon={Trash2} danger onClick={() => del.mutate(i)}>{t("common.remove")}</MenuItem>}
        </Menu>
      )}
    </div>
  );

  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title={t("nav.grocery")} description={open.length ? t("grocery.summary", { n: open.length, amount: money(est, currency) }) : t("grocery.plan")}
        actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEditing({ name: "", quantity: 1, unit: "kg", assignedTo: "", estimatedCost: "", neededBy: "" })}>{t("grocery.add")}</Button>} />
      <div className="stack">
        <Card title={t("grocery.toBuy")}>
          {isLoading ? <LoadingBlock rows={3} /> : !open.length ? <EmptyState compact icon={ShoppingBasket} title={t("grocery.empty")} /> : <div className="list">{open.map((i) => <Row key={i._id} i={i} />)}</div>}
        </Card>
        {done.length > 0 && <Card title={t("grocery.boughtRecently")}><div className="list">{done.map((i) => <Row key={i._id} i={i} />)}</div></Card>}
      </div>
      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? t("grocery.editTitle") : t("grocery.add")} loading={save.isPending} disabled={!editing?.name?.trim()} onSubmit={() => save.mutate()}>
        <div className="form-grid">
          <Field label={t("grocery.item")} className="full"><Input value={editing?.name || ""} maxLength={80} placeholder={t("grocery.itemPlaceholder")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label={t("grocery.quantity")}><Input type="number" min={0} step="0.25" value={editing?.quantity ?? ""} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} /></Field>
          <Field label={t("grocery.unit")}><Select value={editing?.unit || "pcs"} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} options={["kg", "g", "L", "ml", "pcs", "dozen", "pack", "bottle"].map((u) => ({ value: u, label: t(`grocery.units.${u}`) }))} /></Field>
          <Field label={t("grocery.estimated", { currency })} optional><Input inputMode="decimal" value={editing?.estimatedCost || ""} onChange={(e) => setEditing({ ...editing, estimatedCost: e.target.value })} /></Field>
          <Field label={t("grocery.neededBy")} optional><Input type="date" value={editing?.neededBy || ""} onChange={(e) => setEditing({ ...editing, neededBy: e.target.value })} /></Field>
          <Field label={t("grocery.whoBuys")} optional className="full">
            <Select value={editing?.assignedTo || ""} onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })}>
              <option value="">{t("grocery.anyone")}</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
            </Select>
          </Field>
        </div>
      </FormModal>
      <FormModal open={Boolean(buying)} onClose={() => setBuying(null)} title={t("grocery.boughtTitle", { name: buying?.item.name })} submitLabel={t("grocery.markBought")} loading={purchase.isPending} onSubmit={() => purchase.mutate({ item: buying.item, purchased: true, actualCost: buying.actualCost || undefined, createExpense: buying.createExpense })}>
        <Field label={t("grocery.actual", { currency })} optional={!buying?.createExpense}><Input inputMode="decimal" value={buying?.actualCost || ""} onChange={(e) => setBuying({ ...buying, actualCost: e.target.value })} /></Field>
        {canRecord && <SettingRow title={t("grocery.recordExpense")} description={t("grocery.recordHint", { name: buying?.item.assignedTo?.user?.name || t("grocery.you") })}><Switch checked={buying?.createExpense} onChange={(v) => setBuying({ ...buying, createExpense: v })} label={t("grocery.recordExpense")} /></SettingRow>}
      </FormModal>
    </div>
  );
}
