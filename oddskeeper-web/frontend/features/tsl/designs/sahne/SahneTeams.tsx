import { getT } from "@/lib/i18n/server";
import type { TeamsBundle } from "@/features/tsl/server/loaders";
import SahneTeamTable from "./SahneTeamTable";

export default async function SahneTeams({ data }: { data: TeamsBundle }) {
  const t = await getT();
  if (!data.teamLeaderboard.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }
  return <SahneTeamTable rows={data.teamLeaderboard} meta={data.meta} />;
}
