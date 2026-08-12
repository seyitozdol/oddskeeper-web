import { defineMessages } from "../defineMessages";

// Kadro denetimi sayfasi (header'daki herkese acik 3 sekme).
export const squadAudit = defineMessages({
  en: {
    title: "Squad Audit",
    subtitle: "Daily comparison of our squads with Transfermarkt and participant id coverage.",
    tabOursNotTm: "Not on TM",
    tabTmNotOurs: "Missing from us",
    tabNoParticipantId: "No participant id",
    hintOursNotTm: "Players in our squads that no longer appear in the Transfermarkt squad (possible departures).",
    hintTmNotOurs: "Players in the Transfermarkt squad that we don't have yet (possible missing transfers).",
    hintNoParticipantId: "Players without a Player Stats Model participant id.",
    leagueTsl: "Süper Lig",
    leagueTff1: "1. Lig",
    lastRun: "Last run",
    empty: "No records. The list refreshes after the morning run.",
    playersCount: "{count} players",
  },
  tr: {
    title: "Kadro Denetimi",
    subtitle: "Kadrolarımızın Transfermarkt ile günlük kıyası ve participant id kapsaması.",
    tabOursNotTm: "TM'de yok",
    tabTmNotOurs: "Bizde eksik",
    tabNoParticipantId: "Participant id yok",
    hintOursNotTm: "Bizim kadroda olup Transfermarkt kadrosunda artık görünmeyen oyuncular (muhtemel ayrılıklar).",
    hintTmNotOurs: "Transfermarkt kadrosunda olup bizde henüz olmayan oyuncular (muhtemel eksik transferler).",
    hintNoParticipantId: "Player Stats Model participant id'si olmayan oyuncular.",
    leagueTsl: "Süper Lig",
    leagueTff1: "1. Lig",
    lastRun: "Son koşu",
    empty: "Kayıt yok. Liste sabah koşusundan sonra tazelenir.",
    playersCount: "{count} oyuncu",
  },
});
