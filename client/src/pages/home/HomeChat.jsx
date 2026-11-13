import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Card, ErrorState, LoadingBlock } from "../../components/ui";
import ChatView from "../../components/ChatView";
import { initials, pluralize } from "../../lib/format";

export default function HomeChat() {
  const { homeId, home } = useHome();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["home-conversation", homeId], queryFn: () => api.get(`/chat/home/${homeId}`) });
  if (isLoading) return <Card><LoadingBlock /></Card>;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  return (
    <ChatView
      conversationId={data.conversation._id}
      title={`${home.name} chat`}
      subtitle={`Private to ${pluralize(home.memberCount || 0, "member")} of this home`}
      avatar={<span className="home-mark" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>{initials(home.name)}</span>}
      emptyHint="Start the conversation with your housemates."
    />
  );
}
