// ntfy.sh push bildirimi (SADECE server tarafinda kullan). Pipeline'daki
// notify.sh'in web karsiligi: NTFY_TOPIC env tanimli degilse sessiz cikar.
// Bildirim opsiyonel katmandir; hata veya zaman asimi is akisini durdurmaz.

const NTFY_TIMEOUT_MS = 3000;

type NtfyOptions = {
  priority?: "min" | "low" | "default" | "high" | "urgent";
  // ntfy tag listesi, virgullu (emoji kisayollari: key, no_entry, ...)
  tags?: string;
};

// Baslik HTTP header'inda tasindigi icin ASCII olmali; Turkce karakterleri
// govdeye yaz.
export async function sendNtfy(
  title: string,
  message: string,
  opts?: NtfyOptions
): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;

  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: opts?.priority ?? "default",
        Tags: opts?.tags ?? "rotating_light",
      },
      body: message,
      signal: AbortSignal.timeout(NTFY_TIMEOUT_MS),
    });
  } catch {
    // bilincli sessiz: bildirim gitmedi diye giris akisi bozulmaz
  }
}
