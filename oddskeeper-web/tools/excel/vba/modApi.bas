Attribute VB_Name = "modApi"
Option Explicit

' Supabase REST erisimi. Veri CSV olarak cekilir (Accept: text/csv),
' yazma JSON upsert ile yapilir. analytics semasi icin Accept-Profile /
' Content-Profile basliklari sart.

Public Function CfgUrl() As String
    CfgUrl = ThisWorkbook.Worksheets("_cfg").Range("B1").Value
End Function

Public Function CfgKey() As String
    CfgKey = ThisWorkbook.Worksheets("_cfg").Range("B2").Value
End Function

Public Function ApiGetCsv(ByVal path As String) As String
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", CfgUrl() & "/rest/v1/" & path, False
    http.setRequestHeader "apikey", CfgKey()
    http.setRequestHeader "Authorization", "Bearer " & CfgKey()
    http.setRequestHeader "Accept", "text/csv"
    http.setRequestHeader "Accept-Profile", "analytics"
    http.send
    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 1, "ApiGetCsv", _
            "API GET hata " & http.Status & " (" & path & "): " & Left$(http.responseText, 300)
    End If
    ApiGetCsv = http.responseText
End Function

Public Sub ApiPostJson(ByVal path As String, ByVal json As String)
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", CfgUrl() & "/rest/v1/" & path, False
    http.setRequestHeader "apikey", CfgKey()
    http.setRequestHeader "Authorization", "Bearer " & CfgKey()
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Content-Profile", "analytics"
    http.setRequestHeader "Prefer", "resolution=merge-duplicates,return=minimal"
    http.send json
    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 2, "ApiPostJson", _
            "API POST hata " & http.Status & " (" & path & "): " & Left$(http.responseText, 300)
    End If
End Sub

' CSV metnini sayfaya yazar (A1'den itibaren, baslik dahil).
Public Sub CsvToSheet(ByVal csv As String, ByVal ws As Worksheet)
    ws.Cells.Clear
    CsvAppendToSheet csv, ws, True
End Sub

' CSV'yi sayfanin sonuna ekler. includeHeader=False ise ilk satir atlanir.
Public Sub CsvAppendToSheet(ByVal csv As String, ByVal ws As Worksheet, ByVal includeHeader As Boolean)
    Dim rows As Collection
    Set rows = ParseCsv(csv)
    If rows.Count = 0 Then Exit Sub

    Dim startRow As Long
    startRow = ws.Cells(ws.rows.Count, 1).End(xlUp).Row
    If Len(ws.Cells(startRow, 1).Value) > 0 Then startRow = startRow + 1

    Dim r As Long, c As Long, first As Boolean, arr As Variant
    first = True
    For r = 1 To rows.Count
        arr = rows(r)
        If first And Not includeHeader Then
            first = False
        Else
            first = False
            For c = LBound(arr) To UBound(arr)
                ws.Cells(startRow, c + 1).Value = arr(c)
            Next c
            startRow = startRow + 1
        End If
    Next r
End Sub

' RFC4180 CSV ayristirici: tirnak ve cift tirnak kacisini destekler.
Public Function ParseCsv(ByVal s As String) As Collection
    Dim result As New Collection
    Dim fields As Collection
    Set fields = New Collection
    Dim i As Long, n As Long, ch As String * 1
    Dim field As String, inQ As Boolean
    n = Len(s)
    i = 1
    Do While i <= n
        ch = Mid$(s, i, 1)
        If inQ Then
            If ch = """" Then
                If i < n And Mid$(s, i + 1, 1) = """" Then
                    field = field & """"
                    i = i + 1
                Else
                    inQ = False
                End If
            Else
                field = field & ch
            End If
        Else
            Select Case ch
                Case """"
                    inQ = True
                Case ","
                    fields.Add field
                    field = ""
                Case vbCr
                    ' vbLf ile birlikte gelir; satiri Lf'de kapat
                Case vbLf
                    fields.Add field
                    field = ""
                    result.Add CollToArr(fields)
                    Set fields = New Collection
                Case Else
                    field = field & ch
            End Select
        End If
        i = i + 1
    Loop
    If Len(field) > 0 Or fields.Count > 0 Then
        fields.Add field
        result.Add CollToArr(fields)
    End If
    Set ParseCsv = result
End Function

Private Function CollToArr(ByVal c As Collection) As Variant
    Dim arr() As Variant, i As Long
    ReDim arr(0 To c.Count - 1)
    For i = 1 To c.Count
        arr(i - 1) = c(i)
    Next i
    CollToArr = arr
End Function

' Metin olarak yazilmis sayilardaki yesil "sayi metin olarak sakli"
' uyari ucgenlerini kapatir (deger nokta formatinda metin kalmali).
Public Sub IgnoreNumTextErrors(ByVal rng As Range)
    Dim c As Range
    On Error Resume Next
    For Each c In rng.Cells
        c.Errors(3).Ignore = True   ' 3 = xlNumberAsText
    Next c
    On Error GoTo 0
End Sub

' URL sorgu degeri icin basit kacis (sezon etiketindeki / vb.)
Public Function UrlEnc(ByVal s As String) As String
    s = Replace(s, "/", "%2F")
    s = Replace(s, " ", "%20")
    UrlEnc = s
End Function

Public Function JsonEsc(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    s = Replace(s, vbCrLf, "\n")
    s = Replace(s, vbLf, "\n")
    s = Replace(s, vbCr, "\n")
    s = Replace(s, vbTab, "\t")
    JsonEsc = s
End Function

' Sayiyi her zaman nokta ondalikli metne cevirir (yerel ayar bagimsiz).
Public Function FormatDot(ByVal v As Double, ByVal decimals As Long) As String
    Dim s As String
    s = Format(v, "0." & String(decimals, "0"))
    FormatDot = Replace(s, ",", ".")
End Function

' Hucre degerini guvenle Double'a cevirir. Val() KULLANMA: sayisal hucre
' Turkce yerel ayarda "46,32" metnine donusup 46'da kesiliyor.
Public Function ToDbl(ByVal v As Variant) As Double
    On Error GoTo zero
    Select Case VarType(v)
        Case vbDouble, vbSingle, vbInteger, vbLong, vbCurrency, vbDecimal, vbDate
            ToDbl = CDbl(v)
            Exit Function
    End Select
    Dim s As String, sep As String
    s = Trim(CStr(v))
    If Len(s) = 0 Then GoTo zero
    ' Hem nokta hem virgul, yerel ondalik ayracina cevrilir
    sep = Mid$(Format(0, "0.0"), 2, 1)
    s = Replace(s, ",", sep)
    s = Replace(s, ".", sep)
    ToDbl = CDbl(s)
    Exit Function
zero:
    ToDbl = 0
End Function
