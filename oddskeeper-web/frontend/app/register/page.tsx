import { redirect } from "next/navigation";

// Eski demo kayit sayfasi; kayit kapali, /sign-up offline sayfasina gider.
export default function RegisterPage() {
  redirect("/sign-up");
}
