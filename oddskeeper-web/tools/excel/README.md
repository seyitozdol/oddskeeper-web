# Player Market Prediction - Excel (xlsm) surumu

Sitedeki Player Market Prediction sayfasinin makrolu Excel karsiligi.
Veriyi dogrudan Supabase'den ceker (Yenile), siteyle ayni tablolara yazar
(Kaydet butonlari) ve Input xlsx ciktisini uretir (Yazdir).

## Kurulum: is bilgisayarinda elle import (kurulum/ayar gerektirmez)

`vba` klasorundeki 10 dosyayi bilgisayara kopyala (USB/mail/GitHub'dan indir),
sonra:

1. Excel'de bos calisma kitabi ac, **Farkli Kaydet > Excel Macro-Enabled
   Workbook (.xlsm)** olarak kaydet (or. `PlayerMarket.xlsm`).
2. **Alt+F11** ile VBA editorunu ac.
3. Soldaki proje agacinda VBAProject uzerine sag tik > **Import File** ile
   10 dosyayi sirayla al: `modApi.bas`, `modCalc.bas`, `modData.bas`,
   `modModel.bas`, `modAdd.bas`, `modInput.bas`, `modSave.bas`,
   `modSetup.bas`, `modEvents.bas`, `clsAppEvents.cls`.
4. Editoru kapat. **Alt+F8** > `SetupWorkbook` > Calistir.
   Tum sayfalar, butonlar ve ayarlar kurulur. Kaydet.
5. Model sayfasinda **Yenile** butonuna bas (internet gerekir; Supabase'e
   https erisimi acik olmali).

Not: Dosyayi her acista makrolari etkinlestirmen istenir. Kurumsal Excel
makrolari tamamen engelliyorsa dosya ozelliklerinden "Engellemeyi kaldir"
(Unblock) gerekebilir.

Modul guncelleme: bir .bas dosyasinin yeni surumunu alirken once VBA
editorunde eski modulu sag tik > **Remove** (Export etme, sil), sonra yeni
dosyayi Import et. (Ayni isimli modul varken import, modAdd1 gibi kopya
olusturur ve eski kod calismaya devam eder.)

## Kullanim

- **Model**: B1'den fikstur, I1'den market sec, **Modeli Kur** butonuna bas;
  oyuncu bloklari kurulur. Durum/Manuel/beklenti/payback degistirdikten sonra
  **Hesapla** ile line ve oranlar yeniden hesaplanir. Beklenti Dagit EVET ise
  Ev/Dep beklentisi ortalamalara gore dagitilir; Manuel kolonu dagitimi ezer
  (Manuel'e deger girince oyuncu tiki otomatik dolar). Oranlar elle
  duzeltilebilir. Tik hucrelerine **cift tiklayarak** x koyup kaldirabilirsin
  (dropdown da calisir). Kolon basliklarina (Oyuncu, Ort, Son5, GS vb.)
  **cift tiklamak** o blogu once buyukten kucuge siralar, tekrari yonu
  cevirir. **Ekle** ile Input'a gonder. Dinamik markette line yerine tek
  Deger vardir; oyuncu tiki + deger yeterlidir.
- **Oyuncu Listesi / Market Listesi / Fixture ID**: ID, template, tur ve
  fixture degerlerini duzenle; **Kaydet** Supabase'e yazar (siteyle ortak).
  Market Listesi'nde en alta yeni satir yazip Kaydet = yeni ozel market.
  Market Listesi'ndeki **Model** kolonu (x, cift tikla da acilir) hangi
  marketlerin Model dropdown'inda listelenecegini belirler; hicbiri isaretli
  degilse hepsi listelenir. Bu tercih yalnizca Excel'de tutulur.
- **Static / Dynamic Input**: Ekle'nin dusurdugu satirlar. **Yazdir** tek
  sheet'li ("input") xlsx uretir, dosya adi fixture adidir; **Temizle**
  tabloyu bosaltir. Ayni mac + oyuncu + line tekrar eklenirse uyari verilir;
  once tablodan satiri sil (satiri Excel'de dogrudan silebilirsin).

## Alternatif: otomatik derleme (lisansli Excel olan makinede)

"VBA proje nesne modeline erisime guven" ayari acikken:
`powershell -ExecutionPolicy Bypass -File build_xlsm.ps1`
`PlayerMarket.xlsm` uretir.

## Siteden farklar

- Model otomatik degil butonla kurulur/hesaplanir (Modeli Kur, Hesapla).
- Durum cikarimi yaklasiktir: sitede son 10 macin agirlikli ilk 11/yedek
  dagilimina bakilir; Excel'de mac sayisi + ilk 11 orani + son mac tarihi
  kullanilir. Gerekirse Durum dropdown'dan elle duzelt.
- Son5, siteyle ayni yontemle mac loglarindan hesaplanir (son 5 macin
  ortalamasi); Modeli Kur sirasinda takim basina bir istek atilir. Sezon
  ici baska takimdan transfer olan oyuncunun eski takim maclari sayilmaz.
- Mac kolonunda gecen sezon parantezi "-" gosterir (profillerde henuz onceki
  sezon verisi yok).
