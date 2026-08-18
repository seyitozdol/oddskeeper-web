import { redirect } from "next/navigation";
import EuroCupTeamDetail from "@/features/tsl/resmi/EuroCupTeamDetail";
import { getFootballTeamSlug } from "@/features/tsl/server/cupProfileRedirect";
import { getTeamDetailHref } from "@/lib/routes";

export const metadata = { title: "Takım · Avrupa Kupaları" };

// Tek-profil birlestirme (Faz 4): kupa takiminin TEK profili.
// Super Lig eslesmesi olan (dual) takim -> football takim profiline redirect;
// yabanci takim -> birlesik kupa takim sayfasi (kupa kirilimi sayfa icinde).
export default async function EuroCupTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string; comp?: string; season?: string }>;
}) {
  const [{ teamId }, { tab, comp, season }] = await Promise.all([
    params,
    searchParams,
  ]);

  const slug = await getFootballTeamSlug(teamId);
  const footballHref = getTeamDetailHref(slug);
  if (footballHref) redirect(footballHref);

  return (
    <EuroCupTeamDetail teamId={teamId} tab={tab} comp={comp} season={season} />
  );
}
