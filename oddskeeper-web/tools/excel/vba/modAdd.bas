Attribute VB_Name = "modAdd"
Option Explicit

' Ekle: tikli oyuncu + tikli line'lardan input satirlari uretir.
' Static market: secim basina bir satir (Dynamic Input'a).
' Dynamic market: tek satir, secimler saga dogru Selection_N ucluleri
' (Participant Input'a). Ayni mac + oyuncu + line hedef tabloda varsa uyari
' verilir, hicbir sey eklenmez.

Public Const INPUT_HDR_ROW As Long = 3

Private Function cfg() As Worksheet
    Set cfg = ThisWorkbook.Worksheets("_cfg")
End Function

Public Sub AddSelections()
    On Error GoTo fail

    Dim fixtureId As String, fixtureLabel As String
    Dim template As String, mktType As String, mktKey As String
    fixtureId = CStr(cfg.Range("B15").Value)
    fixtureLabel = CStr(cfg.Range("B16").Value)
    template = CStr(cfg.Range("B18").Value)
    mktType = CStr(cfg.Range("B19").Value)
    mktKey = CStr(cfg.Range("B17").Value)

    If Len(fixtureLabel) = 0 Then
        MsgBox "Once fikstur ve market secin.", vbExclamation, "Oddskeeper"
        Exit Sub
    End If

    Dim finp As Object
    Set finp = FixtureInputMap()
    Dim fixtureVal As String
    If finp.Exists(fixtureId) Then fixtureVal = finp(fixtureId)

    Dim ids As Object
    Set ids = IdMap()

    ' Secimleri topla: price | participant | sortOrder | line | oyuncuAdi
    Dim sel As Collection
    Set sel = New Collection
    Dim isDyn As Boolean
    isDyn = (mktType = "dynamic")

    CollectBlock sel, CLng(ToDbl(cfg.Range("B10").Value)), CLng(ToDbl(cfg.Range("B11").Value)), 1, isDyn, ids
    CollectBlock sel, CLng(ToDbl(cfg.Range("B12").Value)), CLng(ToDbl(cfg.Range("B13").Value)), 2, isDyn, ids

    If sel.Count = 0 Then
        MsgBox "Eklenecek secim yok. Oyuncu tikleyin ve line/deger tikleyin.", vbInformation, "Oddskeeper"
        Exit Sub
    End If

    ' Mukerrer kontrolu (market bazinda: ayni oyuncu baska marketten
    ' eklendiyse engel degildir)
    Dim dups As String
    dups = FindDuplicates(sel, fixtureId, mktKey, isDyn)
    If Len(dups) > 0 Then
        MsgBox "Zaten ekli: " & dups & vbCrLf & "Once Input tablosundaki satiri silin.", vbExclamation, "Oddskeeper"
        Exit Sub
    End If

    If isDyn Then
        AppendDynamic sel, fixtureId, fixtureVal, fixtureLabel, template, mktKey
    Else
        AppendStatic sel, fixtureId, fixtureVal, fixtureLabel, template, mktKey
    End If

    shModel().Range(modData.MSG_CELL).Value = "Eklendi (" & sel.Count & ") - " & Format(Now, "hh:nn")
    Exit Sub
fail:
    MsgBox "Ekle hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
End Sub

' Bir bloktan secimleri toplar. Her secim: Array(price, participant, sortOrder, line, ad)
Private Sub CollectBlock(ByVal sel As Collection, ByVal startRow As Long, ByVal cnt As Long, _
    ByVal sortOrder As Long, ByVal isDyn As Boolean, ByVal ids As Object)

    If startRow = 0 Or cnt = 0 Then Exit Sub
    Dim ws As Worksheet, r As Long, i As Long
    Set ws = shModel()

    For r = startRow To startRow + cnt - 1
        If CStr(ws.Cells(r, modModel.COL_TIK).Value) = "x" _
           And CStr(ws.Cells(r, modModel.COL_DURUM).Value) <> modModel.ST_OUT Then

            Dim slug As String, pid As String, nm As String
            slug = CStr(ws.Cells(r, modModel.COL_SLUG).Value)
            nm = CStr(ws.Cells(r, modModel.COL_NAME).Value)
            pid = ""
            If ids.Exists(slug) Then pid = ids(slug)

            If isDyn Then
                ' Oyuncu tiki + deger yeterli; ayrica line tiki aranmaz
                Dim dv As Double
                dv = ToDbl(ws.Cells(r, modModel.COL_LINE1).Value)
                If dv > 0 Then
                    sel.Add Array(FormatDot(dv, 2), pid, sortOrder, "", nm)
                End If
            Else
                For i = 1 To 4
                    If CStr(ws.Cells(r, modModel.COL_LINE1 + (i - 1) * 3 + 2).Value) = "x" Then
                        Dim lineV As Double, oddV As Double
                        lineV = ToDbl(ws.Cells(r, modModel.COL_LINE1 + (i - 1) * 3).Value)
                        oddV = ToDbl(ws.Cells(r, modModel.COL_LINE1 + (i - 1) * 3 + 1).Value)
                        If lineV > 0 And oddV > 0 Then
                            sel.Add Array(FormatDot(oddV, 2), pid, sortOrder, FormatDot(lineV, 1), nm)
                        End If
                    End If
                Next i
            End If
        End If
    Next r
End Sub

' Hedef tabloda ayni fixture+market+participant+line var mi?
' Market anahtara dahildir: ayni oyuncu farkli marketten eklenebilir.
Private Function FindDuplicates(ByVal sel As Collection, ByVal fixtureId As String, _
    ByVal mktKey As String, ByVal isDyn As Boolean) As String
    Dim keys As Object
    Set keys = CreateObject("Scripting.Dictionary")
    Dim ws As Worksheet, r As Long, n As Long, c As Long

    If isDyn Then
        Set ws = ThisWorkbook.Worksheets("Participant Input")
        n = LastRow(ws, 53)
        For r = INPUT_HDR_ROW + 1 To n
            Dim rowFid As String, rowMk As String
            rowFid = CStr(ws.Cells(r, 53).Value)
            rowMk = CStr(ws.Cells(r, 55).Value)
            c = 5 ' ilk SubParticipantId kolonu (E)
            Do While Len(CStr(ws.Cells(r, c).Value)) > 0
                keys(rowFid & "|" & rowMk & "|" & CStr(ws.Cells(r, c).Value) & "|") = True
                c = c + 3
            Loop
        Next r
    Else
        Set ws = ThisWorkbook.Worksheets("Dynamic Input")
        n = LastRow(ws, 10)
        For r = INPUT_HDR_ROW + 1 To n
            keys(CStr(ws.Cells(r, 10).Value) & "|" & CStr(ws.Cells(r, 12).Value) & "|" & _
                 CStr(ws.Cells(r, 3).Value) & "|" & CStr(ws.Cells(r, 5).Value)) = True
        Next r
    End If

    Dim s As Variant, out As String, cntD As Long
    For Each s In sel
        If keys.Exists(fixtureId & "|" & mktKey & "|" & s(1) & "|" & s(3)) Then
            cntD = cntD + 1
            If cntD <= 3 Then
                out = out & IIf(Len(out) > 0, ", ", "") & Trim(s(4) & " " & s(3))
            End If
        End If
    Next s
    If cntD > 3 Then out = out & " +" & (cntD - 3)
    FindDuplicates = out
End Function

' Dynamic Input: A..H sabit kolonlar + I oyuncu adi + J fixture_id (gizli)
' + K label (gizli) + L market_key (gizli, mukerrer kontrolu icin)
Private Sub AppendStatic(ByVal sel As Collection, ByVal fixtureId As String, _
    ByVal fixtureVal As String, ByVal fixtureLabel As String, _
    ByVal template As String, ByVal mktKey As String)

    Dim ws As Worksheet, row As Long, s As Variant
    Set ws = ThisWorkbook.Worksheets("Dynamic Input")
    row = LastRow(ws, 10)
    If row < INPUT_HDR_ROW Then row = INPUT_HDR_ROW
    row = row + 1

    Dim firstRow As Long
    firstRow = row
    For Each s In sel
        ws.Range(ws.Cells(row, 1), ws.Cells(row, 12)).NumberFormat = "@"
        ws.Cells(row, 1).Value = fixtureVal
        ws.Cells(row, 2).Value = template
        ws.Cells(row, 3).Value = s(1)
        ws.Cells(row, 4).Value = CStr(s(2))
        ws.Cells(row, 5).Value = s(3)
        ws.Cells(row, 6).Value = ""
        ws.Cells(row, 7).Value = "Over"
        ws.Cells(row, 8).Value = s(0)
        ws.Cells(row, 9).Value = s(4)
        ws.Cells(row, 10).Value = fixtureId
        ws.Cells(row, 11).Value = fixtureLabel
        ws.Cells(row, 12).Value = mktKey
        row = row + 1
    Next s
    IgnoreNumTextErrors ws.Range(ws.Cells(firstRow, 1), ws.Cells(row - 1, 12))
End Sub

' Participant Input: A Fixture ID, B Template, C Status, D.. Selection ucluleri.
' BA(53) fixture_id, BB(54) label, BC(55) market_key (gizli).
Private Sub AppendDynamic(ByVal sel As Collection, ByVal fixtureId As String, _
    ByVal fixtureVal As String, ByVal fixtureLabel As String, _
    ByVal template As String, ByVal mktKey As String)

    Dim ws As Worksheet, row As Long, i As Long, s As Variant
    Set ws = ThisWorkbook.Worksheets("Participant Input")
    row = LastRow(ws, 53)
    If row < INPUT_HDR_ROW Then row = INPUT_HDR_ROW
    row = row + 1

    ' Basliklari gereken genislige tamamla
    EnsureDynamicHeaders ws, sel.Count

    ws.Range(ws.Cells(row, 1), ws.Cells(row, 3 + sel.Count * 3)).NumberFormat = "@"
    ws.Cells(row, 1).Value = fixtureVal
    ws.Cells(row, 2).Value = template
    ws.Cells(row, 3).Value = ""
    i = 0
    For Each s In sel
        ws.Cells(row, 4 + i * 3).Value = s(0)
        ws.Cells(row, 5 + i * 3).Value = s(1)
        ws.Cells(row, 6 + i * 3).Value = CStr(s(2))
        i = i + 1
    Next s
    ws.Cells(row, 53).Value = fixtureId
    ws.Cells(row, 54).Value = fixtureLabel
    ws.Cells(row, 55).Value = mktKey
    IgnoreNumTextErrors ws.Range(ws.Cells(row, 1), ws.Cells(row, 3 + sel.Count * 3))
End Sub

Public Sub EnsureDynamicHeaders(ByVal ws As Worksheet, ByVal selCount As Long)
    Dim i As Long, c As Long
    ws.Cells(INPUT_HDR_ROW, 1).Value = "Fixture ID"
    ws.Cells(INPUT_HDR_ROW, 2).Value = "Market Template"
    ws.Cells(INPUT_HDR_ROW, 3).Value = "Market Status"
    For i = 1 To selCount
        c = 4 + (i - 1) * 3
        If Len(CStr(ws.Cells(INPUT_HDR_ROW, c).Value)) = 0 Then
            ws.Cells(INPUT_HDR_ROW, c).Value = "Selection_" & i & "_Price"
            ws.Cells(INPUT_HDR_ROW, c + 1).Value = "Selection_" & i & "_SubParticipantId"
            ws.Cells(INPUT_HDR_ROW, c + 2).Value = "Selection_" & i & "_ParticipantSortOrder"
            ws.Range(ws.Cells(INPUT_HDR_ROW, c), ws.Cells(INPUT_HDR_ROW, c + 2)).Font.Bold = True
            ws.Range(ws.Cells(INPUT_HDR_ROW, c), ws.Cells(INPUT_HDR_ROW, c + 2)).Font.Size = 9
        End If
    Next i
End Sub
