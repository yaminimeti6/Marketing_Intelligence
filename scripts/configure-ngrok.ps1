$ErrorActionPreference = 'Stop'
$ngrokCommand = Get-Command ngrok -ErrorAction Stop
Write-Host 'Open https://dashboard.ngrok.com/get-started/your-authtoken in your browser.'
Write-Host 'Click Copy for the authtoken only, not the full example command. Do not share it in chat.'
[void](Read-Host 'After copying the token, return here and press Enter ONLY (do not paste it)')
$ngrokToken = Get-Clipboard -Raw
try {
    if ([string]::IsNullOrWhiteSpace($ngrokToken)) { throw 'Clipboard is empty. Nothing configured.' }
    $ngrokToken = $ngrokToken.Trim()
    if ($ngrokToken.Length -lt 20 -or $ngrokToken.Length -gt 512 -or $ngrokToken -match '\s') {
        throw 'Copy only the authtoken from the ngrok dashboard. Nothing configured.'
    }
    # The literal secret is never placed in a typed command or printed.
    # ngrok stores it in its private local agent configuration.
    & $ngrokCommand.Source config add-authtoken $ngrokToken *> $null
    if ($LASTEXITCODE -ne 0) { throw 'ngrok could not save the token. Error details withheld to protect credentials.' }
    Write-Host 'ngrok authtoken saved locally. No token displayed. No tunnel started.'
} finally {
    $ngrokToken = $null
    # Some Windows PowerShell versions reject an empty clipboard string.
    # Cleanup must never mask the actual ngrok configuration result.
    try { Set-Clipboard -Value ' ' -ErrorAction Stop } catch {
        Write-Host 'Clipboard cleanup unavailable. Copy any non-secret text to replace the token.'
    }
}
