import ResmiExperience from "../../../../../features/tsl/resmi/ResmiExperience";
import { EUEL_LEAGUE } from "../../../../../features/tsl/leagues";

export const metadata = { title: "Avrupa Ligi · UEFA Europa League" };

export default async function EuroElResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={EUEL_LEAGUE} sp={await searchParams} />;
}
