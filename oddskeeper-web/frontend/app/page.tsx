import Image from "next/image";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import footballImage from "@/images/football.png";
import basketballImage from "@/images/basketball.png";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-200 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <AppHeader
          title="Odds Keeper"
          subtitle="Bir spor seçerek devam et"
        />

        <div className="grid gap-8 md:grid-cols-2">
          <Link href="/football" className="block">
            <div className="rounded-3xl bg-white p-8 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col items-center justify-center">
                <Image
                  src={footballImage}
                  alt="Football"
                  width={320}
                  height={320}
                  className="mb-6 h-auto w-auto object-contain"
                  priority
                />
                <h2 className="text-4xl font-medium text-slate-900">Football</h2>
              </div>
            </div>
          </Link>

          <Link href="/basketball" className="block">
            <div className="rounded-3xl bg-white p-8 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col items-center justify-center">
                <Image
                  src={basketballImage}
                  alt="Basketball"
                  width={320}
                  height={320}
                  className="mb-6 h-auto w-auto object-contain"
                  priority
                />
                <h2 className="text-4xl font-medium text-slate-900">
                  Basketball
                </h2>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}