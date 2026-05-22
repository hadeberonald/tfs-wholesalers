import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import FeaturedCategoriesCarousel from '@/components/FeaturedCategoriesCarousel';
import FeaturedCategoriesWithProducts from '@/components/home/FeaturedCategoriesWithProducts';
import SpecialsSection from '@/components/home/SpecialsSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import HeroSection from '@/components/home/HeroSection';

export const dynamic = 'force-dynamic';

interface BranchHomePageProps {
  params: Promise<{ slug: string }>;
}

async function getBranchData(branchSlug: string) {
  const client = await clientPromise;
  const db = client.db('tfs-wholesalers');

  const branch = await db.collection('branches').findOne({
    slug: branchSlug,
    status: 'active',
  });

  if (!branch) return null;

  return {
    branch: {
      id: branch._id.toString(),
      name: branch.name,
      slug: branch.slug,
      displayName: branch.displayName,
    },
  };
}

export default async function BranchHomePage({ params }: BranchHomePageProps) {
  const resolvedParams = await params;
  const data = await getBranchData(resolvedParams.slug);

  if (!data) notFound();

  return (
    <div>
      {/* Hero banner */}
      <HeroSection branchId={data.branch.id} />
      {/* Specials / deals row */}
      <SpecialsSection />
      {/* Featured category carousel + listed categories strip */}
      <FeaturedCategoriesCarousel />
      {/* Per-category product rows (4 products each, View All button) */}
      <FeaturedCategoriesWithProducts />
      {/* Featured products section */}
      <FeaturedProducts />
    </div>
  );
}