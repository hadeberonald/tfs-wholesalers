import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import FeaturedCategoriesCarousel from '@/components/FeaturedCategoriesCarousel';
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

  const [categories, specials, products] = await Promise.all([
    db.collection('categories')
      .find({ branchId: branch._id, active: true, featured: true })
      .limit(10)
      .toArray(),

    db.collection('specials')
      .find({ branchId: branch._id, active: true })
      .limit(10)
      .toArray(),

    db.collection('products')
      .find({ branchId: branch._id, active: true, featured: true })
      .limit(12)
      .toArray(),
  ]);

  return {
    branch: {
      id: branch._id.toString(),
      name: branch.name,
      slug: branch.slug,
      displayName: branch.displayName,
    },
    categories,
    specials,
    products,
  };
}

export default async function BranchHomePage({ params }: BranchHomePageProps) {
  const resolvedParams = await params;
  const data = await getBranchData(resolvedParams.slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="pt-20">
      {/* branchId scopes hero banners to this branch */}
      <HeroSection branchId={data.branch.id} />
      <SpecialsSection />
      <FeaturedCategoriesCarousel />
      <FeaturedProducts />
    </div>
  );
}