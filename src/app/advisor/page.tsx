import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, advisorConversation } from "@/lib/db/schema";
import { env } from "@/env";
import Link from "next/link";

export default async function AdvisorPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) redirect("/login");

  const conversations = await db.query.advisorConversation.findMany({
    where: eq(advisorConversation.userId, PRIMARY_USER_ID),
    orderBy: (t, { desc }) => [desc(t.startedAt)],
  });

  async function createConversation() {
    "use server";
    const cookieStore2 = await cookies();
    const sid2 = cookieStore2.get(env().SESSION_COOKIE_NAME)?.value;
    if (!sid2) redirect("/login");
    const db2 = getDb();
    const sess2 = await readSession(db2, sid2);
    if (!sess2) redirect("/login");
    const [conv] = await db2
      .insert(advisorConversation)
      .values({ userId: PRIMARY_USER_ID, title: "New conversation" })
      .returning({ id: advisorConversation.id });
    redirect(`/advisor/c/${conv!.id}`);
  }

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#F7F4EE]">Ask your advisor</h1>
        <form action={createConversation}>
          <button
            type="submit"
            className="rounded-lg bg-[#C9A84C] px-3 py-1.5 text-sm font-medium text-[#2C1A0E] hover:bg-[#D4B55C] transition-colors"
          >
            New conversation
          </button>
        </form>
      </div>

      {conversations.length === 0 ? (
        <p className="text-[#C4B8A8] text-sm">
          Start a conversation to get grounded insights about your finances.
        </p>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`/advisor/c/${conv.id}`}
                className="flex items-center justify-between rounded-xl border border-[#4A2E1A] bg-[#3A2414] px-4 py-3 text-sm hover:bg-[#4A2E1A] transition-colors"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-[#F7F4EE]">{conv.title}</span>
                <span className="text-[#C4B8A8] ml-4 shrink-0 text-xs">
                  {new Date(conv.startedAt).toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
