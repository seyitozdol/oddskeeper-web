import TeamAdvancedSummaryView from "../components/TeamAdvancedSummaryView";
import { getTeamAdvancedSummary } from "../server/getTeamAdvancedSummary";
import type {
  TeamAdvancedFormSnapshot,
  TeamDetailedMetricRow,
} from "../types";

type TeamAdvancedPanelProps = {
  rows?: TeamDetailedMetricRow[];
  form?: TeamAdvancedFormSnapshot;
};

export default async function TeamAdvancedPanel({
  rows = [],
  form,
}: TeamAdvancedPanelProps) {
  const summary = await getTeamAdvancedSummary({
    rows,
    form,
  });

  return <TeamAdvancedSummaryView summary={summary} />;
}