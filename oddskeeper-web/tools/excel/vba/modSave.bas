Attribute VB_Name = "modSave"
Option Explicit

' Kaydet butonlari: liste sayfalarindaki degisiklikleri Supabase'e upsert eder.

Public Sub SavePlayerIds()
    On Error GoTo fail
    Dim ws As Worksheet, r As Long, n As Long, json As String, cnt As Long
    Set ws = ThisWorkbook.Worksheets("Oyuncu Listesi")
    n = LastRow(ws, 5)
    json = ""
    For r = 2 To n
        Dim slug As String, idv As String
        slug = CStr(ws.Cells(r, 5).Value)
        idv = Trim(CStr(ws.Cells(r, 4).Value))
        If Len(slug) > 0 Then
            json = json & IIf(Len(json) > 0, ",", "") & _
                "{""player_slug"":""" & JsonEsc(slug) & """,""external_id"":" & _
                IIf(Len(idv) > 0, """" & JsonEsc(idv) & """", "null") & "}"
            cnt = cnt + 1
        End If
    Next r
    If cnt = 0 Then Exit Sub
    ApiPostJson "pm_player_ids?on_conflict=player_slug", "[" & json & "]"
    MsgBox "Kaydedildi (" & cnt & " oyuncu).", vbInformation, "Oddskeeper"
    Exit Sub
fail:
    MsgBox "Kaydetme hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

Public Sub SaveMarkets()
    On Error GoTo fail
    Dim ws As Worksheet, r As Long, n As Long, json As String, cnt As Long
    Set ws = ThisWorkbook.Worksheets("Market Listesi")
    n = LastRow(ws, 1)
    json = ""
    For r = 2 To n
        Dim label As String, tplV As String, typV As String, k As String, isCustom As Long
        label = Trim(CStr(ws.Cells(r, 1).Value))
        tplV = Trim(CStr(ws.Cells(r, 2).Value))
        ' Gorunen ad -> ic tip: "Participant" -> "dynamic", digerleri "static".
        typV = LCase(Trim(CStr(ws.Cells(r, 3).Value)))
        If typV = "participant" Then typV = "dynamic" Else typV = "static"
        k = CStr(ws.Cells(r, 5).Value)
        isCustom = CLng(ToDbl(ws.Cells(r, 6).Value))
        If Len(label) = 0 Then GoTo nextRow
        If Len(k) = 0 Then
            ' Yeni eklenen satir: anahtar uret
            k = "custom_" & Slugify(label)
            isCustom = 1
            ws.Cells(r, 5).Value = k
            ws.Cells(r, 6).Value = 1
        End If
        json = json & IIf(Len(json) > 0, ",", "") & _
            "{""market_key"":""" & JsonEsc(k) & """" & _
            ",""label"":""" & JsonEsc(label) & """" & _
            ",""template_id"":" & IIf(Len(tplV) > 0, """" & JsonEsc(tplV) & """", "null") & _
            ",""market_type"":""" & typV & """" & _
            ",""is_custom"":" & IIf(isCustom = 1, "true", "false") & _
            ",""sort_order"":" & (r - 1) & "}"
        cnt = cnt + 1
nextRow:
    Next r
    If cnt = 0 Then Exit Sub
    ApiPostJson "pm_markets?on_conflict=market_key", "[" & json & "]"
    modData.RebuildMarketDropdown
    MsgBox "Kaydedildi (" & cnt & " market). Yenile ile listeyi tazeleyin.", vbInformation, "Oddskeeper"
    Exit Sub
fail:
    MsgBox "Kaydetme hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

Public Sub SaveFixtureInputs()
    On Error GoTo fail
    Dim ws As Worksheet, r As Long, n As Long, json As String, cnt As Long
    Set ws = ThisWorkbook.Worksheets("Fixture ID")
    n = LastRow(ws, 3)
    json = ""
    For r = 2 To n
        Dim fid As String, v As String
        fid = CStr(ws.Cells(r, 3).Value)
        v = Trim(CStr(ws.Cells(r, 2).Value))
        If Len(fid) > 0 Then
            json = json & IIf(Len(json) > 0, ",", "") & _
                "{""fixture_id"":" & fid & ",""input_value"":" & _
                IIf(Len(v) > 0, """" & JsonEsc(v) & """", "null") & "}"
            cnt = cnt + 1
        End If
    Next r
    If cnt = 0 Then Exit Sub
    ApiPostJson "pm_fixture_inputs?on_conflict=fixture_id", "[" & json & "]"
    ' Gizli onbellegi de guncelle ki Ekle guncel degeri kullansin
    Dim src As Worksheet
    Set src = shD("_fixinp")
    src.Cells.Clear
    src.Cells(1, 1).Value = "fixture_id"
    src.Cells(1, 2).Value = "input_value"
    Dim row As Long
    row = 2
    For r = 2 To n
        If Len(CStr(ws.Cells(r, 3).Value)) > 0 And Len(Trim(CStr(ws.Cells(r, 2).Value))) > 0 Then
            src.Cells(row, 1).Value = ws.Cells(r, 3).Value
            src.Cells(row, 2).Value = ws.Cells(r, 2).Value
            row = row + 1
        End If
    Next r
    MsgBox "Kaydedildi (" & cnt & " fixture).", vbInformation, "Oddskeeper"
    Exit Sub
fail:
    MsgBox "Kaydetme hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

Public Function Slugify(ByVal s As String) As String
    Dim i As Long, ch As String, out As String
    ' Turkce karakter donusumu (ChrW ile; .bas dosyasi ANSI import edildigi
    ' icin literal Turkce karakter kullanilamaz)
    Dim srcCodes As Variant, dst As String
    srcCodes = Array(231, 287, 305, 246, 351, 252, 199, 286, 304, 214, 350, 220)
    dst = "cgiosucgiosu"
    s = LCase(s)
    For i = 0 To UBound(srcCodes)
        s = Replace(s, ChrW(srcCodes(i)), Mid$(dst, (i Mod 6) + 1, 1))
    Next i
    For i = 1 To Len(s)
        ch = Mid$(s, i, 1)
        If (ch >= "a" And ch <= "z") Or (ch >= "0" And ch <= "9") Then
            out = out & ch
        ElseIf Right$(out, 1) <> "_" And Len(out) > 0 Then
            out = out & "_"
        End If
    Next i
    Do While Right$(out, 1) = "_"
        out = Left$(out, Len(out) - 1)
    Loop
    If Len(out) = 0 Then out = "market"
    Slugify = out
End Function
