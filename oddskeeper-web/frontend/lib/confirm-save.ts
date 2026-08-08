// Config kaydetmeden once ortak onay. Metin kullanicinin istegi uzerine daima
// Ingilizce. Evet dendiginde true doner; iptal edilirse false.
export function confirmPermanentSave(): boolean {
  return window.confirm(
    "This change will be applied permanently. Are you sure?"
  );
}
