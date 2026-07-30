import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { NAV_PERMISSION_ITEMS, isNavKeyAllowed } from "@/lib/nav-permissions";

// Panonun kendi icerigi yok: kullaniciyi erisebildigi ilk basliga yonlendirir
// (siralamada ilk madde upcoming-events). Hicbir basliga erisimi yoksa
// yonlendirme yapilmaz; aksi halde proxy izinsiz rotayi /dashboard'a geri
// atip sonsuz donguye girerdi.
export default async function DashboardPage() {
  const access = await getNavAccess();

  const first = NAV_PERMISSION_ITEMS.find((item) =>
    isNavKeyAllowed(item.key, access.allowedKeys)
  );

  if (first) {
    redirect(first.href);
  }

  const t = await getT();

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm leading-7 text-ink-2">
          {t("dashboardHome.noAccess")}
        </p>
      </div>
    </section>
  );
}
