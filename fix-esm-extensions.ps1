param(
  [switch]$Apply,
  [string[]]$Include = @("*.ts","*.tsx")
)

# Work on source files, skip builds and .d.ts
$files = Get-ChildItem -Recurse -Include $Include | Where-Object {
  $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\build\\|\\.next\\|\\out\\' -and
  $_.Name -notmatch '\.d\.ts$'
}

# Regexes (multiline)
$rxFrom = [regex]'(?m)^\s*(?:import|export)\b[^;\n]*?\bfrom\s+(["'"])(\.(?:\.?)/[^"''()\s;]+)\1'
$rxBare = [regex]'(?m)^\s*import\s+(["'"])(\.(?:\.?)/[^"''()\s;]+)\1'
$rxDyn  = [regex]'(?m)^\s*import\(\s*(["'"])(\.(?:\.?)/[^"''()\s;]+)\1\s*\)'

function NeedsFix([string]$spec) {
  return ($spec -notmatch '\.(?:m?js|cjs|json|node)$')
}

function ResolveNewSpec([string]$filePath, [string]$spec) {
  $base = Split-Path -Parent $filePath
  $candidates = @("$spec.ts","$spec.tsx","$spec.mts","$spec.cts") | ForEach-Object { Join-Path $base $_ }
  $idx = @("index.ts","index.tsx","index.mts","index.cts") | ForEach-Object { Join-Path $base (Join-Path $spec $_) }

  if ($candidates | Where-Object { Test-Path $_ -PathType Leaf }) {
    return "$spec.js"
  } elseif ($idx | Where-Object { Test-Path $_ -PathType Leaf }) {
    if ($spec.EndsWith("/")) { return "${spec}index.js" } else { return "$spec/index.js" }
  } else {
    return "$spec.js"
  }
}

function FixWithRegex([string]$text, [string]$path, [regex]$rx) {
  $evaluator = {
    param($m)
    $spec = $m.Groups[2].Value
    if (-not (NeedsFix $spec)) { return $m.Value }
    $newSpec = ResolveNewSpec $path $spec
    $pre  = $m.Value.Substring(0, $m.Groups[2].Index - $m.Index)
    $post = $m.Value.Substring(($m.Groups[2].Index - $m.Index) + $m.Groups[2].Length)
    return "$pre$newSpec$post"
  }
  return $rx.Replace($text, $evaluator)
}

$changed = @()

foreach ($f in $files) {
  $orig = Get-Content -Raw -Path $f.FullName
  $next = $orig
  $next = FixWithRegex $next $f.FullName $rxFrom
  $next = FixWithRegex $next $f.FullName $rxBare
  $next = FixWithRegex $next $f.FullName $rxDyn

  if ($next -ne $orig) {
    $changed += $f.FullName
    if ($Apply) {
      Copy-Item -Path $f.FullName -Destination ($f.FullName + ".bak") -Force
      Set-Content -Path $f.FullName -Value $next -NoNewline
    }
  }
}

if ($changed.Count -eq 0) {
  Write-Host "No fixes needed." -ForegroundColor Green
} else {
  if ($Apply) {
    Write-Host "Patched $($changed.Count) file(s). Backups saved as *.bak" -ForegroundColor Green
  } else {
    Write-Host "Dry run: would patch $($changed.Count) file(s). Use -Apply to write." -ForegroundColor Yellow
  }
  $changed | ForEach-Object { Write-Host " - $_" }
}
