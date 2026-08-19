# -*- coding: utf-8 -*-
"""Gunluk otomatik logout — sunucu tarafi refresh-token iptali.

Admin OLMAYAN tum kullanicilarin oturumlarini gece 23:59 UTC sinirinda kapatir:
auth.sessions satirlari silinir (auth.refresh_tokens FK ON DELETE CASCADE ile
birlikte gider) -> kullanicinin sonraki token-refresh denemesi basarisiz olur,
/sign-in'e duser.

Frontend'deki iat kontrolu (frontend/lib/auth/daily-logout.ts) tek basina
YETERSIZ cikti: proxy'deki getClaims() suresi dolmus token'i kontrol ONCESI
refresh edip iat'i "simdi" yapiyor; gece boyu bosta kalan kullanici (asil
hedef) hic yakalanmiyordu. Bu script deterministik ana katman; iat kontrolu
sinirdan onceki ~1 saatte basilmis hala-gecerli token'lari yakalayan
tamamlayici olarak kalir.

Sinir: en son GECMIS 23:59 UTC (frontend ile ayni formul). Sinirdan SONRA
acilan oturum (yeni giris) MUAF — yalnizca sinir oncesi created_at silinir.
Cron'un tam 23:59 UTC'de kosmasi sart degil (VPS cron Europe/Berlin yerel
saatte tetikler, DST ile 1 saat kayar); script siniri her kosuda kendisi
hesaplar, gec kosma yalnizca iptal anini geciktirir.

Fail-safe: user_nav_permissions'ta is_admin=true HIC yoksa (tablo bos/bozuk)
HICBIR SEY silinmez, exit 1.

Elle prova: .venv\\Scripts\\python.exe src\\common\\daily_logout_revoke.py --dry-run
"""

import os
import sys
import io
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# frontend env DAILY_LOGOUT_UTC_HOUR/_MINUTE ile ayni tutulmali (varsayilan 23:59).
BOUNDARY_UTC_HOUR = 23
BOUNDARY_UTC_MINUTE = 59


def last_boundary_utc(now: datetime) -> datetime:
    """Verilen ana gore en son GECMIS 23:59 UTC siniri."""
    cand = now.replace(
        hour=BOUNDARY_UTC_HOUR, minute=BOUNDARY_UTC_MINUTE, second=0, microsecond=0
    )
    if cand > now:
        cand -= timedelta(days=1)
    return cand


def main() -> int:
    dry_run = "--dry-run" in sys.argv[1:]
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    now = datetime.now(timezone.utc)
    boundary = last_boundary_utc(now)
    print(f"=== DAILY LOGOUT REVOKE @ {now.isoformat()} (sinir: {boundary.isoformat()})"
          f"{' [DRY-RUN]' if dry_run else ''} ===")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("select user_id from public.user_nav_permissions where is_admin = true")
    admin_ids = [str(r[0]) for r in cur.fetchall()]
    if not admin_ids:
        print("HATA: is_admin=true kullanici bulunamadi (tablo bos/bozuk?) — "
              "guvenlik geregi hicbir oturum silinmedi.")
        conn.close()
        return 1
    print(f"muaf admin sayisi: {len(admin_ids)}")

    cur.execute(
        """
        select u.email, count(*)
        from auth.sessions s
        join auth.users u on u.id = s.user_id
        where s.created_at < %s and s.user_id <> all(%s::uuid[])
        group by u.email
        order by u.email
        """,
        (boundary, admin_ids),
    )
    rows = cur.fetchall()
    total = sum(n for _, n in rows)
    for email, n in rows:
        print(f"  {email}: {n} oturum")
    print(f"toplam iptal edilecek oturum: {total}")

    if dry_run:
        print("DRY-RUN: silme yapilmadi.")
        conn.close()
        return 0

    if total:
        # refresh_tokens FK ON DELETE CASCADE -> oturumla birlikte iptal olur.
        cur.execute(
            "delete from auth.sessions s where s.created_at < %s and s.user_id <> all(%s::uuid[])",
            (boundary, admin_ids),
        )
        deleted = cur.rowcount
        conn.commit()
        print(f"silindi: {deleted} oturum (refresh token'lar cascade iptal)")
    else:
        print("silinecek oturum yok.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
