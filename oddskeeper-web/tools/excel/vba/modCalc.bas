Attribute VB_Name = "modCalc"
Option Explicit

' Sitedeki compute.ts'in birebir VBA karsiligi:
' Poisson CDF, over olasiligi (+0.17 kaydirma), payback'li oran,
' beklentiyle buyuyen orta cizgi aramasi ve 4'lu line uretimi.

Public Function PoissonCdf(ByVal lambda As Double, ByVal k As Long) As Double
    If lambda <= 0 Then
        PoissonCdf = 1#
        Exit Function
    End If
    Dim term As Double, total As Double, i As Long
    term = Exp(-lambda)
    total = term
    For i = 1 To k
        term = term * lambda / i
        total = total + term
    Next i
    If total > 1# Then total = 1#
    PoissonCdf = total
End Function

Public Function OverProb(ByVal expVal As Double, ByVal line As Double) As Double
    OverProb = 1# - PoissonCdf(expVal + 0.17, Int(line))
End Function

Public Function ProbToOdds(ByVal p As Double, ByVal payback As Double) As Double
    If p <= 0 Then
        ProbToOdds = 999#
    ElseIf p >= 1 Then
        ProbToOdds = 1.01
    Else
        ProbToOdds = (1# / p) * (payback / 100#)
    End If
End Function

Public Function FindMidLine(ByVal lambda As Double) As Double
    Dim best As Double, bestDiff As Double
    Dim i As Long, maxI As Long, line As Double, ov As Double, diff As Double
    best = 0.5
    bestDiff = 1E+30
    maxI = 30
    If Int(lambda) + 10 > maxI Then maxI = Int(lambda) + 10
    For i = 0 To maxI
        line = i + 0.5
        ov = OverProb(lambda, line)
        diff = Abs(ov - (1# - ov))
        If diff < bestDiff Then
            bestDiff = diff
            best = line
        End If
    Next i
    FindMidLine = best
End Function

' 4 ardisik line ve over oranlarini doldurur (1..4 indeksli diziler).
Public Sub CalcLines(ByVal expVal As Double, ByVal payback As Double, _
                     ByRef lines() As Double, ByRef odds() As Double)
    Dim mid As Double, lower As Double, l1 As Double, i As Long
    mid = FindMidLine(expVal)
    lower = mid - 1#
    If lower < 0.5 Then lower = 0.5
    If lower < mid And ProbToOdds(OverProb(expVal, lower), payback) >= 1.2 Then
        l1 = lower
    Else
        l1 = mid
    End If
    For i = 1 To 4
        lines(i) = l1 + (i - 1)
        odds(i) = ProbToOdds(OverProb(expVal, lines(i)), payback)
    Next i
End Sub
