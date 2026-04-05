"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import MatchCard from "@/components/MatchCard";
import StateMessage from "@/components/StateMessage";
import useStagingMatches from "@/hooks/useStagingMatches";
import { footballTeams } from "@/lib/footballTeams";

type MainTab = "prediction" | "statistics" | "dashboard";
type PredictionMenu = "team" | "player";
type StatisticsMenu = "team" | "player";

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-5 py-3 text-xl font-medium transition md:text-2xl ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "bg-transparent text-white/95 hover:bg-white/10"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-sm ${
          active ? "bg-slate-900" : "bg-white"
        }`}
      />
      <span>{label}</span>
    </button>
  );
}

function SubMenuButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function FootballPage() {
  const { apiStatus, matches, error, isLoading, refetch } = useStagingMatches();

  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [activePredictionMenu, setActivePredictionMenu] =
    useState<PredictionMenu>("team");
  const [activeStatisticsMenu, setActiveStatisticsMenu] =
    useState<StatisticsMenu>("team");

  function renderDashboardContent() {
    if (error) {
      return <StateMessage type="error" message={error} />;
    }

    if (isLoading) {
      return <StateMessage type="loading" message="Loading..." />;
    }

    if (matches.length === 0) {
      return <StateMessage type="empty" message="No matches available." />;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    );
  }

  function renderPredictionContent() {
    if (activePredictionMenu === "team") {
      return (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">
            Prediction / Team
          </h3>
          <p className="mt-3 text-slate-600">
            Team-based prediction content will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">
          Prediction / Player
        </h3>
        <p className="mt-3 text-slate-600">
          Player-based prediction content will appear here.
        </p>
      </div>
    );
  }

  function renderStatisticsContent() {
    if (activeStatisticsMenu === "team") {
      return (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">
            Statistics / Team
          </h3>
          <p className="mt-3 text-slate-600">
            Select a team to continue.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {footballTeams.map((team) => (
              <Link
                key={team.slug}
                href={`/football/teams/${team.slug}`}
                className="group block"
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center transition hover:border-slate-400 hover:shadow-sm">
                  <div className="mx-auto flex h-32 w-32 items-center justify-center bg-white">
                    <Image
                      src={team.logo}
                      alt={team.name}
                      width={110}
                      height={110}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {team.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h3 className="text-2xl font-semibold text-slate-900">
          Statistics / Player
        </h3>
        <p className="mt-3 text-slate-600">
          Player-based statistics content will appear here.
        </p>
      </div>
    );
  }

  function renderContent() {
    if (activeTab === "prediction") {
      return renderPredictionContent();
    }

    if (activeTab === "statistics") {
      return renderStatisticsContent();
    }

    return renderDashboardContent();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <AppHeader title="Football" subtitle="Football workspace" />

        <div className="mb-5 rounded-2xl bg-[#1f6b8f] px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <TabButton
              label="Prediction"
              active={activeTab === "prediction"}
              onClick={() => setActiveTab("prediction")}
            />

            <TabButton
              label="Statistics"
              active={activeTab === "statistics"}
              onClick={() => setActiveTab("statistics")}
            />

            <TabButton
              label="Dashboard"
              active={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
            />
          </div>
        </div>

        {(activeTab === "prediction" || activeTab === "statistics") && (
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "prediction" && (
                <>
                  <SubMenuButton
                    label="Team"
                    active={activePredictionMenu === "team"}
                    onClick={() => setActivePredictionMenu("team")}
                  />
                  <SubMenuButton
                    label="Player"
                    active={activePredictionMenu === "player"}
                    onClick={() => setActivePredictionMenu("player")}
                  />
                </>
              )}

              {activeTab === "statistics" && (
                <>
                  <SubMenuButton
                    label="Team"
                    active={activeStatisticsMenu === "team"}
                    onClick={() => setActiveStatisticsMenu("team")}
                  />
                  <SubMenuButton
                    label="Player"
                    active={activeStatisticsMenu === "player"}
                    onClick={() => setActiveStatisticsMenu("player")}
                  />
                </>
              )}
            </div>
          </div>
        )}

        <div className="mb-5">{renderContent()}</div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800">
              API status: {apiStatus}
            </div>

            <button
              onClick={refetch}
              disabled={isLoading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}