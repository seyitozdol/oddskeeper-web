import { redirect } from "next/navigation";
import { getNavAccess } from "@/lib/nav-access-server";
import AdminShortcutsClient from "./shortcuts-client";

export const dynamic = "force-dynamic";

export default async function AdminShortcutsPage() {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminShortcutsClient />;
}
