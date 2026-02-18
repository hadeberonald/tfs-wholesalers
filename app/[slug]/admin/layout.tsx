import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { BranchProvider } from '@/lib/branch-context';

async function getBranch(slug: string) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    
    const branch = await db.collection('branches').findOne({
      slug,
      status: 'active'
    });

    if (!branch) {
      return null;
    }

    return {
      id: branch._id.toString(),
      name: branch.name,
      slug: branch.slug,
      displayName: branch.displayName,
      status: branch.status,
      settings: branch.settings
    };
  } catch (error) {
    console.error('Failed to fetch branch:', error);
    return null;
  }
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const branch = await getBranch(params.slug);

  if (!branch) {
    notFound();
  }

  return (
    <BranchProvider initialBranch={branch}>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </BranchProvider>
  );
}