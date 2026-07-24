import { redirect } from "next/navigation";
import { getNavAccess } from "@/lib/nav-access-server";
import AdminUsersClient from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const access = await getNavAccess();

  if (!access.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminUsersClient requesterId={access.userId} />;
}
