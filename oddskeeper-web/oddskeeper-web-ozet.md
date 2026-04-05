# Odds Keeper Web Özeti

## 1. Bu aşamada ne kurduk?

Web tarafında çalışan bir **proof of concept** kurduk.

Şu an çalışan yapı:
- **Next.js frontend**
- **FastAPI backend**
- **Supabase bağlantısı**
- **maç listesi ekranı**
- **maç detay ekranı**
- **login ekranı**
- **register ekranı**
- **ortak header component**

Bu yapı final ürün değil. Ama teknik iskeletin çalıştığını kanıtlayan düzgün bir başlangıç.

---

## 2. Şu an çalışan akışlar

### Ana sayfa
Ana sayfada şunlar çalışıyor:
- API health bilgisi gösteriliyor
- staging maç listesi geliyor
- takım adına göre filtreleme var
- `Yenile` butonu ile veri tekrar çekiliyor
- maç kartına tıklanınca detay sayfasına gidiliyor

### Maç detay sayfası
Detay sayfasında şunlar gösteriliyor:
- home / away takım adı
- skor
- hakem
- stadyum
- competition
- match date text
- attendance
- team id alanları
- status alanları
- section sayıları
- opta points key bilgileri
- dış link (`match_url`) varsa açma butonu
- geri dön butonu

### Login ekranı
- e-posta alanı
- şifre alanı
- boş alan kontrolü
- loading durumu
- demo giriş yönlendirmesi

### Register ekranı
- e-posta
- şifre
- şifre tekrar
- boş alan kontrolü
- şifre eşleşme kontrolü
- demo başarı mesajı

---

## 3. Neden burada durmak mantıklı?

Çünkü şu an frontend hâlâ büyük ölçüde **staging/raw veriye yakın** bir yapıdan besleniyor.

Yani şu anki endpoint mantığı daha çok:
- ham veriyi çek
- içinden bazı alanları ayıkla
- frontend’e göster

Bu başlangıç için doğruydu.
Ama uzun vadede doğru yapı bu değil.

Doğru uzun vadeli yapı şu olmalı:
- scrape / parse tamamlanır
- raw/staging veriler normalize edilir
- anlamlı tablolar oluşur
- web artık bu temiz tablolardan beslenir

Örnek hedef tablolar:
- `matches`
- `teams`
- `competitions`
- `players`
- `player_statistics`

Bu yüzden web tarafını burada fazla derinleştirmek yerine, veri modelleme tarafına geri dönmek daha mantıklı.

---

## 4. Şu an oluşan frontend dosya yapısı

```text
frontend/
  app/
    page.tsx
    login/
      page.tsx
    register/
      page.tsx
    matches/
      [id]/
        page.tsx
  components/
    AppHeader.tsx
    MatchCard.tsx
    StateMessage.tsx
  hooks/
    useStagingMatches.ts
  lib/
    api.ts
    supabase.ts
```

### Dosyalar ne işe yarıyor?

#### `app/page.tsx`
Ana sayfa.
Maç listesi, filtre, yenile butonu ve kart listesi burada çalışıyor.

#### `app/login/page.tsx`
Login ekranı.
Şu an demo akış çalışıyor.

#### `app/register/page.tsx`
Kayıt ekranı.
Şifre tekrar kontrolü burada yapılıyor.

#### `app/matches/[id]/page.tsx`
Seçilen maçın detay sayfası.

#### `components/AppHeader.tsx`
Ortak üst alan.
Ana sayfa, login ve detay ekranında kullanılıyor.

#### `components/MatchCard.tsx`
Ana sayfadaki maç kartı.
Kart tıklanınca detay sayfasına gider.

#### `components/StateMessage.tsx`
Loading / error / empty state için ortak component.

#### `hooks/useStagingMatches.ts`
Ana sayfadaki veri çekme mantığı burada.
`apiStatus`, `matches`, `error`, `isLoading`, `refetch` yönetiliyor.

#### `lib/api.ts`
Frontend’in backend ile konuştuğu yer.
API çağrıları burada tutuluyor.

#### `lib/supabase.ts`
Frontend Supabase client tanımı.
Şu an temel bağlantı amaçlı hazırlandı.

---

## 5. Backend tarafında ne yaptık?

Backend tarafında şunları kurduk:
- FastAPI app
- CORS ayarı
- Supabase bağlantısı
- health endpoint
- staging preview endpoint
- staging match detail endpoint

Yani backend şu an:
- Supabase’e bağlanabiliyor
- veri çekebiliyor
- frontend’e sadeleştirilmiş veri döndürebiliyor

---

## 6. Bundan sonra en mantıklı teknik yön

Buradan sonra önerilen sıra:

1. **scrape / parse tarafını bitir**
2. **raw/staging veriyi normalize et**
3. **anlamlı tabloları oturt**
4. sonra web tarafını şu endpointlere geçir:
   - `/matches`
   - `/matches/{id}`
   - `/teams`
   - `/players`

Yani web tarafında bir sonraki büyük adım, yeni UI yapmak değil;
**gerçek veri modeline geçmek** olmalı.

---

## 7. Net sonuç

Bu aşamada web tarafı için hedeflenen şey başarıyla yapıldı:
- çalışan frontend
- çalışan backend
- çalışan Supabase bağlantısı
- çalışan liste/detay akışı
- çalışan login/register UI

Bu yapı final değil.
Ama devam etmek için yeterince sağlam bir temel.
