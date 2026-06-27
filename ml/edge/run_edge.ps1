# Запуск edge-детектора падений для одного ларька (Windows).
# Читает falldetect.env рядом с собой, активирует venv и запускает fall_detection.py.
# Ручной запуск:  powershell -ExecutionPolicy Bypass -File ml\edge\run_edge.ps1
# Автозапуск: завести в Task Scheduler (см. README.md, раздел Windows).
$ErrorActionPreference = 'Stop'

$Here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $Here '..\..')

$EnvFile = if ($env:FALLDETECT_ENV) { $env:FALLDETECT_ENV } else { Join-Path $Here 'falldetect.env' }
if (-not (Test-Path $EnvFile)) {
    Write-Error "Нет конфига $EnvFile — скопируйте falldetect.env.example в falldetect.env"
}

# Разбор простого KEY=VALUE конфига (строки с # и пустые игнорируем).
$cfg = @{}
foreach ($line in Get-Content $EnvFile) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $kv = $t -split '=', 2
    if ($kv.Count -eq 2) { $cfg[$kv[0].Trim()] = $kv[1].Trim() }
}
function Cfg($key, $default) { if ($cfg.ContainsKey($key) -and $cfg[$key]) { $cfg[$key] } else { $default } }

# venv: по умолчанию ml\.venv
$Venv   = if ($env:FALLDETECT_VENV) { $env:FALLDETECT_VENV } else { Join-Path $RepoRoot 'ml\.venv' }
$Python = Join-Path $Venv 'Scripts\python.exe'
if (-not (Test-Path $Python)) { $Python = 'python' }

Set-Location (Join-Path $RepoRoot 'ml')

$argList = @(
    'fall_detection.py',
    '--source',      (Cfg 'SOURCE' '0'),
    '--model',       (Cfg 'MODEL_PATH' 'runs/detect/runs/writeoff_detector-3/weights/best.pt'),
    '--backend',     $cfg['BACKEND_URL'],
    '--login',       $cfg['CAM_LOGIN'],
    '--password',    $cfg['CAM_PASSWORD'],
    '--device',      (Cfg 'DEVICE' 'cpu'),
    '--conf',        (Cfg 'CONF' '0.3'),
    '--drop-ratio',  (Cfg 'DROP_RATIO' '0.22'),
    '--floor-ratio', (Cfg 'FLOOR_RATIO' '0.2'),
    '--window-sec',  (Cfg 'WINDOW_SEC' '0.5')
)
if ($cfg.ContainsKey('EXTRA_ARGS') -and $cfg['EXTRA_ARGS']) {
    $argList += ($cfg['EXTRA_ARGS'] -split ' ')
}

& $Python @argList
