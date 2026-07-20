import Image from "next/image";
import Link from "next/link";
import { VALID_PLAYER_TABS } from "../constants";
import type { PlayerProfileRow, ValidPlayerTab } from "../types";
import { getTeamDetailHref } from "@/lib/routes";
import { getTeamLogoPath } from "../utils/getTeamLogoPath";
import { formatDecimal } from "../utils/formatDecimal";
import type { PlayerCurrentInfoRow } from "../types";
import { getT } from "@/lib/i18n/server";
import {
  canonicalNationality,
  getCountryFlagUrl,
} from "@/lib/country-flags";

type PlayerDetailHeaderProps = {
  profile: PlayerProfileRow;
  activeTab: ValidPlayerTab;
  currentInfo?: PlayerCurrentInfoRow | null;
  marketValueEur?: number | null;
};

function formatMarketValue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `€${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }

  return `€${Math.round(value / 1_000)}K`;
}

// Tab görünür etiketleri: URL'de kullanılan tab değerleri (VALID_PLAYER_TABS)
// değişmeden kalır, sadece görüntülenen metin çeviri anahtarına eşlenir.
const TAB_LABEL_KEYS: Record<ValidPlayerTab, string> = {
  overview: "playerDetail.tabOverview",
  "detailed-stats": "playerDetail.tabDetailedStats",
  advanced: "playerDetail.tabAdvanced",
  "match-log": "playerDetail.tabMatchLog",
};

function StatInline({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-ink">
        {value}
      </div>
    </div>
  );
}

export async function PlayerDetailHeader({
  profile,
  activeTab,
  currentInfo = null,
  marketValueEur = null,
}: PlayerDetailHeaderProps) {
  const t = await getT();

  // Kart güncel takımı gösterir; opta profili eski takımda kalmış olsa bile
  // (ara transfer) başlıkta güncel kadro bilgisi esas alınır.
  const displayTeamSlug = currentInfo?.current_team_slug ?? profile.team_slug;
  const displayTeamName = currentInfo?.current_team_name ?? profile.team_name;
  const displayPlayerName =
    [currentInfo?.first_name, currentInfo?.last_name]
      .filter(Boolean)
      .join(" ") ||
    currentInfo?.full_name ||
    profile.player_name;

  const backToTeamHref =
    getTeamDetailHref(displayTeamSlug)
      ? `${getTeamDetailHref(displayTeamSlug)}&tab=squad`
      : "/dashboard/stats-analysis/football/team-stats";

  const logoPath = getTeamLogoPath(displayTeamSlug);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-veil p-2">
            {currentInfo?.photo_url ? (
              <Image
                src={currentInfo.photo_url}
                alt={profile.player_name}
                width={64}
                height={64}
                className="h-auto max-h-[64px] w-auto max-w-[64px] rounded-xl object-contain"
              />
            ) : logoPath ? (
              <Image
                src={logoPath}
                alt={profile.team_name}
                width={52}
                height={52}
                className="h-auto max-h-[52px] w-auto max-w-[52px] object-contain"
              />
            ) : (
              <div className="text-xs text-ink-3">—</div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent-ink">
              {t("playerDetail.profileKicker")}
            </p>

            <h1 className="mt-1 truncate text-xl font-semibold text-ink lg:text-2xl">
              {displayPlayerName}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                {logoPath ? (
                  <Image
                    src={logoPath}
                    alt={displayTeamName}
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] shrink-0 object-contain"
                  />
                ) : null}
                <span>{displayTeamName}</span>
              </span>
              <span>•</span>
              <span>{profile.primary_position_code}</span>
              <span>•</span>
              <span>{profile.competition ?? "—"}</span>
              <span>•</span>
              <span>{profile.season_label ?? "—"}</span>
            </div>

            {currentInfo ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-line-strong bg-accent-soft px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent-ink">
                  {t("playerDetail.currentBadge")}
                </span>
                <span className="text-ink">
                  {currentInfo.current_team_name}
                </span>
                {currentInfo.shirt_number !== null ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span className="text-ink">
                      #{currentInfo.shirt_number}
                    </span>
                  </>
                ) : null}
                {currentInfo.position ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span className="text-ink">{currentInfo.position}</span>
                  </>
                ) : null}
                {currentInfo.age !== null ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span className="text-ink">
                      {t("playerDetail.ageValue", { age: currentInfo.age })}
                    </span>
                  </>
                ) : null}
                {marketValueEur !== null ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span
                      className="font-semibold text-pos"
                      title={t("common.marketValue")}
                    >
                      {formatMarketValue(marketValueEur)}
                    </span>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-line bg-veil px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  {t("common.notInCurrentSquads")}
                </span>
                <span className="text-ink-3">
                  {t("playerDetail.statsFromPastSeasons", {
                    team: profile.team_name,
                  })}
                </span>
              </div>
            )}

            {currentInfo &&
            (currentInfo.nationality ||
              currentInfo.height_cm ||
              currentInfo.birth_date) ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                {currentInfo.nationality ? (
                  <span className="inline-flex items-center gap-1.5">
                    {getCountryFlagUrl(currentInfo.nationality) ? (
                      <Image
                        src={getCountryFlagUrl(currentInfo.nationality)!}
                        alt={currentInfo.nationality}
                        width={16}
                        height={12}
                        className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                      />
                    ) : null}
                    <span>
                      {canonicalNationality(currentInfo.nationality)}
                    </span>
                  </span>
                ) : null}
                {currentInfo.height_cm ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span>
                      {t("playerDetail.heightCm", {
                        value: currentInfo.height_cm,
                      })}
                    </span>
                  </>
                ) : null}
                {currentInfo.weight_kg ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span>
                      {t("playerDetail.weightKg", {
                        value: currentInfo.weight_kg,
                      })}
                    </span>
                  </>
                ) : null}
                {currentInfo.birth_date ? (
                  <>
                    <span className="text-ink-3">•</span>
                    <span>
                      {currentInfo.birth_date}
                      {currentInfo.birth_place
                        ? ` (${currentInfo.birth_place})`
                        : ""}
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VALID_PLAYER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const href = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
              profile.player_slug
            )}&tab=${tab}`;

            return (
              <Link
                key={tab}
                href={href}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-line-strong bg-card-2 text-ink"
                    : "border-line bg-veil text-ink-2 hover:bg-veil"
                }`}
              >
                {t(TAB_LABEL_KEYS[tab])}
              </Link>
            );
          })}

          <Link
            href={backToTeamHref}
            className="rounded-xl border border-line bg-veil px-3 py-2 text-sm text-ink transition hover:bg-veil"
          >
            {t("playerDetail.backButton")}
          </Link>
        </div>
      </div>

      <div className="mt-3 grid gap-x-5 gap-y-3 border-t border-line pt-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatInline label={t("common.appearances")} value={profile.appearances} />
        <StatInline label={t("common.starts")} value={profile.starts} />
        <StatInline label={t("playerDetail.minutesLabel")} value={profile.total_minutes} />
        <StatInline label={t("common.goals")} value={profile.goals} />
        <StatInline label={t("common.assists")} value={profile.assists} />
        <StatInline
          label={t("playerDetail.starterRateLabel")}
          value={`${formatDecimal(profile.starter_rate_pct)}%`}
        />
      </div>
    </div>
  );
}
