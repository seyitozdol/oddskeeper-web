export function getWebsiteLabel(value: string | null | undefined) {
  if (!value) return "—";

  try {
    const normalized =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;

    const url = new URL(normalized);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}