import { redirect } from "next/navigation";
import AppHeader from "../../components/app-header";
import { createClient } from "../../lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen w-full bg-[#050b14] text-white">
      <AppHeader userEmail={user.email ?? null} />

      <main className="w-full px-6 pb-10 pt-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}