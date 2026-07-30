import { redirect } from "next/navigation";

// Eski demo giris sayfasi; gercek akis /sign-in'de.
export default function LoginPage() {
  redirect("/sign-in");
}
