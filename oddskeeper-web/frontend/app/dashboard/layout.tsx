import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppHeader from "../../components/app-header";
import { VersionGuard } from "../../components/version-guard";
import { ConfirmDialogHost } from "../../lib/confirm-dialog";
import { getNavAccess, isDevAuthBypass } from "../../lib/nav-access-server";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "../../lib/theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getNavAccess();

  // Lokal geliştirme bypass'ı: yalnızca dev sunucusunda ve .env.local'de
  // DEV_AUTH_BYPASS=1 tanımlıyken oturum şartını atlar. Production build'de
  // NODE_ENV "production" olduğu için canlıda hiçbir koşulda devreye girmez.
  if (!access.userId && !isDevAuthBypass()) {
    redirect("/sign-in");
  }

  const themeValue = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeValue) ? themeValue : DEFAULT_THEME;

  return (
    <div className="min-h-screen w-full bg-canvas text-ink">
      <AppHeader
        userEmail={access.userEmail ?? "dev-bypass"}
        theme={theme}
        allowedNavKeys={access.allowedKeys}
        isAdmin={access.isAdmin}
      />

      <main className="w-full px-4 pb-8 pt-4 lg:px-8">{children}</main>
      <ConfirmDialogHost />
      <VersionGuard />
    </div>
  );
}
