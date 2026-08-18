import ResmiExperience from "../../../../../features/tsl/resmi/ResmiExperience";
import { EUROCL_LEAGUE } from "../../../../../features/tsl/leagues";

export const metadata = { title: "Şampiyonlar Ligi · UEFA Champions League" };

export default async function EuroClResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={EUROCL_LEAGUE} sp={await searchParams} />;
}
