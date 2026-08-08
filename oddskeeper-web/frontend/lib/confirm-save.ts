import { confirmDialog } from "./confirm-dialog";

// Config kaydetmeden once ortak onay. Native window.confirm yerine uygulama ici
// modal (bkz. confirm-dialog). Metin kullanicinin istegi uzerine daima
// Ingilizce. Evet dendiginde true doner.
export function confirmPermanentSave(): Promise<boolean> {
  return confirmDialog(
    "This change will be applied permanently. Are you sure?"
  );
}
