Attribute VB_Name = "modEvents"
Option Explicit

' Uygulama olaylarini ayaga kaldirir. Sayfa/ThisWorkbook koduna gerek
' birakmamak icin (elle import akisi) clsAppEvents sinifi Application
' olaylarini dinler; Auto_Open dosya acilisinda kurar. Import sonrasi
' dosya yeniden acilmadiysa SetupWorkbook/Yenile/Modeli Kur da kurar.

Public gEvents As clsAppEvents

Public Sub Auto_Open()
    EnsureEvents
End Sub

Public Sub EnsureEvents()
    If gEvents Is Nothing Then Set gEvents = New clsAppEvents
    Application.EnableEvents = True
End Sub
