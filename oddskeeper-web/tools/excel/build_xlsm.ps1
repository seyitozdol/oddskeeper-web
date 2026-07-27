# Oddskeeper Player Market xlsm derleyicisi (lisansli Excel olan makine icin).
# Sayfa duzeni dahil her sey VBA'da (modSetup.SetupWorkbook); bu script sadece
# modulleri gomup kurulumu calistirir.
# Sartlar: lisansli Excel + "VBA proje nesne modeline erisime guven" acik.
# Kullanim: powershell -ExecutionPolicy Bypass -File build_xlsm.ps1
#
# Excel'i olmayan/lisanssiz makinede: README'deki elle import adimlarini izle.

$ErrorActionPreference = 'Stop'

# Excel COM, Turkce is parcacigi kulturuyle rastgele 0x800A03EC hatasi
# verebiliyor; en-US kulture gecmek bilinen cozum.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbaDir = Join-Path $root 'vba'
$outPath = Join-Path $root 'PlayerMarket.xlsm'

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

# Excel tam hazir olana kadar bekle
for ($w = 0; $w -lt 40; $w++) {
    try { if ($excel.Ready) { break } } catch {}
    Start-Sleep -Milliseconds 250
}
Start-Sleep -Milliseconds 500

try {
    $wb = $excel.Workbooks.Add()

    if ($null -eq $wb.VBProject) {
        throw 'VBA proje erisimi kapali. Excel > Secenekler > Guven Merkezi > Guven Merkezi Ayarlari > Makro Ayarlari > "VBA proje nesne modeline erisime guven" isaretlenmeli.'
    }

    foreach ($mod in 'modApi','modCalc','modData','modModel','modAdd','modInput','modSave','modSetup','modEvents') {
        $null = $wb.VBProject.VBComponents.Import((Join-Path $vbaDir "$mod.bas"))
    }
    $null = $wb.VBProject.VBComponents.Import((Join-Path $vbaDir 'clsAppEvents.cls'))

    $excel.Run('SetupWorkbookSilent')

    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $wb.SaveAs($outPath, 52)   # 52 = xlOpenXMLWorkbookMacroEnabled
    $wb.Close($false)
    Write-Output "OK: $outPath"
}
finally {
    $excel.Quit()
    [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
