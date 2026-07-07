'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

type PromoKey = 'retail_promo' | 'wholesale_promo' | 'daily_specials';

interface PromoDoc {
  key: PromoKey;
  fileUrl: string;
  filename: string;
  caption?: string;
  uploadedAt: string;
}

const SLOTS: { key: PromoKey; label: string; hint: string }[] = [
  {
    key: 'retail_promo',
    label: 'Retail Promotion',
    hint: 'Sent when a customer selects Promotions → Retail Promotion',
  },
  {
    key: 'wholesale_promo',
    label: 'Wholesale Promotion',
    hint: 'Sent when a customer selects Promotions → Wholesale Promotion',
  },
  {
    key: 'daily_specials',
    label: 'Daily Specials',
    hint: 'Sent when a customer selects Daily Specials from the main menu',
  },
];

export default function PromoFilesPage() {
  const [docs, setDocs] = useState<Record<string, PromoDoc>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<PromoKey | null>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/admin/promo-files');
      if (res.ok) {
        const data = await res.json();
        const byKey: Record<string, PromoDoc> = {};
        (data.documents || []).forEach((d: PromoDoc) => {
          byKey[d.key] = d;
        });
        setDocs(byKey);
      } else {
        toast.error('Failed to load promo files');
      }
    } catch {
      toast.error('Failed to load promo files');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: PromoKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // WhatsApp document messages accept PDFs, Word docs, and a few other
    // types — keep this simple and just gate on the common promo formats.
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG, or WebP files are allowed');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB');
      return;
    }

    setUploadingKey(key);
    try {
      // PDFs must go up as 'raw' on Cloudinary; images as 'image'.
      const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
      const fileUrl = await uploadToCloudinary(file, resourceType);

      const res = await fetch('/api/admin/promo-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          fileUrl,
          filename: file.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save file');
      }

      const data = await res.json();
      setDocs(prev => ({ ...prev, [key]: data.document }));
      toast.success('File uploaded — the bot will send this immediately');
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploadingKey(null);
      e.target.value = ''; // allow re-selecting the same file later
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">WhatsApp Promo Files</h1>
      <p className="text-gray-500 mb-6">
        Upload the files customers receive when they tap these options in the WhatsApp bot menu.
        Uploading a new file replaces the current one immediately — no redeploy needed.
      </p>

      <div className="space-y-4">
        {SLOTS.map(slot => {
          const doc = docs[slot.key];
          const isUploading = uploadingKey === slot.key;

          return (
            <div key={slot.key} className="border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="font-medium">{slot.label}</h2>
                <p className="text-sm text-gray-500 mb-2">{slot.hint}</p>

                {doc ? (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    {doc.filename}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-sm text-amber-600">No file uploaded yet — bot will send a fallback text message</span>
                )}
              </div>

              <label className="shrink-0 cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={isUploading}
                  onChange={e => handleUpload(e, slot.key)}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
