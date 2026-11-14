import { useState } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { Bug, Lightbulb, Heart, MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { RELEASE } from "../lib/errorReporting";
import { useI18n } from "../i18n/I18nProvider";
import { Field, FormModal, Segmented, Textarea } from "./ui";

const KINDS = [["problem", Bug], ["idea", Lightbulb], ["praise", Heart], ["other", MessageSquare]];

/** "Send feedback": goes to the people running BachelorMate, with the page it was sent from. */
export const FeedbackDialog = (props) => (props.open ? <FeedbackForm {...props} /> : null);

function FeedbackForm({ open, onClose }) {
  const { t, lang } = useI18n();
  const location = useLocation();
  const homeMatch = useMatch("/h/:homeId/*");
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const send = useAction(
    () =>
      api.post("/feedback", {
        kind,
        message: message.trim(),
        page: location.pathname,
        homeId: homeMatch?.params.homeId,
        language: lang,
        release: RELEASE,
        screen: `${window.innerWidth}x${window.innerHeight}`,
      }),
    { success: t("feedback.thanks"), onSuccess: onClose }
  );
  return (
    <FormModal open={open} onClose={onClose} title={t("feedback.title")} description={t("feedback.desc")} submitLabel={t("feedback.send")}
      loading={send.isPending} disabled={message.trim().length < 3} onSubmit={() => send.mutate()}>
      <Segmented label={t("feedback.kind")} value={kind} onChange={setKind} items={KINDS.map(([value, icon]) => ({ value, icon, label: t(`feedback.kinds.${value}`) }))} />
      <Field label={t(`feedback.prompt.${kind}`)} hint={t("feedback.hint")}>
        <Textarea rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
      </Field>
    </FormModal>
  );
}
