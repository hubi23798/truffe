import { ChatView } from "./chat-view";

export default async function AdvisorChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatView id={id} />;
}
