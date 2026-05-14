import { notFound } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { BranchProvider } from '@/lib/branch-context';
import AdminHeader from '@/components/AdminHeader';

async function getBranch(slug: string) {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const branch = await db.collection('branches').findOne({ slug, status: 'active' });
    if (!branch) return null;
    return {
      id: branch._id.toString(),
      name: branch.name,
      slug: branch.slug,
      displayName: branch.displayName,
      status: branch.status,
      settings: branch.settings,
    };
  } catch { return null; }
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const branch = await getBranch(params.slug);
  if (!branch) notFound();

  return (
    <BranchProvider initialBranch={branch}>
      {/* AdminHeader is fixed — children need padding to clear it.
          The header is always 56px tall (top bar). The nav section adds
          ~88px when expanded. We use pt-36 (144px) which safely covers
          both states. AdminHeader itself does NOT render a spacer div. */}
      <AdminHeader />
      <div className="min-h-screen bg-gray-50 pt-36">
        {children}
      </div>
    </BranchProvider>
  );
}
