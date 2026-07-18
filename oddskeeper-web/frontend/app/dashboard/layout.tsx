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

  // Lokal geliştirme bypass'ı: yalnızca dev sunucusunda ve .env.local'de
  // DEV_AUTH_BYPASS=1 tanımlıyken oturum şartını atlar. Production build'de
  // NODE_ENV "production" olduğu için canlıda hiçbir koşulda devreye girmez.
  const devAuthBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "1";

  if (!user && !devAuthBypass) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen w-full bg-[#050b14] text-white">
      <AppHeader userEmail={user?.email ?? "dev-bypass"} />

      <main className="w-full px-6 pb-10 pt-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}