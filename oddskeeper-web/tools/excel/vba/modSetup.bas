Attribute VB_Name = "modSetup"
Option Explicit

' Calisma kitabini sifirdan kurar: sayfalar, basliklar, butonlar,
' dogrulamalar, gizli veri sayfalari ve Supabase ayarlari.
' Bos bir xlsm'e modulleri import ettikten sonra BIR KEZ calistirilir
' (Alt+F8 > SetupWorkbook). Tekrar calistirmak zarar vermez.

Private Const SB_URL As String = "https://eotosigzqsahqyluvmbq.supabase.co"
Private Const SB_KEY As String = "sb_publishable_exFb56DxlyxoMNPmRMsKQA_Z0oRpyx2"

Private gSilent As Boolean

' Otomasyon icin sessiz surum (MsgBox gostermez)
Public Sub SetupWorkbookSilent()
    gSilent = True
    SetupWorkbook
    gSilent = False
End Sub

Public Sub SetupWorkbook()
    On Error GoTo fail
    modEvents.EnsureEvents
    Application.ScreenUpdating = False

    Dim names As Variant
    names = Array("Model", "Oyuncu Listesi", "Market Listesi", "Fixture ID", _
                  "Dynamic Input", "Participant Input", "_cfg", "_fixtures", "_players", _
                  "_metrics", "_logavg", "_ids", "_pmm", "_markets", "_fixinp")

    ' Eksik sayfalari olustur
    Dim i As Long, ws As Worksheet
    For i = 0 To UBound(names)
        If Not SheetExists(CStr(names(i))) Then
            Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
            ws.Name = CStr(names(i))
        End If
    Next i

    ' Listede olmayan (varsayilan) sayfalari sil
    Application.DisplayAlerts = False
    Dim j As Long, nm As String, keep As Boolean
    For j = ThisWorkbook.Worksheets.Count To 1 Step -1
        nm = ThisWorkbook.Worksheets(j).Name
        keep = False
        For i = 0 To UBound(names)
            If nm = CStr(names(i)) Then keep = True
        Next i
        If Not keep And ThisWorkbook.Worksheets.Count > 1 Then ThisWorkbook.Worksheets(j).Delete
    Next j
    Application.DisplayAlerts = True

    ' Siralama
    For i = 0 To UBound(names)
        If ThisWorkbook.Worksheets(i + 1).Name <> CStr(names(i)) Then
            ThisWorkbook.Worksheets(CStr(names(i))).Move Before:=ThisWorkbook.Worksheets(i + 1)
        End If
    Next i

    ' Gizli veri sayfalari gorunur kalsin diye once ayarlar yazilir
    Dim cfg As Worksheet
    Set cfg = ThisWorkbook.Worksheets("_cfg")
    cfg.Range("A1").Value = "supabase_url":  cfg.Range("B1").Value = SB_URL
    cfg.Range("A2").Value = "anon_key":      cfg.Range("B2").Value = SB_KEY
    If Len(CStr(cfg.Range("B23").Value)) = 0 Then cfg.Range("B23").Value = "2025/2026"
    If Len(CStr(cfg.Range("B24").Value)) = 0 Then cfg.Range("B24").Value = "2024/2025"

    SetupModelSheet
    SetupListSheets
    SetupInputSheets

    ' Veri sayfalarini gizle
    Dim hiddenNames As Variant
    hiddenNames = Array("_cfg", "_fixtures", "_players", "_metrics", "_logavg", "_ids", "_pmm", "_markets", "_fixinp")
    For i = 0 To UBound(hiddenNames)
        ThisWorkbook.Worksheets(CStr(hiddenNames(i))).Visible = xlSheetHidden
    Next i

    ThisWorkbook.Worksheets("Model").Activate
    Application.ScreenUpdating = True
    If Not gSilent Then
        MsgBox "Kurulum tamam. Simdi Model sayfasindaki Yenile butonuna basin (internet gerekir).", vbInformation, "Oddskeeper"
    End If
    Exit Sub
fail:
    Application.ScreenUpdating = True
    If gSilent Then
        Err.Raise Err.Number, "SetupWorkbook", Err.Description
    Else
        MsgBox "Kurulum hatasi: " & Err.Description, vbExclamation, "Oddskeeper"
    End If
End Sub

Private Function SheetExists(ByVal nm As String) As Boolean
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nm)
    SheetExists = Not ws Is Nothing
    On Error GoTo 0
End Function

' -- Model tema paleti (acik tema: beyaz zemin, acik gri panel, turkuaz vurgu) --
Public Function CLR_BG() As Long
    CLR_BG = RGB(255, 255, 255)
End Function
Public Function CLR_PANEL() As Long
    CLR_PANEL = RGB(241, 245, 249)
End Function
Public Function CLR_FIELD() As Long
    CLR_FIELD = RGB(248, 250, 252)
End Function
Public Function CLR_TINT_A() As Long
    CLR_TINT_A = RGB(247, 250, 252)
End Function
Public Function CLR_TINT_B() As Long
    CLR_TINT_B = RGB(236, 242, 248)
End Function
Public Function CLR_TEXT() As Long
    CLR_TEXT = RGB(30, 41, 59)
End Function
Public Function CLR_MUTED() As Long
    CLR_MUTED = RGB(100, 116, 139)
End Function
Public Function CLR_TEAL() As Long
    CLR_TEAL = RGB(13, 148, 136)
End Function
Public Function CLR_TEAL_SOFT() As Long
    CLR_TEAL_SOFT = RGB(204, 251, 241)
End Function
Public Function CLR_BORDER() As Long
    CLR_BORDER = RGB(203, 213, 225)
End Function
Public Function CLR_YELLOW() As Long
    CLR_YELLOW = RGB(176, 124, 12)
End Function
Public Function CLR_RED() As Long
    CLR_RED = RGB(220, 38, 38)
End Function

Private Sub SetupModelSheet()
    Dim m As Worksheet
    Set m = ThisWorkbook.Worksheets("Model")

    ' Zemin ve temel yazi tipi
    m.Cells.Interior.Color = CLR_BG
    m.Cells.Font.Name = "Segoe UI"
    m.Cells.Font.Size = 9
    m.Cells.Font.Color = CLR_TEXT
    m.Rows("1:2").RowHeight = 22
    m.Rows("3:3").RowHeight = 6
    m.Rows("4:4").RowHeight = 16
    m.Rows("5:400").RowHeight = 15

    ' Kontrol satiri 1: fikstur + market
    ' Fikstur alani B1:F1 (deger B1'de), market alani I1:K1 (deger I1'de).
    ' Onceki kurulumdan kalan birlesimler cakisma yaratmasin diye once cozulur.
    On Error Resume Next
    m.Range("A1:K1").UnMerge
    m.Range("A1:K1").ClearContents
    m.Range("B1:F1").Merge
    m.Range("I1:K1").Merge
    On Error GoTo 0
    m.Range("A1").Value = "FIX"
    m.Range("H1").Value = "MARKET"
    Dim a As Variant
    For Each a In Array("A1", "H1")
        With m.Range(CStr(a))
            .Font.Size = 8: .Font.Bold = True: .Font.Color = CLR_MUTED
        End With
    Next a
    StyleField m.Range("B1:F1")
    StyleField m.Range("I1:K1")
    m.Range("B1").Font.Bold = True
    m.Range("I1").Font.Bold = True

    ' Kontrol satiri 2: dagit + beklentiler + payback
    m.Range("B2").Value = "Beklenti Dagit"
    If Len(CStr(m.Range("C2").Value)) = 0 Then m.Range("C2").Value = "EVET"
    m.Range("D2").Value = "Ev Bek"
    If Len(CStr(m.Range("E2").Value)) = 0 Then m.Range("E2").Value = 23
    m.Range("F2").Value = "Dep Bek"
    If Len(CStr(m.Range("G2").Value)) = 0 Then m.Range("G2").Value = 23
    m.Range("H2").Value = "Payback"
    If Len(CStr(m.Range("I2").Value)) = 0 Then m.Range("I2").Value = 93
    For Each a In Array("B2", "D2", "F2", "H2")
        With m.Range(CStr(a))
            .Font.Size = 8: .Font.Bold = True: .Font.Color = CLR_MUTED
            .HorizontalAlignment = xlRight
        End With
    Next a
    For Each a In Array("C2", "E2", "G2", "I2")
        StyleField m.Range(CStr(a))
    Next a

    With m.Range("C2").Validation
        .Delete
        .Add Type:=xlValidateList, Formula1:="EVET,HAYIR"
        .ShowError = False
    End With

    ' Mesaj hucresi (A4'ten sagi bos, tasar)
    m.Range("A4").Font.Color = CLR_TEAL
    m.Range("A4").Font.Size = 8

    ' Kolon genislikleri
    m.Columns(2).ColumnWidth = 22
    m.Columns(24).Hidden = True
    m.Columns(25).Hidden = True
    Dim c As Long
    For Each a In Array(11, 14, 17, 20)
        m.Columns(CLng(a)).ColumnWidth = 4.5
    Next a
    For Each a In Array(12, 15, 18, 21)
        m.Columns(CLng(a)).ColumnWidth = 6
    Next a
    For Each a In Array(13, 16, 19, 22)
        m.Columns(CLng(a)).ColumnWidth = 3
    Next a
    m.Columns(1).ColumnWidth = 3.5
    m.Columns(3).ColumnWidth = 4
    For c = 4 To 10
        m.Columns(c).ColumnWidth = 7.5
    Next c
    m.Columns(5).ColumnWidth = 10

    ' Tablo alani boyamasi + kosullu bicimlendirme
    PaintModelTable m

    ' Butonlar: sekil tabanli (varsa eski form butonlarini da kaldir)
    On Error Resume Next
    m.Buttons.Delete
    On Error GoTo 0
    ' Siralama kullanim sirasina gore; Yenile en sagda (seyrek kullanilir),
    ' pastel turuncu zeminle digerlerinden ayrisir.
    DeleteOkButtons m
    AddShapeBtn m, "okbtn_kur", 640, 5, 78, 24, "Modeli Kur", "PopulateModel", CLR_PANEL, CLR_TEXT
    AddShapeBtn m, "okbtn_hesapla", 726, 5, 78, 24, "Hesapla", "RecalcAll", CLR_PANEL, CLR_TEXT
    AddShapeBtn m, "okbtn_ekle", 812, 5, 78, 24, "EKLE", "AddSelections", CLR_TEAL, RGB(255, 255, 255)
    AddShapeBtn m, "okbtn_yenile", 916, 5, 78, 24, "Yenile", "RefreshData", RGB(254, 215, 170), RGB(154, 62, 18)

    ' Kilavuz cizgilerini gizle (yalnizca Model gorunumu icin)
    On Error Resume Next
    m.Activate
    ActiveWindow.DisplayGridlines = False
    On Error GoTo 0
End Sub

' Giris hucresi stili (acik alan + ince cerceve)
Private Sub StyleField(ByVal rng As Range)
    rng.Interior.Color = CLR_FIELD
    rng.Font.Color = CLR_TEXT
    With rng.Borders
        .LineStyle = xlContinuous
        .Weight = xlThin
        .Color = CLR_BORDER
    End With
End Sub

' Tablo alaninin statik boyamasi + kosullu bicimlendirme.
' PopulateModel her kurulumda alani Clear ile sildigi icin oradan da cagrilir.
Public Sub PaintModelTable(ByVal m As Worksheet)
    Dim area As Range
    Set area = m.Range("A5:V400")
    area.Interior.Color = CLR_BG
    area.Font.Size = 9
    area.Font.Color = CLR_TEXT

    ' Line gruplari: donusumlu tonlar + sol ayirici cizgi
    Dim gs As Variant, i As Long, colStart As Long
    gs = Array(11, 14, 17, 20)
    For i = 0 To 3
        colStart = CLng(gs(i))
        With m.Range(m.Cells(5, colStart), m.Cells(400, colStart + 2))
            .Interior.Color = IIf(i Mod 2 = 0, CLR_TINT_A, CLR_TINT_B)
            With .Borders(xlEdgeLeft)
                .LineStyle = xlContinuous
                .Weight = xlThin
                .Color = CLR_BORDER
            End With
        End With
        ' Oran kolonu turkuaz, line kolonu soluk
        With m.Range(m.Cells(5, colStart + 1), m.Cells(400, colStart + 1))
            .Font.Color = CLR_TEAL
            .Font.Bold = True
        End With
        With m.Range(m.Cells(5, colStart), m.Cells(400, colStart))
            .Font.Color = CLR_MUTED
        End With
        m.Range(m.Cells(5, colStart + 2), m.Cells(400, colStart + 2)).HorizontalAlignment = xlCenter
    Next i

    ' Dagitilan kolonu turkuaz tonu, tik kolonu ortali
    m.Range("I5:I400").Font.Color = CLR_TEAL
    m.Range("A5:A400").HorizontalAlignment = xlCenter
    m.Range("C5:C400").Font.Color = CLR_MUTED
    m.Range("D5:D400").Font.Color = CLR_MUTED
    m.Range("D5:D400").Font.Size = 8

    ' Kosullu bicimlendirme
    area.FormatConditions.Delete
    Dim fc As FormatCondition

    ' 0) Tikli line uclusu (L/O/T): satir kuralindan once eklenir ki
    '    onceligi yuksek olsun; daha belirgin turkuaz ton.
    Dim tickCols As Variant, grpRng As Range
    tickCols = Array("M", "P", "S", "V")
    For i = 0 To 3
        colStart = CLng(gs(i))
        Set grpRng = m.Range(m.Cells(5, colStart), m.Cells(400, colStart + 2))
        Set fc = grpRng.FormatConditions.Add(Type:=xlExpression, _
            Formula1:="=$" & CStr(tickCols(i)) & "5=""x""")
        fc.Interior.Color = RGB(153, 246, 228)
        fc.Font.Color = RGB(13, 110, 100)
        fc.Font.Bold = True
    Next i

    ' 1) Tikli oyuncu satiri: acik turkuaz zemin, koyu turkuaz yazi
    Set fc = area.FormatConditions.Add(Type:=xlExpression, Formula1:="=$A5=""x""")
    fc.Interior.Color = CLR_TEAL_SOFT
    fc.Font.Color = RGB(15, 118, 110)

    ' 2) Kadro disi satiri soluk
    Set fc = area.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E5=""" & "Kadro Disi" & """")
    fc.Font.Color = RGB(163, 175, 191)

    ' 3) Durum renkleri (E kolonu)
    Dim eRng As Range
    Set eRng = m.Range("E5:E400")
    Set fc = eRng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E5=""Ilk 11""")
    fc.Font.Color = CLR_TEAL
    fc.Font.Bold = True
    Set fc = eRng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E5=""Yedek""")
    fc.Font.Color = CLR_YELLOW
    Set fc = eRng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E5=""Kadro Disi""")
    fc.Font.Color = CLR_RED
End Sub

' Sekil tabanli buton
Private Sub AddShapeBtn(ByVal ws As Worksheet, ByVal shpName As String, _
    ByVal l As Double, ByVal t As Double, ByVal w As Double, ByVal h As Double, _
    ByVal cap As String, ByVal macroName As String, _
    ByVal fillClr As Long, ByVal textClr As Long)

    Dim shp As Object
    Set shp = ws.Shapes.AddShape(5, l, t, w, h) ' 5 = yuvarlak koseli dikdortgen
    shp.Name = shpName
    shp.Fill.ForeColor.RGB = fillClr
    shp.Fill.Transparency = 0
    shp.Line.ForeColor.RGB = CLR_BORDER
    shp.Line.Weight = 0.75
    On Error Resume Next
    shp.Shadow.Visible = 0
    shp.Adjustments(1) = 0.35
    On Error GoTo 0
    With shp.TextFrame2
        .TextRange.Text = cap
        .TextRange.Font.Size = 9
        .TextRange.Font.Bold = True
        .TextRange.Font.Name = "Segoe UI"
        .TextRange.Font.Fill.ForeColor.RGB = textClr
        .VerticalAnchor = 3    ' orta
        .TextRange.ParagraphFormat.Alignment = 2 ' ortali
        .MarginLeft = 0: .MarginRight = 0: .MarginTop = 0: .MarginBottom = 0
    End With
    shp.OnAction = macroName
End Sub

Private Sub DeleteOkButtons(ByVal ws As Worksheet)
    Dim i As Long
    For i = ws.Shapes.Count To 1 Step -1
        If Left$(ws.Shapes(i).Name, 6) = "okbtn_" Then ws.Shapes(i).Delete
    Next i
End Sub

Private Sub SetupListSheets()
    Dim p As Worksheet
    Set p = ThisWorkbook.Worksheets("Oyuncu Listesi")
    p.Range("A1").Value = "Takim"
    p.Range("B1").Value = "Oyuncu"
    p.Range("C1").Value = "Poz"
    p.Range("D1").Value = "ID"
    p.Range("A1:D1").Font.Bold = True
    p.Columns(1).ColumnWidth = 20
    p.Columns(2).ColumnWidth = 28
    p.Columns(4).ColumnWidth = 14
    p.Columns(5).Hidden = True
    p.Buttons.Delete
    AddBtn p, 360, 2, 76, 20, "Kaydet", "SavePlayerIds"

    Dim mk As Worksheet
    Set mk = ThisWorkbook.Worksheets("Market Listesi")
    mk.Range("A1").Value = "Market"
    mk.Range("B1").Value = "Market Template ID"
    mk.Range("C1").Value = "Tur"
    mk.Range("D1").Value = "Model"
    mk.Range("A1:D1").Font.Bold = True
    mk.Columns(1).ColumnWidth = 22
    mk.Columns(2).ColumnWidth = 20
    mk.Columns(3).ColumnWidth = 12
    mk.Columns(4).ColumnWidth = 8
    mk.Columns(4).Hidden = False
    mk.Columns(5).Hidden = True
    mk.Columns(6).Hidden = True
    mk.Buttons.Delete
    AddBtn mk, 420, 2, 76, 20, "Kaydet", "SaveMarkets"

    Dim f As Worksheet
    Set f = ThisWorkbook.Worksheets("Fixture ID")
    f.Range("A1").Value = "Mac"
    f.Range("B1").Value = "Fixture ID"
    f.Range("A1:B1").Font.Bold = True
    f.Columns(1).ColumnWidth = 45
    f.Columns(2).ColumnWidth = 16
    f.Columns(3).Hidden = True
    f.Buttons.Delete
    AddBtn f, 460, 2, 76, 20, "Kaydet", "SaveFixtureInputs"
End Sub

Private Sub SetupInputSheets()
    Dim si As Worksheet, i As Long
    Set si = ThisWorkbook.Worksheets("Dynamic Input")
    Dim hdr As Variant
    hdr = Array("Fixture ID", "Market Template", "Market Participant", _
                "Market Participant Sort Order", "Line", "Market Status", _
                "Selection_1_Name", "Selection_1_Price", "(Oyuncu)")
    For i = 0 To UBound(hdr)
        si.Cells(3, i + 1).Value = hdr(i)
        si.Cells(3, i + 1).Font.Bold = True
        si.Cells(3, i + 1).Font.Size = 9
    Next i
    For i = 1 To 9
        si.Columns(i).ColumnWidth = 15
    Next i
    si.Columns(10).Hidden = True
    si.Columns(11).Hidden = True
    si.Columns(12).Hidden = True
    si.Buttons.Delete
    AddBtn si, 6, 4, 76, 20, "Yazdir", "PrintStatic"
    AddBtn si, 90, 4, 76, 20, "Temizle", "ClearStatic"

    Dim di As Worksheet
    Set di = ThisWorkbook.Worksheets("Participant Input")
    di.Cells(3, 1).Value = "Fixture ID"
    di.Cells(3, 2).Value = "Market Template"
    di.Cells(3, 3).Value = "Market Status"
    For i = 1 To 3
        di.Cells(3, i).Font.Bold = True
        di.Cells(3, i).Font.Size = 9
    Next i
    di.Columns(53).Hidden = True
    di.Columns(54).Hidden = True
    di.Columns(55).Hidden = True
    di.Buttons.Delete
    AddBtn di, 6, 4, 76, 20, "Yazdir", "PrintDynamic"
    AddBtn di, 90, 4, 76, 20, "Temizle", "ClearDynamic"
End Sub

Private Sub AddBtn(ByVal ws As Worksheet, ByVal l As Double, ByVal t As Double, _
    ByVal w As Double, ByVal h As Double, ByVal cap As String, ByVal macroName As String)
    Dim b As Object
    Set b = ws.Buttons.Add(l, t, w, h)
    b.Caption = cap
    b.OnAction = macroName
End Sub
