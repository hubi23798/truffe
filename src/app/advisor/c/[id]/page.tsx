import { ChatView } from "./chat-view";

export default async function AdvisorChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  return <ChatView id={id} initialMessage={q} />;
}
