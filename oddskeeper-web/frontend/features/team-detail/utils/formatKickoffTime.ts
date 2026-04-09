export function formatKickoffTime(
  kickoffTimeKnown: boolean,
  kickoffTimeText: string | null
) {
  if (!kickoffTimeKnown) return "TBD";
  return kickoffTimeText ?? "TBD";
}