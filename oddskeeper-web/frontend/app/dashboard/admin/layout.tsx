import type { ReactNode } from "react";
import AdminTabs from "./tabs";

// Admin bolumu ortak cercevesi: sekme cubugu + icerik. Yetki kontrolu her
// sayfanin kendisinde (getNavAccess + redirect); proxy de /dashboard/admin
// yollarini admin'e kilitler.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminTabs />
      {children}
    </div>
  );
}
