"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { TabPill, TabPillBar } from "@/components/nav/TabPills";

// Admin panel sekme cubugu: User Management + ShortCuts. Yeni admin sekmesi
// eklerken buraya bir TabPill eklemek yeterli (layout.tsx her admin sayfasinin
// ustune bu cubugu koyar).
export default function AdminTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="mb-4 flex">
      <TabPillBar>
        <TabPill
          href="/dashboard/admin/users"
          active={pathname.startsWith("/dashboard/admin/users")}
        >
          {t("adminShortcuts.tabUsers")}
        </TabPill>
        <TabPill
          href="/dashboard/admin/shortcuts"
          active={pathname.startsWith("/dashboard/admin/shortcuts")}
        >
          {t("adminShortcuts.tabShortcuts")}
        </TabPill>
      </TabPillBar>
    </div>
  );
}
