# SychBoard Gaming health check — READ-ONLY.
# Only Get-* cmdlets, registry reads, powercfg /getactivescheme and display-settings
# *queries* are used. Nothing here writes a setting. Emits one JSON object on stdout.
# Run by healthcheck.js via -EncodedCommand (no execution-policy change needed).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = [ordered]@{}

function Try-Get([string]$name, [scriptblock]$sb) {
  try { $out[$name] = & $sb } catch { $out[$name] = @{ error = $_.Exception.Message } }
}
function RegVal([string]$path, [string]$name) {
  try { (Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop).$name } catch { $null }
}

Try-Get 'admin' {
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Try-Get 'deviceGuard' {
  $dg = Get-CimInstance -Namespace 'root\Microsoft\Windows\DeviceGuard' -ClassName Win32_DeviceGuard
  @{
    vbsStatus  = [int]$dg.VirtualizationBasedSecurityStatus
    running    = @($dg.SecurityServicesRunning | ForEach-Object { [int]$_ })
    configured = @($dg.SecurityServicesConfigured | ForEach-Object { [int]$_ })
    hvciPolicy = RegVal 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' 'Enabled'
  }
}

Try-Get 'hypervisor' {
  $r = @{ present = [bool](Get-CimInstance Win32_ComputerSystem).HypervisorPresent; features = @{}; needsAdmin = $false }
  if ($out['admin'] -eq $true) {
    foreach ($f in 'Microsoft-Hyper-V-All', 'VirtualMachinePlatform', 'HypervisorPlatform') {
      try { $r.features[$f] = (Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction Stop).State.ToString() }
      catch { $r.features[$f] = 'unknown' }
    }
  } else { $r.needsAdmin = $true }
  $r
}

Try-Get 'power' { ((powercfg /getactivescheme) | Out-String).Trim() }

Try-Get 'game' {
  @{
    autoGameMode      = RegVal 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
    allowAutoGameMode = RegVal 'HKCU:\Software\Microsoft\GameBar' 'AllowAutoGameMode'
    gameBar           = RegVal 'HKCU:\Software\Microsoft\GameBar' 'UseNexusForGameBarEnabled'
    gameDvr           = RegVal 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
    appCapture        = RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled'
    historical        = RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'HistoricalCaptureEnabled'
    policyDvr         = RegVal 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' 'AllowGameDVR'
  }
}

Try-Get 'monitors' {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class SbDisp {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra;
    public int dmFields; public int dmPositionX; public int dmPositionY;
    public int dmDisplayOrientation; public int dmDisplayFixedOutput;
    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
    public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight;
    public int dmDisplayFlags; public int dmDisplayFrequency;
    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType;
    public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
  }
  [DllImport("user32.dll", CharSet = CharSet.Ansi)] public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);
  [DllImport("user32.dll", CharSet = CharSet.Ansi)] public static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
}
'@
  $list = New-Object System.Collections.ArrayList
  $i = 0
  while ($true) {
    $dd = New-Object 'SbDisp+DISPLAY_DEVICE'
    $dd.cb = [Runtime.InteropServices.Marshal]::SizeOf($dd)
    # [NullString]::Value, not $null: PowerShell turns $null into "" for string params,
    # and the API needs a real NULL here to enumerate adapters.
    if (-not [SbDisp]::EnumDisplayDevices([NullString]::Value, [uint32]$i, [ref]$dd, 0)) { break }
    $i++
    if (($dd.StateFlags -band 1) -eq 0) { continue }   # not attached to the desktop
    $dm = New-Object 'SbDisp+DEVMODE'
    $dm.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($dm)
    if (-not [SbDisp]::EnumDisplaySettings($dd.DeviceName, -1, [ref]$dm)) { continue }   # -1 = current settings
    $max = $dm.dmDisplayFrequency
    $t = New-Object 'SbDisp+DEVMODE'
    $t.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($t)
    $m = 0
    while ([SbDisp]::EnumDisplaySettings($dd.DeviceName, $m, [ref]$t)) {
      if ($t.dmPelsWidth -eq $dm.dmPelsWidth -and $t.dmPelsHeight -eq $dm.dmPelsHeight -and $t.dmDisplayFrequency -gt $max) { $max = $t.dmDisplayFrequency }
      $m++
    }
    $mon = New-Object 'SbDisp+DISPLAY_DEVICE'
    $mon.cb = [Runtime.InteropServices.Marshal]::SizeOf($mon)
    $name = $dd.DeviceString
    if ([SbDisp]::EnumDisplayDevices($dd.DeviceName, [uint32]0, [ref]$mon, 0)) { $name = $mon.DeviceString }
    [void]$list.Add(@{
      device = $dd.DeviceName; name = $name
      width = $dm.dmPelsWidth; height = $dm.dmPelsHeight
      hz = $dm.dmDisplayFrequency; maxHz = $max
      primary = (($dd.StateFlags -band 4) -ne 0)
    })
  }
  ,@($list)
}

Try-Get 'gpu' {
  $adapters = New-Object System.Collections.ArrayList
  foreach ($g in Get-CimInstance Win32_VideoController) {
    $d = $null
    if ($g.DriverDate) { $d = $g.DriverDate.ToString('yyyy-MM-dd') }
    [void]$adapters.Add(@{ name = $g.Name; driverVersion = $g.DriverVersion; driverDate = $d })
  }
  $adr = $null
  $cls = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
  foreach ($k in Get-ChildItem -LiteralPath $cls -ErrorAction SilentlyContinue) {
    $p = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction SilentlyContinue
    if ($p -and $p.RadeonSoftwareVersion) { $adr = [string]$p.RadeonSoftwareVersion; break }
  }
  @{ adapters = @($adapters); radeonSoftware = $adr }
}

Try-Get 'chipset' {
  $paths = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  $f = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'AMD Chipset*' -or $_.DisplayName -like 'AMD Ryzen Chipset*' } |
    Select-Object -First 1
  if ($f) { @{ found = $true; name = [string]$f.DisplayName; version = [string]$f.DisplayVersion } } else { @{ found = $false } }
}

Try-Get 'bios' {
  $b = Get-CimInstance Win32_BIOS
  $bb = Get-CimInstance Win32_BaseBoard
  $d = $null
  if ($b.ReleaseDate) { $d = $b.ReleaseDate.ToString('yyyy-MM-dd') }
  @{ vendor = [string]$b.Manufacturer; version = [string]$b.SMBIOSBIOSVersion; date = $d; board = ("$($bb.Manufacturer) $($bb.Product)").Trim() }
}

$out | ConvertTo-Json -Depth 6 -Compress
