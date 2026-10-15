# Synthesize one WAV per narration line with the built-in Windows voice.
#   powershell -File scripts/demo-narration.ps1 demo/narration.json demo/out
param([string]$jsonPath, [string]$outDir)
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $outDir | Out-Null
$lines = Get-Content $jsonPath -Raw | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Zira Desktop")
$s.Rate = 0
$i = 0
foreach ($line in $lines) {
  $i++
  $path = Join-Path $outDir ("scene{0}.wav" -f $i)
  $s.SetOutputToWaveFile($path)
  $s.Speak($line)
  $s.SetOutputToNull()
  Write-Output $path
}
