import ResmiExperience from "@/features/tsl/resmi/ResmiExperience";
import { CUP_LEAGUE } from "@/features/tsl/leagues";

export const metadata = { title: "Türkiye Kupası" };

export default async function CupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={CUP_LEAGUE} sp={await searchParams} />;
}
