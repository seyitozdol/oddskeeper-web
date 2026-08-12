import type { TeamNote } from "@/lib/team-notes";
import { TeamNotes } from "./TeamNotes";

type TeamDetailHeaderProps = {
  logoPath: string;
  teamName: string;
  teamSlug: string;
  initialNotes?: TeamNote[];
};

// Sekmeler artik sayfanin sol mini menusunde (SideTabMenu); baslik yalniz
// logo + takim adi + not butonunu tasir.
export async function TeamDetailHeader({
  logoPath,
  teamName,
  teamSlug,
  initialNotes = [],
}: TeamDetailHeaderProps) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <TeamNotes
        teamSlug={teamSlug}
        teamName={teamName}
        logoPath={logoPath}
        initialNotes={initialNotes}
      >
        {null}
      </TeamNotes>
    </div>
  );
}
