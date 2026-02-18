# Multi-Tenant Migration Script
# This script migrates your single-tenant app to multi-tenant structure
# Run from project root: .\migrate-complete-fixed.ps1

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   TFS Wholesalers - Multi-Tenant Migration  " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "app")) {
    Write-Host "Error: 'app' directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from your project root." -ForegroundColor Yellow
    exit 1
}

Write-Host "Current directory: $PWD" -ForegroundColor Gray
Write-Host ""

# Ask for confirmation
Write-Host "WARNING: This script will:" -ForegroundColor Yellow
Write-Host "  1. Create a backup of your app directory" -ForegroundColor White
Write-Host "  2. Move customer-facing pages to app\[branch]\" -ForegroundColor White
Write-Host "  3. Restructure shop routes" -ForegroundColor White
Write-Host ""
$confirmation = Read-Host "Do you want to continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Migration cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Starting migration..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Create backup
Write-Host "Step 1: Creating backup..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "app_backup_$timestamp"

try {
    Copy-Item -Path "app" -Destination $backupPath -Recurse -Force
    Write-Host "SUCCESS: Backup created at $backupPath" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create backup: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create [branch] directory
Write-Host "Step 2: Creating [branch] directory..." -ForegroundColor Yellow

if (-not (Test-Path "app\[branch]")) {
    New-Item -ItemType Directory -Path "app\[branch]" | Out-Null
    Write-Host "SUCCESS: Created app\[branch]" -ForegroundColor Green
} else {
    Write-Host "INFO: app\[branch] already exists" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Move customer-facing pages
Write-Host "Step 3: Moving customer pages to [branch]..." -ForegroundColor Yellow
Write-Host ""

$foldersToMove = @(
    "account",
    "cart", 
    "categories",
    "checkout",
    "combos",
    "payment",
    "search",
    "shop",
    "specials"
)

$moveCount = 0
foreach ($folder in $foldersToMove) {
    $source = "app\$folder"
    $destination = "app\[branch]\$folder"
    
    if (Test-Path $source) {
        if (Test-Path $destination) {
            Write-Host "  WARNING: $folder already exists in [branch], skipping..." -ForegroundColor Yellow
        } else {
            try {
                Move-Item -Path $source -Destination $destination -Force
                Write-Host "  SUCCESS: Moved $folder to [branch]\$folder" -ForegroundColor Green
                $moveCount++
            } catch {
                Write-Host "  ERROR: Failed to move $folder : $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  INFO: $folder not found, skipping..." -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Moved $moveCount folder(s)" -ForegroundColor Cyan
Write-Host ""

# Step 4: Restructure shop routes
Write-Host "Step 4: Restructuring shop routes..." -ForegroundColor Yellow
Write-Host ""

# Check if shop has [slug] subfolder
if (Test-Path "app\[branch]\shop\[slug]") {
    Write-Host "  Found shop\[slug] - moving to products\[slug]..." -ForegroundColor White
    
    # Create products folder
    if (-not (Test-Path "app\[branch]\products")) {
        New-Item -ItemType Directory -Path "app\[branch]\products" | Out-Null
        Write-Host "  SUCCESS: Created [branch]\products" -ForegroundColor Green
    }
    
    # Move [slug] from shop to products
    try {
        Move-Item -Path "app\[branch]\shop\[slug]" -Destination "app\[branch]\products\[slug]" -Force
        Write-Host "  SUCCESS: Moved shop\[slug] to products\[slug]" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Failed to move shop\[slug]: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  INFO: No [slug] folder found in shop" -ForegroundColor Gray
}

Write-Host ""

# Step 5: Create necessary files
Write-Host "Step 5: Creating required files..." -ForegroundColor Yellow
Write-Host ""

# Create [branch]/layout.tsx
$branchLayoutPath = "app\[branch]\layout.tsx"
if (-not (Test-Path $branchLayoutPath)) {
    # Using here-string with proper escaping
    @'
import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { BranchProvider } from '@/contexts/BranchContext';

export const dynamic = 'force-dynamic';

interface BranchLayoutProps {
  children: React.ReactNode;
  params: Promise<{ branch: string }>;
}

async function getBranch(slug: string) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({ 
      slug,
      status: 'active' 
    });

    if (!branch) return null;

    return {
      id: branch._id.toString(),
      name: branch.name,
      slug: branch.slug,
      displayName: branch.displayName,
      status: branch.status,
      settings: branch.settings,
    };
  } catch (error) {
    console.error('Error fetching branch:', error);
    return null;
  }
}

export default async function BranchLayout({ children, params }: BranchLayoutProps) {
  const resolvedParams = await params;
  const branch = await getBranch(resolvedParams.branch);

  if (!branch) {
    notFound();
  }

  return (
    <BranchProvider initialBranch={branch}>
      {children}
    </BranchProvider>
  );
}
'@ | Out-File -FilePath $branchLayoutPath -Encoding UTF8
    
    Write-Host "  SUCCESS: Created [branch]\layout.tsx" -ForegroundColor Green
} else {
    Write-Host "  INFO: [branch]\layout.tsx already exists" -ForegroundColor Gray
}

# Create [branch]/page.tsx
$branchPagePath = "app\[branch]\page.tsx"
if (-not (Test-Path $branchPagePath)) {
    @'
import FeaturedCategoriesCarousel from '@/components/FeaturedCategoriesCarousel';
import SpecialsSection from '@/components/home/SpecialsSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';

export default function BranchHomePage() {
  return (
    <div className="pt-20">
      <FeaturedCategoriesCarousel />
      <SpecialsSection />
      <FeaturedProducts />
    </div>
  );
}
'@ | Out-File -FilePath $branchPagePath -Encoding UTF8
    
    Write-Host "  SUCCESS: Created [branch]\page.tsx" -ForegroundColor Green
} else {
    Write-Host "  INFO: [branch]\page.tsx already exists" -ForegroundColor Gray
}

Write-Host ""

# Step 6: Verify structure
Write-Host "Step 6: Verifying new structure..." -ForegroundColor Yellow
Write-Host ""

$expectedFolders = @(
    "app\[branch]\layout.tsx",
    "app\[branch]\page.tsx",
    "app\[branch]\shop",
    "app\[branch]\cart",
    "app\[branch]\checkout"
)

$allGood = $true
foreach ($item in $expectedFolders) {
    if (Test-Path $item) {
        Write-Host "  OK: $item" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $item" -ForegroundColor Yellow
        $allGood = $false
    }
}

Write-Host ""

# Final summary
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Migration Complete!                       " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Backup: $backupPath" -ForegroundColor White
Write-Host "  Moved: $moveCount customer pages" -ForegroundColor White
Write-Host ""

Write-Host "Your new structure:" -ForegroundColor Yellow
Write-Host "  app/" -ForegroundColor Gray
Write-Host "  +-- api/              (stays at root)" -ForegroundColor Gray
Write-Host "  +-- login/            (stays at root)" -ForegroundColor Gray
Write-Host "  +-- super-admin/      (stays at root)" -ForegroundColor Gray
Write-Host "  +-- select-branch/    (stays at root)" -ForegroundColor Gray
Write-Host "  +-- [branch]/         (customer pages)" -ForegroundColor Green
Write-Host "      +-- layout.tsx" -ForegroundColor Green
Write-Host "      +-- page.tsx" -ForegroundColor Green
Write-Host "      +-- shop/" -ForegroundColor Green
Write-Host "      +-- cart/" -ForegroundColor Green
Write-Host "      +-- products/" -ForegroundColor Green
Write-Host "          +-- [slug]/" -ForegroundColor Green
Write-Host ""

Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Run database migration:" -ForegroundColor White
Write-Host "   npx tsx scripts/add-branch-ids.ts" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Update your components to use useBranch() hook" -ForegroundColor White
Write-Host ""
Write-Host "3. Update navigation links to include branch slug" -ForegroundColor White
Write-Host ""
Write-Host "4. Test URLs:" -ForegroundColor White
Write-Host "   http://localhost:3000/vryheid" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/vryheid/shop" -ForegroundColor Cyan
Write-Host ""

Write-Host "Backup location: $PWD\$backupPath" -ForegroundColor Gray
Write-Host ""