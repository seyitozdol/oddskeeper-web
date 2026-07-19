// Her namespace dosyası bu yardımcıyla tanımlanır: en anahtar kümesi
// kaynak kabul edilir, tr aynı anahtarları içermek zorundadır (typecheck
// eksik çeviriyi yakalar).
export function defineMessages<T extends Record<string, string>>(messages: {
  en: T;
  tr: { [K in keyof T]: string };
}) {
  return messages;
}
