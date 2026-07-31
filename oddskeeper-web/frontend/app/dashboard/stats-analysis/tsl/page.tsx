import { redirect } from "next/navigation";
import { RESMI_DEFAULT_SEASON } from "../../../../features/tsl/constants";

// TSL artik dogrudan "Resmi" deneyimine gider; ara secim ekrani (sahne/radar/
// panel) kaldirildi.
export default function TslIndexPage() {
  redirect(
    `/dashboard/stats-analysis/tsl/resmi?season=${encodeURIComponent(
      RESMI_DEFAULT_SEASON
    )}&section=league`
  );
}
