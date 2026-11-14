import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Card, ErrorState, LoadingBlock } from "../../components/ui";
import ChatView from "../../components/ChatView";
import { initials } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

export default function HomeChat() {
  const { homeId, home } = useHome();
  const t = useT();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["home-conversation", homeId], queryFn: () => api.get(`/chat/home/${homeId}`) });
  if (isLoading) return <Card><LoadingBlock /></Card>;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  return (
    <ChatView
      conversationId={data.conversation._id}
      title={t("homeChat.title", { home: home.name })}
      subtitle={t("homeChat.subtitle", { count: home.memberCount || 0 })}
      avatar={<span className="home-mark" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>{initials(home.name)}</span>}
      emptyHint={t("homeChat.empty")}
    />
  );
}
