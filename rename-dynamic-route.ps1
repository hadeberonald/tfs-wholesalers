# rename-dynamic-route.ps1
# This script renames [branch] to [slug] and updates all nested dynamic routes

$ErrorActionPreference = "Stop"

Write-Host "Starting migration from [branch] to [slug]..." -ForegroundColor Green

# 1. Close any file handles
Write-Host "Please close all files in your editor and press Enter to continue..."
Read-Host

# 2. Stop Next.js dev server
$nextProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*tfs-wholesalers*" }
if ($nextProcess) {
    Write-Host "Stopping Next.js dev server..." -ForegroundColor Yellow
    $nextProcess | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 3. Delete .next folder
$nextDir = ".\.next"
if (Test-Path $nextDir) {
    Write-Host "Removing .next cache folder..." -ForegroundColor Yellow
    Remove-Item -Path $nextDir -Recurse -Force
}

# 4. Check if [branch] exists
$oldDir = ".\app\[branch]"
$newDir = ".\app\[slug]"

if (-not (Test-Path $oldDir)) {
    Write-Host "ERROR: [branch] folder not found at $oldDir" -ForegroundColor Red
    Write-Host "Current app structure:" -ForegroundColor Yellow
    Get-ChildItem -Path ".\app" -Directory | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Cyan }
    exit 1
}

# 5. If [slug] already exists (empty), remove it
if (Test-Path $newDir) {
    Write-Host "Removing existing empty [slug] directory..." -ForegroundColor Yellow
    Remove-Item -Path $newDir -Recurse -Force
}

# 6. Rename [branch] to [slug]
Write-Host "Renaming [branch] to [slug]..." -ForegroundColor Yellow
try {
    # Use Robocopy for a more reliable copy
    $robocopyArgs = @(
        $oldDir,
        $newDir,
        "/E",           # Copy subdirectories, including empty ones
        "/MOVE",        # Move files and directories (delete from source)
        "/NFL",         # No file list
        "/NDL",         # No directory list
        "/NJH",         # No job header
        "/NJS",         # No job summary
        "/NC",          # No class
        "/NS",          # No size
        "/NP"           # No progress
    )
    
    $result = robocopy @robocopyArgs
    
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "Successfully moved [branch] to [slug]" -ForegroundColor Green
} catch {
    Write-Host "Robocopy approach failed, trying alternative method..." -ForegroundColor Yellow
    
    # Fallback: Copy then delete
    Copy-Item -Path $oldDir -Destination $newDir -Recurse -Force
    Write-Host "Copied [branch] to [slug]" -ForegroundColor Green
    
    Remove-Item -Path $oldDir -Recurse -Force
    Write-Host "Removed old [branch] directory" -ForegroundColor Green
}

# 7. Rename nested dynamic routes to avoid conflicts
Write-Host "`nRenaming nested dynamic routes to avoid parameter name conflicts..." -ForegroundColor Yellow

$renameMappings = @(
    @{ Old = ".\app\[slug]\categories\[slug]"; New = ".\app\[slug]\categories\[categorySlug]"; Param = "categorySlug" }
    @{ Old = ".\app\[slug]\combo\[slug]"; New = ".\app\[slug]\combo\[comboSlug]"; Param = "comboSlug" }
    @{ Old = ".\app\[slug]\products\[slug]"; New = ".\app\[slug]\products\[productSlug]"; Param = "productSlug" }
    @{ Old = ".\app\[slug]\specials\[slug]"; New = ".\app\[slug]\specials\[specialSlug]"; Param = "specialSlug" }
)

foreach ($mapping in $renameMappings) {
    if (Test-Path $mapping.Old) {
        Write-Host "  Renaming: $($mapping.Old) -> $($mapping.New)" -ForegroundColor Cyan
        
        # Create parent directory if it doesn't exist
        $parentDir = Split-Path -Parent $mapping.New
        if (-not (Test-Path $parentDir)) {
            New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
        }
        
        # Rename the directory
        Move-Item -Path $mapping.Old -Destination $mapping.New -Force
        Write-Host "    ✓ Renamed to use parameter: $($mapping.Param)" -ForegroundColor Green
    } else {
        Write-Host "  Skipping (not found): $($mapping.Old)" -ForegroundColor DarkGray
    }
}

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

Write-Host "`nFolder structure updated:" -ForegroundColor Cyan
Write-Host "  ✓ app/[branch] -> app/[slug]" -ForegroundColor White
Write-Host "  ✓ categories/[slug] -> categories/[categorySlug]" -ForegroundColor White
Write-Host "  ✓ combo/[slug] -> combo/[comboSlug]" -ForegroundColor White
Write-Host "  ✓ products/[slug] -> products/[productSlug]" -ForegroundColor White
Write-Host "  ✓ specials/[slug] -> specials/[specialSlug]" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update these files to use the new parameter names:" -ForegroundColor Cyan
Write-Host "   - app/[slug]/categories/[categorySlug]/page.tsx (use params.categorySlug)" -ForegroundColor White
Write-Host "   - app/[slug]/combo/[comboSlug]/page.tsx (use params.comboSlug)" -ForegroundColor White
Write-Host "   - app/[slug]/products/[productSlug]/page.tsx (use params.productSlug)" -ForegroundColor White
Write-Host "   - app/[slug]/specials/[specialSlug]/page.tsx (use params.specialSlug)" -ForegroundColor White
Write-Host "2. Delete the empty app/[slug] folder if it still exists" -ForegroundColor Cyan
Write-Host "3. Run 'npm run dev' to test" -ForegroundColor Cyan
Write-Host ""