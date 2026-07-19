import PlayerStatsExplorer from "@/features/player-stats/components/PlayerStatsExplorer";
import { getPlayerStatsList } from "@/features/player-stats/server/getPlayerStatsList";

export default async function FootballPlayerStatsPage() {
  const rows = await getPlayerStatsList();

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-8 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
            Football Player Stats
          </p>

          <h1 className="text-3xl font-semibold text-white lg:text-5xl">
            Türkiye Super League Players
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 lg:text-base">
            Oyuncu ara, takıma veya pozisyona göre filtrele. Bir oyuncuya
            tıklayınca kendi detay sayfası açılır.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
            Oyuncu verisi bulunamadı.
          </div>
        ) : (
          <PlayerStatsExplorer rows={rows} />
        )}
      </div>
    </section>
  );
}
