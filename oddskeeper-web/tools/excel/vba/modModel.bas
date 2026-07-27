Attribute VB_Name = "modModel"
Option Explicit

' Model sayfasi: fikstur/market secimine gore oyuncu bloklarini kurar,
' dagitim + line/oran hesabini yapar. Blok bilgileri _cfg'de tutulur:
' B10 evStart, B11 evAdet, B12 depStart, B13 depAdet, B14 dinamikMi,
' B15 fixtureId, B16 fixtureLabel, B17 marketKey, B18 template,
' B19 marketType, B20 marketLabel, B21 includeGk, B22 metricKey,
' B23 sezon, B24 oncekiSezon

' Kolonlar: A Tik, B Oyuncu, C Poz, D Mac, E Durum, F Ort, G Son5, H GS,
' I Dagitilan, J Manuel, K/N/Q/T Line, L/O/R/U Oran, M/P/S/V Tik,
' X player_key (gizli), Y player_slug (gizli)

Public Const COL_TIK As Long = 1
Public Const COL_NAME As Long = 2
Public Const COL_POS As Long = 3
Public Const COL_MAC As Long = 4
Public Const COL_DURUM As Long = 5
Public Const COL_ORT As Long = 6
Public Const COL_SON5 As Long = 7
Public Const COL_GS As Long = 8
Public Const COL_DIST As Long = 9
Public Const COL_MAN As Long = 10
Public Const COL_LINE1 As Long = 11
Public Const COL_KEY As Long = 24
Public Const COL_SLUG As Long = 25

Public Const ST_STARTER As String = "Ilk 11"
Public Const ST_SUB As String = "Yedek"
Public Const ST_OUT As String = "Kadro Disi"

Private Function cfg() As Worksheet
    Set cfg = ThisWorkbook.Worksheets("_cfg")
End Function

Public Sub PopulateModel()
    On Error GoTo fail
    modEvents.EnsureEvents
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    Dim ws As Worksheet
    Set ws = shModel()

    Dim fixLabel As String, mktLabel As String
    fixLabel = CStr(ws.Range("B1").Value)
    mktLabel = CStr(ws.Range("I1").Value)

    ' Eski alani temizle ve tema boyamasini geri getir
    ' (Clear kosullu bicimlendirme ve zemini de sildigi icin yeniden boyanir)
    ws.Range("A6:Y500").Clear
    modSetup.PaintModelTable ws
    cfg.Range("B10:B22").ClearContents

    If Len(fixLabel) = 0 Or Len(mktLabel) = 0 Then GoTo done

    ' Fikstur cozumle
    Dim fx As Worksheet, r As Long, n As Long, fxRow As Long
    Set fx = shD("_fixtures")
    n = LastRow(fx)
    fxRow = 0
    For r = 2 To n
        If CStr(fx.Cells(r, 9).Value) = fixLabel Then fxRow = r: Exit For
    Next r
    If fxRow = 0 Then GoTo done

    ' Market cozumle
    Dim mk As Worksheet, mkRow As Long
    Set mk = shD("_markets")
    n = LastRow(mk)
    mkRow = 0
    For r = 2 To n
        If CStr(mk.Cells(r, 1).Value) = mktLabel Then mkRow = r: Exit For
    Next r
    If mkRow = 0 Then GoTo done

    Dim includeGk As Boolean, metricKey As String, mktType As String, logField As String
    includeGk = (mk.Cells(mkRow, 5).Value = 1)
    metricKey = CStr(mk.Cells(mkRow, 6).Value)
    mktType = CStr(mk.Cells(mkRow, 4).Value)
    logField = CStr(mk.Cells(mkRow, 7).Value)

    cfg.Range("B14").Value = IIf(mktType = "dynamic", 1, 0)
    cfg.Range("B15").Value = CStr(fx.Cells(fxRow, 1).Value)
    cfg.Range("B16").Value = fixLabel
    cfg.Range("B17").Value = mk.Cells(mkRow, 2).Value
    cfg.Range("B18").Value = CStr(mk.Cells(mkRow, 3).Value)
    cfg.Range("B19").Value = mktType
    cfg.Range("B20").Value = mktLabel
    cfg.Range("B21").Value = IIf(includeGk, 1, 0)
    cfg.Range("B22").Value = metricKey

    ' Bloklari yaz
    Dim homeCnt As Long, awayCnt As Long, startRow As Long
    startRow = 6
    homeCnt = WriteTeamBlock(ws, startRow, CStr(fx.Cells(fxRow, 5).Value), _
        CStr(fx.Cells(fxRow, 3).Value), CStr(fx.Cells(fxRow, 7).Value), _
        includeGk, metricKey, logField)
    cfg.Range("B10").Value = startRow + 2
    cfg.Range("B11").Value = homeCnt

    Dim awayStart As Long
    awayStart = startRow + 2 + homeCnt + 2
    awayCnt = WriteTeamBlock(ws, awayStart, CStr(fx.Cells(fxRow, 6).Value), _
        CStr(fx.Cells(fxRow, 4).Value), CStr(fx.Cells(fxRow, 8).Value), _
        includeGk, metricKey, logField)
    cfg.Range("B12").Value = awayStart + 2
    cfg.Range("B13").Value = awayCnt

    RecalcAll

done:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Exit Sub
fail:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    MsgBox "Model kurulum hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

' Bir takim blogunu yazar; oyuncu sayisini dondurur.
' hdrRow: takim adi satiri; hdrRow+1: tablo basligi; hdrRow+2..: oyuncular.
Private Function WriteTeamBlock(ByVal ws As Worksheet, ByVal hdrRow As Long, _
    ByVal teamId As String, ByVal teamName As String, ByVal teamSlug As String, _
    ByVal includeGk As Boolean, ByVal metricKey As String, ByVal logField As String) As Long

    Dim pl As Worksheet, r As Long, n As Long, row As Long
    Set pl = shD("_players")
    n = LastRow(pl)

    ' Takim baslik satiri: panel zemin + sol turkuaz aksan
    With ws.Range(ws.Cells(hdrRow, 1), ws.Cells(hdrRow, 22))
        .Interior.Color = modSetup.CLR_PANEL
    End With
    ws.Cells(hdrRow, 1).Interior.Color = modSetup.CLR_TEAL
    ws.Cells(hdrRow, 2).Value = teamName
    With ws.Cells(hdrRow, 2)
        .Font.Bold = True
        .Font.Size = 10
        .Font.Color = modSetup.CLR_TEXT
    End With

    Dim hdr As Variant, c As Long
    hdr = Array("TIK", "OYUNCU", "POZ", "MAC", "DURUM", "ORT", "SON5", "GS", _
                "DAGIT", "MANUEL", "L1", "O1", "T", "L2", "O2", "T", _
                "L3", "O3", "T", "L4", "O4", "T")
    For c = 0 To UBound(hdr)
        ws.Cells(hdrRow + 1, c + 1).Value = hdr(c)
    Next c
    ' Kolon baslik satiri stili
    With ws.Range(ws.Cells(hdrRow + 1, 1), ws.Cells(hdrRow + 1, 22))
        .Interior.Color = modSetup.CLR_PANEL
        .Font.Size = 8
        .Font.Bold = True
        .Font.Color = modSetup.CLR_MUTED
    End With

    ' Dinamik markette line basliklari yerine tek Deger (ayrica tik gerekmez;
    ' oyuncu tiki + deger yeterli)
    If ToDbl(cfg.Range("B14").Value) = 1 Then
        ws.Cells(hdrRow + 1, COL_LINE1).Value = "Deger"
        ws.Range(ws.Cells(hdrRow + 1, COL_LINE1 + 1), ws.Cells(hdrRow + 1, 22)).ClearContents
    End If

    ' Metrik sozlukleri (sezon ort + gecen sezon). "log:" onekli metrikler
    ' _logavg'dan (mac logu sezon ortalamasi), digerleri _metrics'ten.
    Dim curS As String, prevS As String
    curS = CStr(cfg.Range("B23").Value)
    prevS = CStr(cfg.Range("B24").Value)
    Dim mAvg As Object, mLy As Object
    Set mAvg = CreateObject("Scripting.Dictionary")
    Set mLy = CreateObject("Scripting.Dictionary")
    Dim mt As Worksheet, mr As Long, mn As Long, pk As String
    If Left$(metricKey, 4) = "log:" Then
        Dim logCol As Long, fld As String, lc As Long
        fld = Mid$(metricKey, 5)
        Set mt = shD("_logavg")
        mn = LastRow(mt)
        logCol = 0
        For lc = 1 To 20
            If CStr(mt.Cells(1, lc).Value) = fld Then logCol = lc: Exit For
        Next lc
        If logCol > 0 Then
            For mr = 2 To mn
                pk = CStr(mt.Cells(mr, 1).Value)
                If CStr(mt.Cells(mr, 2).Value) = curS Then
                    mAvg(pk) = mt.Cells(mr, logCol).Value
                ElseIf CStr(mt.Cells(mr, 2).Value) = prevS Then
                    mLy(pk) = mt.Cells(mr, logCol).Value
                End If
            Next mr
        End If
    ElseIf Len(metricKey) > 0 Then
        Set mt = shD("_metrics")
        mn = LastRow(mt)
        For mr = 2 To mn
            If CStr(mt.Cells(mr, 2).Value) = metricKey Then
                pk = CStr(mt.Cells(mr, 1).Value)
                If CStr(mt.Cells(mr, 3).Value) = curS Then
                    mAvg(pk) = mt.Cells(mr, 4).Value
                ElseIf CStr(mt.Cells(mr, 3).Value) = prevS Then
                    mLy(pk) = mt.Cells(mr, 4).Value
                End If
            End If
        Next mr
    End If

    ' Son5: siteyle ayni yontem, mac loglarindan son 5 macin ortalamasi.
    ' (Leaderboard'daki last5_value kolonu toplam tutuyor, kullanilmaz.)
    Dim mL5 As Object
    Set mL5 = BuildLast5Map(teamSlug, logField, curS)

    row = hdrRow + 2
    Dim bestGkRow As Long, bestGkApps As Double
    bestGkRow = 0
    bestGkApps = -1

    For r = 2 To n
        If CStr(pl.Cells(r, 1).Value) = teamId Then
            Dim pos As String
            pos = CStr(pl.Cells(r, 6).Value)
            If includeGk Or pos <> "GK" Then
                Dim pkey As String, apps As Double, srate As Variant, lastDt As Variant
                pkey = CStr(pl.Cells(r, 3).Value)
                apps = ToDbl(pl.Cells(r, 7).Value)
                srate = pl.Cells(r, 8).Value
                lastDt = pl.Cells(r, 9).Value

                ws.Cells(row, COL_NAME).Value = pl.Cells(r, 5).Value
                ws.Cells(row, COL_POS).Value = pos
                ws.Cells(row, COL_MAC).Value = apps & " (-)"
                ws.Cells(row, COL_DURUM).Value = InferStatus(apps, srate, lastDt)
                If mAvg.Exists(pkey) Then ws.Cells(row, COL_ORT).Value = mAvg(pkey)
                If mL5.Exists(pkey) Then ws.Cells(row, COL_SON5).Value = mL5(pkey)
                If mLy.Exists(pkey) Then ws.Cells(row, COL_GS).Value = mLy(pkey)
                ws.Cells(row, COL_KEY).Value = pkey
                ws.Cells(row, COL_SLUG).Value = pl.Cells(r, 4).Value

                If pos = "GK" And ws.Cells(row, COL_DURUM).Value = ST_STARTER Then
                    If apps > bestGkApps Then
                        If bestGkRow > 0 Then ws.Cells(bestGkRow, COL_DURUM).Value = ST_SUB
                        bestGkApps = apps
                        bestGkRow = row
                    Else
                        ws.Cells(row, COL_DURUM).Value = ST_SUB
                    End If
                End If

                row = row + 1
            End If
        End If
    Next r

    Dim cnt As Long
    cnt = row - (hdrRow + 2)

    If cnt > 0 Then
        ' Bicim ve dogrulamalar
        Dim rng As Range
        Set rng = ws.Range(ws.Cells(hdrRow + 2, 1), ws.Cells(row - 1, 22))
        rng.Font.Size = 9
        With ws.Range(ws.Cells(hdrRow + 2, COL_TIK), ws.Cells(row - 1, COL_TIK)).Validation
            .Delete
            .Add Type:=xlValidateList, Formula1:="x"
            .ShowError = False
        End With
        With ws.Range(ws.Cells(hdrRow + 2, COL_DURUM), ws.Cells(row - 1, COL_DURUM)).Validation
            .Delete
            .Add Type:=xlValidateList, Formula1:=ST_STARTER & "," & ST_SUB & "," & ST_OUT
            .ShowError = False
        End With
        ws.Range(ws.Cells(hdrRow + 2, COL_ORT), ws.Cells(row - 1, COL_GS)).NumberFormat = "0.00"
        ws.Range(ws.Cells(hdrRow + 2, COL_DIST), ws.Cells(row - 1, COL_DIST)).NumberFormat = "0.00"
    End If

    WriteTeamBlock = cnt
End Function

' Son5 haritasi: takimin sezon mac loglarini ceker (tarihe gore azalan),
' oyuncu basina ilk 5 dolu degerin ortalamasini dondurur. Bos degerler
' siteyle ayni sekilde atlanir. Ag hatasinda bos sozluk doner (Son5 bos kalir).
Private Function BuildLast5Map(ByVal teamSlug As String, ByVal logField As String, _
    ByVal season As String) As Object

    Dim d As Object
    Set d = CreateObject("Scripting.Dictionary")
    Set BuildLast5Map = d
    If Len(teamSlug) = 0 Or Len(logField) = 0 Then Exit Function

    Dim csv As String
    On Error GoTo done
    csv = ApiGetCsv("player_match_log_v1?select=player_source_id,match_datetime," & _
        "shots_on_target,shots_off_target,shots_blocked,passes,accurate_pass,tackles," & _
        "fouls_conceded,cards_yellow,cards_red,offsides,saves_total,goals,assists" & _
        "&team_slug=eq." & teamSlug & "&season_label=eq." & UrlEnc(season) & _
        "&order=match_datetime.desc&limit=1000")

    Dim rows As Collection
    Set rows = ParseCsv(csv)
    If rows.Count < 2 Then Exit Function

    ' Baslik -> kolon indeksi
    Dim hdr As Variant, idx As Object, c As Long
    hdr = rows(1)
    Set idx = CreateObject("Scripting.Dictionary")
    For c = LBound(hdr) To UBound(hdr)
        idx(CStr(hdr(c))) = c
    Next c

    Dim sums As Object, cnts As Object
    Set sums = CreateObject("Scripting.Dictionary")
    Set cnts = CreateObject("Scripting.Dictionary")

    Dim r As Long, arr As Variant, pk As String, raw As String, v As Double, hasVal As Boolean
    For r = 2 To rows.Count
        arr = rows(r)
        pk = CStr(arr(idx("player_source_id")))
        If Len(pk) > 0 And CLng(ToDbl(cnts(pk))) < 5 Then
            hasVal = False
            v = 0
            If logField = "shots_derived" Then
                If Len(CStr(arr(idx("shots_on_target")))) > 0 _
                   Or Len(CStr(arr(idx("shots_off_target")))) > 0 _
                   Or Len(CStr(arr(idx("shots_blocked")))) > 0 Then
                    v = ToDbl(arr(idx("shots_on_target"))) + _
                        ToDbl(arr(idx("shots_off_target"))) + _
                        ToDbl(arr(idx("shots_blocked")))
                    hasVal = True
                End If
            ElseIf idx.Exists(logField) Then
                raw = CStr(arr(idx(logField)))
                If Len(raw) > 0 Then
                    v = ToDbl(raw)
                    hasVal = True
                End If
            End If
            If hasVal Then
                sums(pk) = ToDbl(sums(pk)) + v
                cnts(pk) = CLng(ToDbl(cnts(pk))) + 1
            End If
        End If
    Next r

    Dim k As Variant
    For Each k In sums.Keys
        If CLng(ToDbl(cnts(k))) > 0 Then d(k) = sums(k) / cnts(k)
    Next k
done:
End Function

' Durum cikarimi (yaklasik): mac yoksa veya son mac 90+ gun onceyse Kadro Disi;
' ilk 11 orani %55+ ise Ilk 11; 2+ mac varsa Yedek.
Public Function InferStatus(ByVal apps As Double, ByVal srate As Variant, ByVal lastDt As Variant) As String
    If apps <= 0 Then
        InferStatus = ST_OUT
        Exit Function
    End If
    On Error Resume Next
    Dim d As Date, days As Double
    days = 0
    If Len(CStr(lastDt)) >= 10 Then
        d = DateSerial(CLng(Left$(CStr(lastDt), 4)), CLng(Mid$(CStr(lastDt), 6, 2)), CLng(Mid$(CStr(lastDt), 9, 2)))
        days = Date - d
    End If
    On Error GoTo 0
    If days > 90 Then
        InferStatus = ST_OUT
    ElseIf ToDbl(srate) >= 55 Then
        InferStatus = ST_STARTER
    ElseIf apps >= 2 Then
        InferStatus = ST_SUB
    Else
        InferStatus = ST_OUT
    End If
End Function

' Blok siralama: kolon basligina cift tiklaninca cagrilir (clsAppEvents).
' Ilk tiklama buyukten kucuge, ayni kolona tekrar tiklaninca yon degisir.
' Satirlar gizli anahtar kolonlariyla (X, Y) birlikte tasinir.
Public Sub SortBlock(ByVal headerRow As Long, ByVal col As Long)
    On Error GoTo done
    Dim ws As Worksheet
    Set ws = shModel()

    Dim homeStart As Long, homeCnt As Long, awayStart As Long, awayCnt As Long
    homeStart = CLng(ToDbl(cfg.Range("B10").Value))
    homeCnt = CLng(ToDbl(cfg.Range("B11").Value))
    awayStart = CLng(ToDbl(cfg.Range("B12").Value))
    awayCnt = CLng(ToDbl(cfg.Range("B13").Value))

    Dim startRow As Long, cnt As Long
    If homeStart > 0 And headerRow = homeStart - 1 Then
        startRow = homeStart
        cnt = homeCnt
    ElseIf awayStart > 0 And headerRow = awayStart - 1 Then
        startRow = awayStart
        cnt = awayCnt
    Else
        Exit Sub
    End If
    If cnt < 2 Then Exit Sub

    ' Yon: ayni blok + ayni kolona ust uste tiklamada degisir
    Dim lastKey As String, srtDir As Long
    lastKey = CStr(cfg.Range("B26").Value)
    If lastKey = headerRow & ":" & col & ":desc" Then
        srtDir = xlAscending
        cfg.Range("B26").Value = headerRow & ":" & col & ":asc"
    Else
        srtDir = xlDescending
        cfg.Range("B26").Value = headerRow & ":" & col & ":desc"
    End If

    Application.EnableEvents = False
    ws.Range(ws.Cells(startRow, 1), ws.Cells(startRow + cnt - 1, COL_SLUG)).Sort _
        Key1:=ws.Cells(startRow, col), Order1:=srtDir, Header:=xlNo
    Application.EnableEvents = True
    Exit Sub
done:
    Application.EnableEvents = True
End Sub

Public Sub RecalcAll()
    Application.EnableEvents = False
    On Error GoTo done
    RecalcBlock CLng(ToDbl(cfg.Range("B10").Value)), CLng(ToDbl(cfg.Range("B11").Value)), _
        ToDbl(shModel().Range("E2").Value)
    RecalcBlock CLng(ToDbl(cfg.Range("B12").Value)), CLng(ToDbl(cfg.Range("B13").Value)), _
        ToDbl(shModel().Range("G2").Value)
done:
    Application.EnableEvents = True
End Sub

Private Sub RecalcBlock(ByVal startRow As Long, ByVal cnt As Long, ByVal distExp As Double)
    If startRow = 0 Or cnt = 0 Then Exit Sub
    Dim ws As Worksheet
    Set ws = shModel()

    Dim isDyn As Boolean, distOn As Boolean, payback As Double
    isDyn = (ToDbl(cfg.Range("B14").Value) = 1)
    distOn = (CStr(ws.Range("C2").Value) = "EVET")
    payback = ToDbl(ws.Range("I2").Value)
    If payback <= 0 Then payback = 93

    Dim r As Long, totalAvg As Double, elig As Long
    totalAvg = 0
    elig = 0
    For r = startRow To startRow + cnt - 1
        If CStr(ws.Cells(r, COL_DURUM).Value) <> ST_OUT Then
            totalAvg = totalAvg + ToDbl(ws.Cells(r, COL_ORT).Value)
            elig = elig + 1
        End If
        ' Manuel deger girilen oyuncunun tiki otomatik dolar
        If ToDbl(ws.Cells(r, COL_MAN).Value) > 0 Then ws.Cells(r, COL_TIK).Value = "x"
    Next r

    Dim lines(1 To 4) As Double, odds(1 To 4) As Double, i As Long
    For r = startRow To startRow + cnt - 1
        Dim isOut As Boolean, manV As Double, effExp As Double, finalExp As Double
        isOut = (CStr(ws.Cells(r, COL_DURUM).Value) = ST_OUT)
        manV = ToDbl(ws.Cells(r, COL_MAN).Value)

        ' Dagitilan beklenti
        effExp = 0
        If distOn And Not isOut Then
            If manV > 0 Then
                effExp = manV
            ElseIf totalAvg > 0 Then
                effExp = distExp * ToDbl(ws.Cells(r, COL_ORT).Value) / totalAvg
            ElseIf elig > 0 Then
                effExp = distExp / elig
            End If
        End If
        If distOn And Not isOut Then
            ws.Cells(r, COL_DIST).Value = effExp
        Else
            ws.Cells(r, COL_DIST).Value = ""
        End If

        If isDyn Then
            ' Dinamik: K sutunu elle girilen tek deger; ikinci tik yok,
            ' oyuncu tiki + deger yeterli. Line alanlari bos.
            ws.Range(ws.Cells(r, COL_LINE1 + 1), ws.Cells(r, 22)).ClearContents
            ws.Cells(r, COL_LINE1).NumberFormat = "0.00"
            On Error Resume Next
            ws.Cells(r, COL_LINE1 + 1).Validation.Delete
            On Error GoTo 0
        Else
            finalExp = IIf(manV > 0, manV, effExp)
            If isOut Or finalExp <= 0 Then
                ws.Range(ws.Cells(r, COL_LINE1), ws.Cells(r, 22)).ClearContents
            Else
                CalcLines finalExp, payback, lines, odds
                For i = 1 To 4
                    ws.Cells(r, COL_LINE1 + (i - 1) * 3).Value = lines(i)
                    ws.Cells(r, COL_LINE1 + (i - 1) * 3).NumberFormat = "0.0"
                    ws.Cells(r, COL_LINE1 + (i - 1) * 3 + 1).Value = odds(i)
                    ws.Cells(r, COL_LINE1 + (i - 1) * 3 + 1).NumberFormat = "0.00"
                    With ws.Cells(r, COL_LINE1 + (i - 1) * 3 + 2).Validation
                        .Delete
                        .Add Type:=xlValidateList, Formula1:="x"
                        .ShowError = False
                    End With
                Next i
            End If
        End If
    Next r
End Sub
