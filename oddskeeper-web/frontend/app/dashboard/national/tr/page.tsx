import ResmiExperience from "../../../../features/tsl/resmi/ResmiExperience";
import { TRNAT_LEAGUE } from "../../../../features/tsl/leagues";

export const metadata = { title: "Türkiye A Milli Takımı · Türkiye National Team" };

// Turkiye A Milli Futbol Takimi (header "TR"): TSL Resmi deneyiminin tek-takim
// uyarlamasi. Sezon secici turnuva baskilaridir; sekmeler NATIONAL_SECTIONS.
export default async function TrNationalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ResmiExperience config={TRNAT_LEAGUE} sp={await searchParams} />;
}
