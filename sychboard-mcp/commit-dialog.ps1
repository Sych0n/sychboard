param(
  [string]$RepoLabel,
  [string]$DiffPath,
  [string]$MsgPath,
  [string]$OutPath
)
# Native, server-owned commit approval dialog. Shows the REAL staged diff
# (read-only) and the AI-drafted commit message (editable). Only writes
# $OutPath — and only the final message text — if the user clicks Commit.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$diffText = Get-Content -Raw -Path $DiffPath -ErrorAction SilentlyContinue
$draftMsg = Get-Content -Raw -Path $MsgPath -ErrorAction SilentlyContinue

$form = New-Object System.Windows.Forms.Form
$form.Text = "sychboard-mcp - confirm commit: $RepoLabel"
$form.Width = 780
$form.Height = 640
$form.StartPosition = "CenterScreen"
$form.TopMost = $true

$lbl1 = New-Object System.Windows.Forms.Label
$lbl1.Text = "Diff to be committed in ${RepoLabel}:"
$lbl1.Left = 10; $lbl1.Top = 10; $lbl1.Width = 740

$diffBox = New-Object System.Windows.Forms.TextBox
$diffBox.Multiline = $true
$diffBox.ScrollBars = "Both"
$diffBox.ReadOnly = $true
$diffBox.WordWrap = $false
$diffBox.Font = New-Object System.Drawing.Font("Consolas", 9)
$diffBox.Left = 10; $diffBox.Top = 32; $diffBox.Width = 740; $diffBox.Height = 380
$diffBox.Text = $diffText

$lbl2 = New-Object System.Windows.Forms.Label
$lbl2.Text = "Commit message (edit if you want, then Commit):"
$lbl2.Left = 10; $lbl2.Top = 420; $lbl2.Width = 740

$msgBox = New-Object System.Windows.Forms.TextBox
$msgBox.Multiline = $true
$msgBox.ScrollBars = "Vertical"
$msgBox.Font = New-Object System.Drawing.Font("Consolas", 9)
$msgBox.Left = 10; $msgBox.Top = 442; $msgBox.Width = 740; $msgBox.Height = 90
$msgBox.Text = $draftMsg

$okBtn = New-Object System.Windows.Forms.Button
$okBtn.Text = "Commit"
$okBtn.Left = 570; $okBtn.Top = 545; $okBtn.Width = 80
$okBtn.DialogResult = [System.Windows.Forms.DialogResult]::OK

$cancelBtn = New-Object System.Windows.Forms.Button
$cancelBtn.Text = "Cancel"
$cancelBtn.Left = 660; $cancelBtn.Top = 545; $cancelBtn.Width = 80
$cancelBtn.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

$form.AcceptButton = $okBtn
$form.CancelButton = $cancelBtn
$form.Controls.AddRange(@($lbl1, $diffBox, $lbl2, $msgBox, $okBtn, $cancelBtn))

$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $msgBox.Text.Trim().Length -gt 0) {
  Set-Content -Path $OutPath -Value $msgBox.Text -NoNewline
  Write-Output "APPROVED"
} else {
  Write-Output "DENIED"
}
