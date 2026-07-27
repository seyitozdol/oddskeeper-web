VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "clsAppEvents"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Option Explicit

' Uygulama duzeyi olaylar (sayfa koduna gerek birakmadan):
' - Model'de Manuel kolonuna deger girilince oyuncu tiki otomatik dolar.
' - Cift tiklama: tik hucrelerinde x'i acar/kapar (checkbox gibi),
'   blok kolon basliklarinda siralama yapar,
'   Market Listesi'nin Model kolonunda tiki acip dropdown'i tazeler.

Public WithEvents App As Application

Private Sub Class_Initialize()
    Set App = Application
End Sub

Private Sub App_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    On Error GoTo done
    If Not Sh.Parent Is ThisWorkbook Then Exit Sub

    If Sh.Name = "Model" Then
        ' Manuel (J) kolonuna deger girildiyse tiki doldur
        Dim hit As Range, c As Range
        Set hit = Intersect(Target, Sh.Columns(10))
        If Not hit Is Nothing Then
            Application.EnableEvents = False
            For Each c In hit.Cells
                If c.Row >= 6 And InDataRow(c.Row) Then
                    If ToDbl(c.Value) > 0 Then Sh.Cells(c.Row, 1).Value = "x"
                End If
            Next c
            Application.EnableEvents = True
        End If
    ElseIf Sh.Name = "Market Listesi" Then
        If Not Intersect(Target, Sh.Columns(4)) Is Nothing Then
            modData.RebuildMarketDropdown
        End If
    End If
    Exit Sub
done:
    Application.EnableEvents = True
End Sub

Private Sub App_SheetBeforeDoubleClick(ByVal Sh As Object, ByVal Target As Range, Cancel As Boolean)
    On Error GoTo done
    If Not Sh.Parent Is ThisWorkbook Then Exit Sub
    If Target.Cells.Count > 1 Then Exit Sub

    Dim r As Long, colN As Long
    r = Target.Row
    colN = Target.Column

    If Sh.Name = "Model" Then
        ' Tik hucreleri: oyuncu tiki (A) ve line tikleri (M/P/S/V)
        If (colN = 1 Or colN = 13 Or colN = 16 Or colN = 19 Or colN = 22) _
           And InDataRow(r) Then
            Application.EnableEvents = False
            Target.Value = IIf(CStr(Target.Value) = "x", "", "x")
            Application.EnableEvents = True
            Cancel = True
        ' Blok kolon basliklari: siralama
        ElseIf colN >= 2 And colN <= 10 And IsHeaderRow(r) Then
            Cancel = True
            modModel.SortBlock r, colN
        End If
    ElseIf Sh.Name = "Market Listesi" Then
        If colN = 4 And r >= 2 And Len(CStr(Sh.Cells(r, 1).Value)) > 0 Then
            Application.EnableEvents = False
            Target.Value = IIf(CStr(Target.Value) = "x", "", "x")
            Application.EnableEvents = True
            Cancel = True
            modData.RebuildMarketDropdown
        End If
    End If
    Exit Sub
done:
    Application.EnableEvents = True
End Sub

' Satir, kurulu bloklardan birinin veri araliginda mi?
Private Function InDataRow(ByVal r As Long) As Boolean
    Dim cfg As Worksheet
    Set cfg = ThisWorkbook.Worksheets("_cfg")
    Dim hs As Long, hc As Long, as_ As Long, ac As Long
    hs = CLng(ToDbl(cfg.Range("B10").Value))
    hc = CLng(ToDbl(cfg.Range("B11").Value))
    as_ = CLng(ToDbl(cfg.Range("B12").Value))
    ac = CLng(ToDbl(cfg.Range("B13").Value))
    InDataRow = (hs > 0 And r >= hs And r < hs + hc) _
             Or (as_ > 0 And r >= as_ And r < as_ + ac)
End Function

Private Function IsHeaderRow(ByVal r As Long) As Boolean
    Dim cfg As Worksheet
    Set cfg = ThisWorkbook.Worksheets("_cfg")
    Dim hs As Long, as_ As Long
    hs = CLng(ToDbl(cfg.Range("B10").Value))
    as_ = CLng(ToDbl(cfg.Range("B12").Value))
    IsHeaderRow = (hs > 0 And r = hs - 1) Or (as_ > 0 And r = as_ - 1)
End Function
