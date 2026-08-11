"use client";

// pm_* / bb_pm_* yazma islemleri artik dogrudan anon anahtarla degil, server
// route uzerinden (service-role) yapilir. Boylece bu tablolarda anon
// INSERT/UPDATE/DELETE grant'i kaldirilabilir; route her istegi getNavAccess
// ile dogrular (giris yapmamis istek 401 alir).
export async function pmWrite(
  endpoint: string,
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = String(res.status);
      try {
        msg = (await res.json())?.error ?? msg;
      } catch {
        // govde JSON degilse status kodu yeter
      }
      console.error(`pmWrite ${endpoint}`, msg);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`pmWrite ${endpoint}`, e);
    return false;
  }
}
