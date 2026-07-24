import { defineMessages } from "../defineMessages";

export const adminUsers = defineMessages({
  en: {
    title: "User Management",
    subtitle:
      "Manage which header sections each user can access. Unchecked sections disappear from the user's header and direct links redirect to the dashboard.",
    userColumn: "User",
    createdColumn: "Signed up",
    lastSignInColumn: "Last sign-in",
    adminColumn: "Admin",
    accessColumn: "Header access",
    never: "Never",
    loading: "Loading users...",
    loadError: "Users could not be loaded.",
    saveError: "Change could not be saved, it was reverted.",
    retry: "Retry",
    fullAccess: "Full access",
    restricted: "Restricted",
    selfAdminHint: "You cannot remove your own admin role.",
    userCount: "{count} users",
  },
  tr: {
    title: "Kullanıcı Yönetimi",
    subtitle:
      "Her kullanıcının header'daki hangi başlıklara erişebileceğini buradan yönet. İşareti kaldırılan başlık kullanıcının header'ından kaybolur, doğrudan bağlantılar da panoya yönlendirilir.",
    userColumn: "Kullanıcı",
    createdColumn: "Kayıt",
    lastSignInColumn: "Son giriş",
    adminColumn: "Admin",
    accessColumn: "Header erişimi",
    never: "Hiç girmedi",
    loading: "Kullanıcılar yükleniyor...",
    loadError: "Kullanıcılar yüklenemedi.",
    saveError: "Değişiklik kaydedilemedi, geri alındı.",
    retry: "Tekrar dene",
    fullAccess: "Tam erişim",
    restricted: "Kısıtlı",
    selfAdminHint: "Kendi admin yetkini kaldıramazsın.",
    userCount: "{count} kullanıcı",
  },
});
