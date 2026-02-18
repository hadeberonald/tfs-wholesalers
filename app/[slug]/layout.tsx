import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { BranchProvider } from '@/lib/branch-context';

export const dynamic = 'force-dynamic';

interface BranchLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
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
      status: branch.status as 'active' | 'paused' | 'inactive',
      settings: branch.settings,
    };
  } catch (error) {
    console.error('Error fetching branch:', error);
    return null;
  }
}

export default async function BranchLayout({ children, params }: BranchLayoutProps) {
  const resolvedParams = await params;
  const branch = await getBranch(resolvedParams.slug);

  if (!branch) {
    notFound();
  }

  return (
    <BranchProvider initialBranch={branch}>
      {children}
    </BranchProvider>
  );
}
