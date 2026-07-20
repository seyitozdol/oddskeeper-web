import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppHeader from "../../components/app-header";
import { createClient } from "../../lib/supabase/server";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "../../lib/theme";

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

  const themeValue = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeValue) ? themeValue : DEFAULT_THEME;

  return (
    <div className="min-h-screen w-full bg-canvas text-ink">
      <AppHeader userEmail={user?.email ?? "dev-bypass"} theme={theme} />

      <main className="w-full px-4 pb-8 pt-4 lg:px-8">{children}</main>
    </div>
  );
}