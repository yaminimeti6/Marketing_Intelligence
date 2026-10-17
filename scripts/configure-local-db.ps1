param([switch]$UseClipboard)

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
if (!(Test-Path -LiteralPath (Join-Path $projectPath '.env'))) {
    throw 'Missing .env. Create it from .env.example first.'
}
$nodePath = (Get-Command node -ErrorAction Stop).Source
$passwords = @{}
$process = $null
try {
    foreach ($role in @('northstar_app', 'northstar_migrator')) {
        if ($UseClipboard) {
            Write-Host "Copy the CURRENT saved password for $role from your password manager."
            [void](Read-Host 'Then press Enter here ONLY. Do not type or paste the password into this prompt')
            $clipboardPassword = Get-Clipboard -Raw
            if ([string]::IsNullOrEmpty($clipboardPassword)) { throw 'Clipboard is empty. Nothing saved.' }
            $passwords[$role] = $clipboardPassword
            $clipboardPassword = $null
            Set-Clipboard -Value ''
        } else {
            $secret = Read-Host "Paste the CURRENT saved password for $role (hidden)" -AsSecureString
            try {
                if ($secret.Length -eq 0) { throw 'Empty password. Nothing saved.' }
                $credential = [Net.NetworkCredential]::new('', $secret)
                $passwords[$role] = $credential.Password
            } finally {
                $credential = $null
                $secret.Dispose()
            }
        }
    }
    Write-Host 'Checking both connections before saving...'
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $nodePath
    $helperPath = Join-Path $PSScriptRoot 'configure-local-db.mjs'
    $info.Arguments = '"' + $helperPath + '"'
    $info.WorkingDirectory = $projectPath
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    [void]$process.Start()
    $json = ConvertTo-Json -InputObject $passwords -Compress
    # Windows PowerShell/.NET Framework lacks StandardInputEncoding.
    # Write UTF-8 bytes directly to avoid the platform's default text encoding.
    $inputBytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
    $process.StandardInput.BaseStream.Write($inputBytes, 0, $inputBytes.Length)
    $process.StandardInput.BaseStream.Flush()
    $process.StandardInput.Close()
    $json = $null
    [Array]::Clear($inputBytes, 0, $inputBytes.Length)
    $output = $process.StandardOutput.ReadToEnd()
    $failure = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($output) { Write-Host $output.Trim() }
    if ($failure) { Write-Host $failure.Trim() }
    if ($process.ExitCode -ne 0) { exit 1 }
} finally {
    foreach ($key in @($passwords.Keys)) { $passwords[$key] = $null }
    $json = $null
    if ($inputBytes) { [Array]::Clear($inputBytes, 0, $inputBytes.Length) }
    if ($process) { $process.Dispose() }
}
