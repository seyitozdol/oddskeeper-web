// Gunluk otomatik logout siniri.
//
// Amac: admin OLMAYAN her kullanici her gun server saatiyle 23:59'da (UTC)
// otomatik cikis yapsin. Supabase JWT'leri stateless oldugu ve proxy JWT'yi
// YERELDE dogruladigi (getClaims) icin sunucu tarafi oturum iptali token
// suresi dolana kadar (~1s) etki etmez. Bunun yerine deterministik bir sinir
// uyguluyoruz: oturum en son gecen 23:59 UTC sinirindan ONCE acilmissa
// (JWT iat sinirdan kucukse) kullanici cikarilir. Cron/servis-rol/Vercel
// zamanlayici GEREKMEZ; kontrol her istekte auth kapisinda yapilir.
//
// Not: iat token yenilendikce ilerler ve proxy'deki getClaims() suresi dolmus
// token'i kontrol ONCESI refresh eder -> gece boyu bosta kalan kullanicinin
// iat'i sabah ilk istekte "simdi" olur, bu kontrol onu YAKALAYAMAZ. Bu yuzden
// asil zorlama VPS cron'undaki sunucu tarafi oturum iptalidir
// (pipeline/src/common/daily_logout_revoke.py, 23:59 UTC sinirinda non-admin
// auth.sessions delete). Buradaki kontrol tamamlayici katman: sinirdan onceki
// ~1 saatte basilmis, suresi HENUZ dolmamis token'lari yakalar.

const DEFAULT_HOUR = 23;
const DEFAULT_MINUTE = 59;

function envInt(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) return fallback;
  return n;
}

/** Ozellik acik mi (DAILY_LOGOUT_ENABLED=0 ile kapatilir; varsayilan acik). */
export function isDailyLogoutEnabled(): boolean {
  return process.env.DAILY_LOGOUT_ENABLED !== "0";
}

/** Verilen ana gore en son GECMIS 23:59 UTC sinirinin epoch-ms degeri. */
export function lastDailyLogoutBoundaryMs(nowMs: number = Date.now()): number {
  const hour = envInt("DAILY_LOGOUT_UTC_HOUR", DEFAULT_HOUR, 23);
  const minute = envInt("DAILY_LOGOUT_UTC_MINUTE", DEFAULT_MINUTE, 59);
  const d = new Date(nowMs);
  const candidate = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    hour,
    minute,
    0,
    0
  );
  // Bugunun siniri henuz gelmediyse dunun sinirini kullan.
  return candidate <= nowMs ? candidate : candidate - 24 * 60 * 60 * 1000;
}

/**
 * Oturum (JWT iat, saniye) en son gunluk logout sinirindan once mi acildi?
 * true ise kullanici cikarilmali. iat yoksa/gecersizse false (guvenli taraf:
 * yanlislikla cikarma).
 */
export function isSessionPastDailyLogout(
  iatSeconds: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!isDailyLogoutEnabled()) return false;
  if (typeof iatSeconds !== "number" || !Number.isFinite(iatSeconds)) {
    return false;
  }
  return iatSeconds * 1000 < lastDailyLogoutBoundaryMs(nowMs);
}
