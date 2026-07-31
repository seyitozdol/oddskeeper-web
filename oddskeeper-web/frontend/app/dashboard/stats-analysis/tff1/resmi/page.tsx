import ResmiExperience from "../../../../../features/tsl/resmi/ResmiExperience";
import { TFF1_LEAGUE } from "../../../../../features/tsl/leagues";

export const metadata = { title: "1. Lig Resmi · Trendyol 1. Lig" };

export default async function Tff1ResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={TFF1_LEAGUE} sp={await searchParams} />;
}
