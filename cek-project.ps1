$root = "C:\Users\36\Music\smpn36-platform"

function Cek($label, $path, $wajib = $true) {
    $full = Join-Path $root $path
    if (Test-Path $full) {
        Write-Host "[ADA]  $label" -ForegroundColor Green
    } elseif ($wajib) {
        Write-Host "[BELUM] $label" -ForegroundColor Red
    } else {
        Write-Host "[OPS]  $label" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== 1. FONDASI ===" -ForegroundColor Cyan
Cek "package.json"           "package.json"
Cek "middleware.ts"          "middleware.ts"
Cek ".env.local"             ".env.local"
Cek "app/layout.tsx"         "app\layout.tsx"
Cek "app/page.tsx"           "app\page.tsx"
Cek "app/globals.css"        "app\globals.css"

Write-Host ""
Write-Host "=== 2. LIB SUPABASE ===" -ForegroundColor Cyan
Cek "lib/supabase/client.ts"     "lib\supabase\client.ts"
Cek "lib/supabase/server.ts"     "lib\supabase\server.ts"
Cek "lib/supabase/middleware.ts" "lib\supabase\middleware.ts"
Cek "lib/types/database.ts"      "lib\types\database.ts"

Write-Host ""
Write-Host "=== 3. AUTH ===" -ForegroundColor Cyan
Cek "login page"              "app\(auth)\login\page.tsx"
Cek "ganti-password page"     "app\(auth)\ganti-password\page.tsx"
Cek "API login"               "app\api\auth\login\route.ts"
Cek "API logout"              "app\api\auth\logout\route.ts"
Cek "API ganti-password"      "app\api\auth\ganti-password\route.ts"

Write-Host ""
Write-Host "=== 4. DASHBOARD ADMIN ===" -ForegroundColor Cyan
Cek "admin layout"            "app\dashboard\admin\layout.tsx"
Cek "admin page"              "app\dashboard\admin\page.tsx"
Cek "admin data-siswa"        "app\dashboard\admin\data-siswa\page.tsx"
Cek "admin data-guru"         "app\dashboard\admin\data-guru\page.tsx"
Cek "admin data-kelas"        "app\dashboard\admin\data-kelas\page.tsx"
Cek "admin absensi"           "app\dashboard\admin\absensi\page.tsx"
Cek "admin input-absensi"     "app\dashboard\admin\input-absensi\page.tsx"
Cek "admin nilai"             "app\dashboard\admin\nilai\page.tsx"
Cek "admin jurnal"            "app\dashboard\admin\jurnal\page.tsx"
Cek "admin cbt"               "app\dashboard\admin\cbt\page.tsx"
Cek "admin bank-soal"         "app\dashboard\admin\bank-soal\page.tsx" $false
Cek "admin hasil-ujian"       "app\dashboard\admin\hasil-ujian\page.tsx" $false

Write-Host ""
Write-Host "=== 5. DASHBOARD GURU ===" -ForegroundColor Cyan
Cek "guru layout"             "app\dashboard\guru\layout.tsx"
Cek "guru page"               "app\dashboard\guru\page.tsx"
Cek "guru absensi"            "app\dashboard\guru\absensi\page.tsx"
Cek "guru materi"             "app\dashboard\guru\materi\page.tsx"
Cek "guru dokumen-ajar"       "app\dashboard\guru\dokumen-ajar\page.tsx" $false
Cek "guru bank-soal"          "app\dashboard\guru\bank-soal\page.tsx" $false
Cek "guru ujian"              "app\dashboard\guru\ujian\page.tsx" $false
Cek "guru nilai"              "app\dashboard\guru\nilai\page.tsx" $false

Write-Host ""
Write-Host "=== 6. DASHBOARD SISWA ===" -ForegroundColor Cyan
Cek "siswa layout"            "app\dashboard\siswa\layout.tsx"
Cek "siswa page"              "app\dashboard\siswa\page.tsx"
Cek "siswa materi"            "app\dashboard\siswa\materi\page.tsx"
Cek "siswa pengumuman"        "app\dashboard\siswa\pengumuman\page.tsx"
Cek "siswa tugas"             "app\dashboard\siswa\tugas\page.tsx" $false
Cek "siswa hasil"             "app\dashboard\siswa\hasil\page.tsx" $false

Write-Host ""
Write-Host "=== 7. CBT ===" -ForegroundColor Cyan
Cek "cbt layout"              "app\cbt\layout.tsx"
Cek "cbt page"                "app\cbt\page.tsx"
Cek "API ujian"               "app\api\ujian\route.ts" $false
Cek "API jawaban"             "app\api\jawaban\route.ts" $false
Cek "API hasil"               "app\api\hasil\route.ts" $false

Write-Host ""
Write-Host "=== 8. API LAINNYA ===" -ForegroundColor Cyan
Cek "API import-siswa"        "app\api\admin\import-siswa\route.ts"
Cek "API import-soal"         "app\api\admin\import-soal\route.ts" $false

Write-Host ""
Write-Host "=== SELESAI ===" -ForegroundColor Cyan
Write-Host "[ADA]   = file sudah ada" -ForegroundColor Green
Write-Host "[BELUM] = wajib dibuat" -ForegroundColor Red
Write-Host "[OPS]   = opsional" -ForegroundColor Yellow
Write-Host ""
