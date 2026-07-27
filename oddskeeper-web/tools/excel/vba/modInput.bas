Attribute VB_Name = "modInput"
Option Explicit

' Input sayfalari: Yazdir (tek sheet'li xlsx, dosya adi fixture adi,
' farkli kaydet penceresi acilir) ve Temizle.

Public Sub PrintStatic()
    ExportSheet ThisWorkbook.Worksheets("Dynamic Input"), 8, 11
End Sub

Public Sub PrintDynamic()
    Dim ws As Worksheet, lastCol As Long
    Set ws = ThisWorkbook.Worksheets("Participant Input")
    lastCol = ws.Cells(modAdd.INPUT_HDR_ROW, ws.Columns.Count).End(xlToLeft).Column
    If lastCol > 52 Then lastCol = 52
    ExportSheet ws, lastCol, 54
End Sub

Private Sub ExportSheet(ByVal ws As Worksheet, ByVal lastCol As Long, ByVal labelCol As Long)
    Dim n As Long
    n = LastRow(ws, labelCol - 1)
    If n <= modAdd.INPUT_HDR_ROW Then
        MsgBox "Yazdirilacak satir yok.", vbInformation, "Oddskeeper"
        Exit Sub
    End If

    Dim label As String
    label = CStr(ws.Cells(n, labelCol).Value)
    If Len(label) = 0 Then label = "input"
    label = SanitizeFile(label)

    Dim path As Variant
    path = Application.GetSaveAsFilename( _
        InitialFileName:=label & ".xlsx", _
        FileFilter:="Excel (*.xlsx), *.xlsx", _
        Title:="Input dosyasini kaydet")
    If VarType(path) = vbBoolean Then Exit Sub

    Dim wb As Workbook, dst As Worksheet, r As Long, c As Long
    Set wb = Application.Workbooks.Add(xlWBATWorksheet)
    Set dst = wb.Worksheets(1)
    dst.Name = "input"

    Dim dr As Long
    dr = 1
    For r = modAdd.INPUT_HDR_ROW To n
        For c = 1 To lastCol
            dst.Cells(dr, c).NumberFormat = "@"
            dst.Cells(dr, c).Value = CStr(ws.Cells(r, c).Value)
        Next c
        dr = dr + 1
    Next r
    IgnoreNumTextErrors dst.Range(dst.Cells(1, 1), dst.Cells(dr - 1, lastCol))

    Application.DisplayAlerts = False
    wb.SaveAs Filename:=CStr(path), FileFormat:=51
    wb.Close SaveChanges:=False
    Application.DisplayAlerts = True
    MsgBox "Yazdirildi: " & path, vbInformation, "Oddskeeper"
End Sub

Private Function SanitizeFile(ByVal s As String) As String
    Dim bad As Variant, b As Variant
    bad = Array("\", "/", ":", "*", "?", """", "<", ">", "|")
    For Each b In bad
        s = Replace(s, CStr(b), "-")
    Next b
    SanitizeFile = Trim(s)
End Function

Public Sub ClearStatic()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Dynamic Input")
    ws.Range(ws.Cells(modAdd.INPUT_HDR_ROW + 1, 1), ws.Cells(10000, 60)).Clear
End Sub

Public Sub ClearDynamic()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Participant Input")
    ws.Range(ws.Cells(modAdd.INPUT_HDR_ROW + 1, 1), ws.Cells(10000, 60)).Clear
    ' Genisleyen basliklari da sifirla
    ws.Range(ws.Cells(modAdd.INPUT_HDR_ROW, 4), ws.Cells(modAdd.INPUT_HDR_ROW, 52)).Clear
End Sub
