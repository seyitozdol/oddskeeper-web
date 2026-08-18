import ResmiExperience from "../../../../../features/tsl/resmi/ResmiExperience";
import { EUECL_LEAGUE } from "../../../../../features/tsl/leagues";

export const metadata = { title: "Konferans Ligi · UEFA Conference League" };

export default async function EuroConfResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={EUECL_LEAGUE} sp={await searchParams} />;
}
