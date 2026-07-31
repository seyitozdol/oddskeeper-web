import ResmiExperience from "../../../../../features/tsl/resmi/ResmiExperience";
import { TSL_LEAGUE } from "../../../../../features/tsl/leagues";

export const metadata = { title: "TSL Resmi · Süper Lig" };

export default async function ResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={TSL_LEAGUE} sp={await searchParams} />;
}
