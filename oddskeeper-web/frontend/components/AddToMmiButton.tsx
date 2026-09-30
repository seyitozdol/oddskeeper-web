"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { uploadViaMmiBridge } from "@/lib/mmi-bridge";

export type MmiFile = { filename: string; data: ArrayBuffer };

// "Add to MMI": export dosyasini diske yazmadan tarayicidaki kopru betigine verir
// (lib/mmi-bridge). build() o ekranin Export dugmesiyle AYNI dosyayi bellekte uretir.
// onSent yalniz basarili yuklemede cagrilir: export gecmisi gercekten gidene uysun.
export default function AddToMmiButton({
  build,
  onSent,
  disabled,
  className,
  align = "right",
}: {
  build: () => MmiFile | Promise<MmiFile>;
  onSent?: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  // Sonuc notunun dugmeye gore hizasi: dugme satirin saginda ise "right".
  align?: "left" | "right";
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const file = await build();
      const res = await uploadViaMmiBridge(file.filename, file.data);
      if (!res) {
        setNotice({ ok: false, text: t("common.mmiNoBridge") });
      } else if (res.ok) {
        setNotice({ ok: true, text: t("common.mmiSent") });
        await onSent?.();
      } else if (!res.cancelled) {
        const detail = [res.status ? `(${res.status})` : "", res.body].filter(Boolean).join(" ");
        setNotice({ ok: false, text: `${t("common.mmiFailed")} ${detail}`.trim().slice(0, 300) });
      }
    } catch {
      setNotice({ ok: false, text: t("common.mmiFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={send} disabled={disabled || busy} className={className}>
        {busy ? t("common.mmiSending") : t("common.addToMmi")}
      </button>
      {notice && (
        <span
          role="status"
          onClick={() => setNotice(null)}
          className={`absolute top-full z-20 mt-1 w-max max-w-[420px] cursor-pointer rounded-md border border-line bg-card px-2 py-1 text-[11px] shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } ${notice.ok ? "text-pos" : "text-neg"}`}
        >
          {notice.text}
        </span>
      )}
    </span>
  );
}
