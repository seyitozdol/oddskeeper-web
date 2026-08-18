import { redirect } from "next/navigation";

// Tek-profil birlestirme: eski kupa-basina takim URL'i birlesik takim
// profiline yonlenir (dual takimlar oradan football profiline gider).
export default async function ClTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string; season?: string }>;
}) {
  const [{ teamId }, { tab, season }] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams({ comp: "ucl" });
  if (season) q.set("season", season);
  if (tab) q.set("tab", tab);
  redirect(`/dashboard/euro-cups/team/${encodeURIComponent(teamId)}?${q.toString()}`);
}
