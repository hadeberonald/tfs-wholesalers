// app/[slug]/register/page.tsx (Next.js 14 Compatible)
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, User, Upload, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type RegistrationType = 'retail' | 'wholesale';

export default function RegisterPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  
  const [type, setType] = useState<RegistrationType>('retail');
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState<any>(null);
  const [fetchingBranch, setFetchingBranch] = useState(true);
  
  // Common fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Wholesale-specific fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<'tuckshop' | 'spaza' | 'retailer' | 'restaurant' | 'other'>('tuckshop');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  
  // Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  
  // Document upload
  const [taxCertificate, setTaxCertificate] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch branch on mount
  useEffect(() => {
    if (slug) {
      fetchBranch();
    }
  }, [slug]);

  const fetchBranch = async () => {
    try {
      setFetchingBranch(true);
      const res = await fetch(`/api/branches/${slug}`);
      
      if (!res.ok) {
        toast.error('Branch not found');
        router.push('/');
        return;
      }
      
      const data = await res.json();
      setBranch(data.branch);
    } catch (error) {
      console.error('Failed to fetch branch:', error);
      toast.error('Failed to load branch information');
      router.push('/');
    } finally {
      setFetchingBranch(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (type === 'wholesale') {
        if (!businessName || !contactPerson || !street || !city) {
          toast.error('Please fill in all required business details');
          setLoading(false);
          return;
        }
      }

      // Upload tax certificate if provided
      let taxCertificateUrl = '';
      if (taxCertificate && type === 'wholesale') {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', taxCertificate);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          taxCertificateUrl = uploadData.url;
        } else {
          toast.error('Failed to upload tax certificate');
        }
        setUploading(false);
      }

      // Register user
      const registerData: any = {
        name: type === 'wholesale' ? contactPerson : name,
        email,
        password,
        phone,
        role: 'customer',
      };

      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      if (!registerRes.ok) {
        const error = await registerRes.json();
        toast.error(error.error || 'Registration failed');
        setLoading(false);
        return;
      }

      const { user } = await registerRes.json();

      // If wholesale, create wholesale customer profile
      if (type === 'wholesale') {
        const wholesaleData = {
          userId: user.id,
          branchId: branch._id,
          businessName,
          businessType,
          registrationNumber,
          vatNumber,
          taxClearanceCertificate: taxCertificateUrl,
          contactPerson,
          email,
          phone,
          businessAddress: {
            street,
            city,
            province,
            postalCode,
          },
          verificationStatus: 'pending',
          currentBalance: 0,
          hasStandingOrders: false,
          active: false,
        };

        const wholesaleRes = await fetch('/api/wholesale/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wholesaleData),
        });

        if (!wholesaleRes.ok) {
          const error = await wholesaleRes.json();
          console.error('Failed to create wholesale profile:', error);
          toast.error('Registration completed but wholesale profile creation failed. Please contact support.');
          setLoading(false);
          return;
        }

        toast.success('Registration submitted! Your wholesale account will be reviewed within 24 hours.');
        router.push(`/${slug}/wholesale/pending`);
      } else {
        toast.success('Registration successful!');
        router.push(`/${slug}/account`);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingBranch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-black mb-2">Branch Not Found</h1>
          <p className="text-gray-600 mb-4">The branch you're looking for doesn't exist.</p>
          <Link href="/" className="text-brand-orange hover:text-orange-600 font-semibold">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 pt-32">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">Create Account</h1>
          <p className="text-gray-600">Join {branch.name || 'TFS Wholesalers'}</p>
        </div>

        {/* Account Type Selection */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-brand-black mb-4">Account Type</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('retail')}
              className={`p-4 rounded-xl border-2 transition-all ${
                type === 'retail'
                  ? 'border-brand-orange bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className={`w-8 h-8 mx-auto mb-2 ${type === 'retail' ? 'text-brand-orange' : 'text-gray-400'}`} />
              <p className="font-semibold text-brand-black">Retail Customer</p>
              <p className="text-xs text-gray-600 mt-1">Shop for personal use</p>
            </button>

            <button
              type="button"
              onClick={() => setType('wholesale')}
              className={`p-4 rounded-xl border-2 transition-all ${
                type === 'wholesale'
                  ? 'border-brand-orange bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 className={`w-8 h-8 mx-auto mb-2 ${type === 'wholesale' ? 'text-brand-orange' : 'text-gray-400'}`} />
              <p className="font-semibold text-brand-black">Wholesale Account</p>
              <p className="text-xs text-gray-600 mt-1">For businesses & retailers</p>
            </button>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
          {type === 'wholesale' ? (
            <>
              {/* Business Information */}
              <div>
                <h3 className="text-lg font-semibold text-brand-black mb-4">Business Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., Sunny's Tuckshop"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type *
                    </label>
                    <select
                      required
                      className="input-field"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value as any)}
                    >
                      <option value="tuckshop">Tuckshop</option>
                      <option value="spaza">Spaza Shop</option>
                      <option value="retailer">Retailer</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Registration Number
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VAT Number
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  {/* Tax Certificate Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax Clearance Certificate
                    </label>
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-orange transition-colors">
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <span className="text-sm text-gray-600">
                          {taxCertificate ? taxCertificate.name : 'Upload document (optional)'}
                        </span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setTaxCertificate(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <h3 className="text-lg font-semibold text-brand-black mb-4">Contact Person</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Contact person's name"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        className="input-field"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@business.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        className="input-field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0XX XXX XXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Address */}
              <div>
                <h3 className="text-lg font-semibold text-brand-black mb-4">Business Address</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Durban"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Province *
                      </label>
                      <select
                        required
                        className="input-field"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                      >
                        <option value="">Select province</option>
                        <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                        <option value="Gauteng">Gauteng</option>
                        <option value="Western Cape">Western Cape</option>
                        <option value="Eastern Cape">Eastern Cape</option>
                        <option value="Free State">Free State</option>
                        <option value="Limpopo">Limpopo</option>
                        <option value="Mpumalanga">Mpumalanga</option>
                        <option value="Northern Cape">Northern Cape</option>
                        <option value="North West">North West</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="4001"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Retail Customer Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      className="input-field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="input-field"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0XX XXX XXXX"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <h3 className="text-lg font-semibold text-brand-black mb-4">Security</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Wholesale Notice */}
          {type === 'wholesale' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Verification Required</p>
                  <p>Your wholesale account will be reviewed by our team within 24 hours. You'll receive an email once approved.</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || uploading ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{uploading ? 'Uploading...' : 'Creating Account...'}</span>
              </span>
            ) : (
              'Create Account'
            )}
          </button>

          {/* Login Link */}
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link 
              href={type === 'wholesale' ? `/${slug}/wholesale/login` : `/${slug}/login`} 
              className="text-brand-orange hover:text-orange-600 font-semibold"
            >
              Login here
            </Link>
          </p>
        </form>

        {/* Back to Store */}
        <div className="text-center mt-6">
          <Link 
            href={`/${slug}`} 
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to {branch.name || 'Store'}
          </Link>
        </div>
      </div>
    </div>
  );
}