import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AiChatWidget from "@/components/AiChatWidget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={user}>
      {children}
      <AiChatWidget />
    </AppShell>
  );
}
