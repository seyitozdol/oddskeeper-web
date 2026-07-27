Attribute VB_Name = "modData"
Option Explicit

' Yenile akisi: tum veri setlerini Supabase'den cekip gizli sayfalara yazar,
' liste sayfalarini ve dropdown'lari yeniden kurar.

Public Const MSG_CELL As String = "A4"

Public Function shD(ByVal name As String) As Worksheet
    Set shD = ThisWorkbook.Worksheets(name)
End Function

Public Function shModel() As Worksheet
    Set shModel = ThisWorkbook.Worksheets("Model")
End Function

Public Function LastRow(ByVal ws As Worksheet, Optional ByVal col As Long = 1) As Long
    LastRow = ws.Cells(ws.rows.Count, col).End(xlUp).Row
End Function

' Yerlesik marketler: label|key|metric_key|include_gk|log_field
' (sitedeki MARKET_OPTIONS; log_field Son5 icin mac logu kolonu,
'  "shots_derived" = isabetli + isabetsiz + bloke toplami,
'  metric_key "log:<kolon>" = sezon ort. player_log_season_avg_v1'den)
Public Function BuiltinMarkets() As Variant
    BuiltinMarkets = Array( _
        Array("Shots on Target", "shots_on_target", "shots_on_target_total", False, "shots_on_target"), _
        Array("Shots Off Target", "shots_off_target", "log:shots_off_target", False, "shots_off_target"), _
        Array("Blocked Shots", "blocked_shots", "log:shots_blocked", False, "shots_blocked"), _
        Array("Total Shots", "total_shots", "shots_total", False, "shots_derived"), _
        Array("Attempts In Box", "attempts_ibox", "attempts_ibox_total", False, "shots_on_target"), _
        Array("Attempts Out Box", "attempts_obox", "attempts_obox_total", False, "shots_off_target"), _
        Array("xG", "xg", "expected_goals_total", False, "expected_goals"), _
        Array("Fouls Suffered", "fouls_suffered", "fouls_won_total", False, "fouls_won"), _
        Array("Passes", "passes", "passes_total", True, "passes"), _
        Array("Accurate Passes", "accurate_passes", "accurate_pass_total", True, "accurate_pass"), _
        Array("Tackles", "tackles", "tackles_total", False, "tackles"), _
        Array("Fouls", "fouls", "fouls_conceded_total", False, "fouls_conceded"), _
        Array("Yellow Cards", "yellow_cards", "cards_yellow_total", True, "cards_yellow"), _
        Array("Red Card", "red_card", "cards_red_total", True, "cards_red"), _
        Array("Offsides", "offsides", "offsides_total", False, "offsides"), _
        Array("Saves", "saves", "saves_total_total", True, "saves_total"), _
        Array("Score", "score", "goals_total", False, "goals"), _
        Array("Assist", "assist", "assists_total", False, "assists"), _
        Array("Freekick Goal", "freekick_goal", "", False, ""), _
        Array("Header Goal", "header_goal", "", False, ""), _
        Array("OutsideBox Goal", "outsidebox_goal", "", False, ""), _
        Array("Brace", "brace", "", False, ""), _
        Array("Hat Trick", "hat_trick", "", False, ""))
End Function

Public Sub RefreshData()
    On Error GoTo fail
    modEvents.EnsureEvents
    Application.ScreenUpdating = False
    Application.EnableEvents = False

    ' Fiksturler (takim sluglari Son5 log sorgusu icin gerekli)
    CsvToSheet ApiGetCsv("league_fixtures_v1?select=fixture_id,fixture_date,home_team_name,away_team_name,home_team_source_id,away_team_source_id,home_team_slug,away_team_slug" & _
        "&fixture_date=gte." & Format(Date, "yyyy-mm-dd") & "&fixture_status=neq.played&order=fixture_date.asc&limit=50"), shD("_fixtures")
    BuildFixtureLabels

    ' Guncel kadro + profil
    CsvToSheet ApiGetCsv("team_current_squad_profile_v1?select=team_source_id,team_name,player_key,player_slug,display_name,primary_position_code,appearances,starter_rate_pct,last_match_datetime" & _
        "&order=appearances.desc&limit=1000"), shD("_players")

    ' Metrikler: market basina cekilir (Supabase 1000 satir siniri).
    ' "log:" onekli metrikler leaderboard'da yok, _logavg'dan okunur.
    Dim mkts As Variant, i As Long, mkey As String, firstReq As Boolean
    mkts = BuiltinMarkets()
    shD("_metrics").Cells.Clear
    firstReq = True
    For i = LBound(mkts) To UBound(mkts)
        mkey = mkts(i)(2)
        If Len(mkey) > 0 And Left$(mkey, 4) <> "log:" Then
            CsvAppendToSheet ApiGetCsv("player_metric_leaderboard_current?select=player_source_id,metric_key,season_label,per_match_value,last5_value" & _
                "&metric_key=eq." & mkey & "&limit=1000"), shD("_metrics"), firstReq
            firstReq = False
        End If
    Next i

    ' Loglardan sezon ortalamalari (shots_off_target, shots_blocked)
    CsvToSheet ApiGetCsv("player_log_season_avg_v1?select=player_source_id,season_label,shots_off_target,shots_blocked&limit=1000"), shD("_logavg")

    ' Oyuncu ID'leri, market kayitlari, fixture inputlari
    CsvToSheet ApiGetCsv("pm_player_ids?select=player_slug,external_id&limit=1000"), shD("_ids")
    CsvToSheet ApiGetCsv("pm_markets?select=market_key,label,template_id,market_type,is_custom,sort_order&order=sort_order.asc&limit=500"), shD("_pmm")
    CsvToSheet ApiGetCsv("pm_fixture_inputs?select=fixture_id,input_value&limit=500"), shD("_fixinp")

    BuildMarkets
    DetectSeasons
    FillListSheets
    SetupDropdowns

    shModel.Range(MSG_CELL).Value = "Veri yenilendi: " & Format(Now, "dd.mm hh:nn")
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub
fail:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "Yenileme hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

' _fixtures I kolonuna "Ev vs Dep (tarih)" etiketi yazar (7-8 sluglar).
Private Sub BuildFixtureLabels()
    Dim ws As Worksheet, r As Long, n As Long
    Set ws = shD("_fixtures")
    n = LastRow(ws)
    For r = 2 To n
        ws.Cells(r, 9).Value = ws.Cells(r, 3).Value & " vs " & ws.Cells(r, 4).Value & _
            " (" & Format(ws.Cells(r, 2).Value, "yyyy-mm-dd") & ")"
    Next r
End Sub

' _markets: label | key | template | type | include_gk | metric_key
' Yerlesikler + pm_markets kayitlari (template/tur override, customlar sona).
Private Sub BuildMarkets()
    Dim ws As Worksheet, pmm As Worksheet
    Set ws = shD("_markets")
    Set pmm = shD("_pmm")
    ws.Cells.Clear

    ' pm_markets sozlugu
    Dim tpl As Object, typ As Object
    Set tpl = CreateObject("Scripting.Dictionary")
    Set typ = CreateObject("Scripting.Dictionary")
    Dim r As Long, n As Long, k As String
    n = LastRow(pmm)
    For r = 2 To n
        k = CStr(pmm.Cells(r, 1).Value)
        tpl(k) = CStr(pmm.Cells(r, 3).Value)
        typ(k) = CStr(pmm.Cells(r, 4).Value)
    Next r

    ws.Cells(1, 1).Value = "label"
    ws.Cells(1, 2).Value = "key"
    ws.Cells(1, 3).Value = "template"
    ws.Cells(1, 4).Value = "type"
    ws.Cells(1, 5).Value = "include_gk"
    ws.Cells(1, 6).Value = "metric_key"
    ws.Cells(1, 7).Value = "log_field"

    Dim mkts As Variant, i As Long, row As Long
    mkts = BuiltinMarkets()
    row = 2
    For i = LBound(mkts) To UBound(mkts)
        k = mkts(i)(1)
        ws.Cells(row, 1).Value = mkts(i)(0)
        ws.Cells(row, 2).Value = k
        If tpl.Exists(k) Then ws.Cells(row, 3).Value = tpl(k)
        If typ.Exists(k) And Len(typ(k)) > 0 Then
            ws.Cells(row, 4).Value = typ(k)
        Else
            ws.Cells(row, 4).Value = "static"
        End If
        ws.Cells(row, 5).Value = IIf(mkts(i)(3), 1, 0)
        ws.Cells(row, 6).Value = mkts(i)(2)
        ws.Cells(row, 7).Value = mkts(i)(4)
        row = row + 1
    Next i

    ' Custom marketler
    For r = 2 To n
        If LCase(CStr(pmm.Cells(r, 5).Value)) = "true" Then
            ws.Cells(row, 1).Value = pmm.Cells(r, 2).Value
            ws.Cells(row, 2).Value = pmm.Cells(r, 1).Value
            ws.Cells(row, 3).Value = pmm.Cells(r, 3).Value
            If Len(CStr(pmm.Cells(r, 4).Value)) > 0 Then
                ws.Cells(row, 4).Value = pmm.Cells(r, 4).Value
            Else
                ws.Cells(row, 4).Value = "static"
            End If
            ws.Cells(row, 5).Value = 0
            ws.Cells(row, 6).Value = ""
            ws.Cells(row, 7).Value = ""
            row = row + 1
        End If
    Next r
End Sub

' Metrik verisindeki en guncel sezonu ve bir oncekini _cfg'ye yazar.
Private Sub DetectSeasons()
    Dim ws As Worksheet, r As Long, n As Long, s As String, best As String
    Set ws = shD("_metrics")
    n = LastRow(ws)
    best = ""
    For r = 2 To n
        s = CStr(ws.Cells(r, 3).Value)
        If s > best Then best = s
    Next r
    If Len(best) = 0 Then best = "2025/2026"
    ThisWorkbook.Worksheets("_cfg").Range("B23").Value = best
    Dim y1 As Long
    y1 = CLng(Left$(best, 4))
    ThisWorkbook.Worksheets("_cfg").Range("B24").Value = (y1 - 1) & "/" & y1
End Sub

' Oyuncu Listesi, Market Listesi ve Fixture ID sayfalarini doldurur.
Private Sub FillListSheets()
    Dim ws As Worksheet, src As Worksheet, r As Long, n As Long, row As Long

    ' Oyuncu Listesi: A Takim, B Oyuncu, C Poz, D ID, E(gizli) slug
    Set ws = ThisWorkbook.Worksheets("Oyuncu Listesi")
    Set src = shD("_players")
    ws.Range("A2:E10000").Clear
    n = LastRow(src)
    Dim ids As Object
    Set ids = IdMap()
    row = 2
    For r = 2 To n
        ws.Cells(row, 1).Value = src.Cells(r, 2).Value
        ws.Cells(row, 2).Value = src.Cells(r, 5).Value
        ws.Cells(row, 3).Value = src.Cells(r, 6).Value
        Dim slug As String
        slug = CStr(src.Cells(r, 4).Value)
        ws.Cells(row, 4).NumberFormat = "@"
        If ids.Exists(slug) Then ws.Cells(row, 4).Value = ids(slug)
        ws.Cells(row, 5).Value = slug
        row = row + 1
    Next r
    If row > 2 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(row - 1, 5)).Sort _
            Key1:=ws.Cells(2, 1), Order1:=xlAscending, _
            Key2:=ws.Cells(2, 2), Order2:=xlAscending, Header:=xlNo
        IgnoreNumTextErrors ws.Range(ws.Cells(2, 4), ws.Cells(row - 1, 4))
    End If

    ' Market Listesi: A Market, B Template ID, C Tur, D Model tiki (x = Model
    ' dropdown'inda gorunur), E(gizli) key, F(gizli) is_custom.
    ' D tikleri Yenile'de anahtar bazinda korunur; hic tik kaydi yoksa
    ' (ilk kurulum) hepsi isaretli baslar.
    Set ws = ThisWorkbook.Worksheets("Market Listesi")
    Set src = shD("_markets")

    Dim ticks As Object, hadAny As Boolean
    Set ticks = CreateObject("Scripting.Dictionary")
    hadAny = False
    n = LastRow(ws, 1)
    For r = 2 To n
        Dim oldKey As String
        oldKey = CStr(ws.Cells(r, 5).Value)
        If Len(oldKey) > 0 Then
            hadAny = True
            ticks(oldKey) = (CStr(ws.Cells(r, 4).Value) = "x")
        End If
    Next r

    ws.Range("A2:F1000").Clear
    n = LastRow(src)
    For r = 2 To n
        Dim mk As String
        mk = CStr(src.Cells(r, 2).Value)
        ws.Cells(r, 1).Value = src.Cells(r, 1).Value
        ws.Cells(r, 2).NumberFormat = "@"
        ws.Cells(r, 2).Value = src.Cells(r, 3).Value
        ' Gorunen ad: ic tip "dynamic" -> "Participant", "static" -> "Dynamic".
        ws.Cells(r, 3).Value = IIf(CStr(src.Cells(r, 4).Value) = "dynamic", "Participant", "Dynamic")
        If Not hadAny Then
            ws.Cells(r, 4).Value = "x"
        ElseIf ticks.Exists(mk) Then
            If ticks(mk) Then ws.Cells(r, 4).Value = "x"
        End If
        ws.Cells(r, 4).HorizontalAlignment = xlCenter
        ws.Cells(r, 5).Value = mk
        ws.Cells(r, 6).Value = IIf(r - 2 >= UBound(BuiltinMarkets()) - LBound(BuiltinMarkets()) + 1, 1, 0)
        ws.Cells(r, 3).Validation.Delete
        ws.Cells(r, 3).Validation.Add Type:=xlValidateList, Formula1:="Dynamic,Participant"
        ws.Cells(r, 4).Validation.Delete
        ws.Cells(r, 4).Validation.Add Type:=xlValidateList, Formula1:="x"
        ws.Cells(r, 4).Validation.ShowError = False
    Next r
    If n >= 2 Then IgnoreNumTextErrors ws.Range(ws.Cells(2, 2), ws.Cells(n, 2))

    ' Fixture ID: A Mac, B Deger, C(gizli) fixture_id
    Set ws = ThisWorkbook.Worksheets("Fixture ID")
    Set src = shD("_fixtures")
    ws.Range("A2:C1000").Clear
    n = LastRow(src)
    Dim finp As Object
    Set finp = FixtureInputMap()
    For r = 2 To n
        ws.Cells(r, 1).Value = src.Cells(r, 9).Value
        ws.Cells(r, 2).NumberFormat = "@"
        Dim fid As String
        fid = CStr(src.Cells(r, 1).Value)
        If finp.Exists(fid) Then ws.Cells(r, 2).Value = finp(fid)
        ws.Cells(r, 3).Value = fid
    Next r
    If n >= 2 Then IgnoreNumTextErrors ws.Range(ws.Cells(2, 2), ws.Cells(n, 2))
End Sub

Public Function IdMap() As Object
    Dim d As Object, ws As Worksheet, r As Long, n As Long
    Set d = CreateObject("Scripting.Dictionary")
    Set ws = shD("_ids")
    n = LastRow(ws)
    For r = 2 To n
        d(CStr(ws.Cells(r, 1).Value)) = CStr(ws.Cells(r, 2).Value)
    Next r
    Set IdMap = d
End Function

Public Function FixtureInputMap() As Object
    Dim d As Object, ws As Worksheet, r As Long, n As Long
    Set d = CreateObject("Scripting.Dictionary")
    Set ws = shD("_fixinp")
    n = LastRow(ws)
    For r = 2 To n
        d(CStr(ws.Cells(r, 1).Value)) = CStr(ws.Cells(r, 2).Value)
    Next r
    Set FixtureInputMap = d
End Function

' Model B1 (fikstur) ve I1 (market) dropdown'lari.
Private Sub SetupDropdowns()
    Dim ws As Worksheet, n As Long
    Set ws = shModel()

    n = LastRow(shD("_fixtures"))
    With ws.Range("B1").Validation
        .Delete
        If n >= 2 Then
            .Add Type:=xlValidateList, Formula1:="=_fixtures!$I$2:$I$" & n
            .ShowError = False
        End If
    End With

    RebuildMarketDropdown

    With ws.Range("C2").Validation
        .Delete
        .Add Type:=xlValidateList, Formula1:="EVET,HAYIR"
        .ShowError = False
    End With
End Sub

' Model I1 market dropdown'i: Market Listesi'nde Model kolonu (D) tikli
' marketler. Hicbiri tikli degilse hepsi listelenir. Filtrelenen etiketler
' _markets sayfasinin 9. kolonuna yazilir, dogrulama oraya baglanir.
Public Sub RebuildMarketDropdown()
    Dim mws As Worksheet, dws As Worksheet, r As Long, n As Long, row As Long
    Set mws = ThisWorkbook.Worksheets("Market Listesi")
    Set dws = shD("_markets")

    dws.Range("I1:I1000").ClearContents
    n = LastRow(mws, 1)
    row = 1
    Dim anyTick As Boolean
    anyTick = False
    For r = 2 To n
        If CStr(mws.Cells(r, 4).Value) = "x" Then anyTick = True
    Next r
    For r = 2 To n
        If Len(CStr(mws.Cells(r, 1).Value)) > 0 Then
            If (Not anyTick) Or CStr(mws.Cells(r, 4).Value) = "x" Then
                dws.Cells(row, 9).Value = mws.Cells(r, 1).Value
                row = row + 1
            End If
        End If
    Next r

    With shModel().Range("I1").Validation
        .Delete
        If row > 1 Then
            .Add Type:=xlValidateList, Formula1:="=_markets!$I$1:$I$" & (row - 1)
            .ShowError = False
        End If
    End With
End Sub
