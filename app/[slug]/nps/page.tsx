'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle, ChevronRight, User, Phone, Mail,
  Star, Store, Users, ShoppingCart,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'overall' | 'store' | 'staff' | 'products' | 'contact' | 'done';

interface SurveyData {
  // Section 1 – Overall satisfaction
  overallSatisfaction: string;
  recommendLikelihood: string;
  oneImprovement: string;
  metExpectations: string;
  threeWords: string;
  // Section 2 – Store experience
  easyToFind: string;
  cleanliness: string;
  checkoutWait: string;
  // Section 3 – Staff
  greetedByStaff: string;
  staffFriendliness: string;
  staffRecommendation: string;
  staffRecommendationDetails: string;
  // Section 4 – Products
  foundAllItems: string;
  productQuality: string;
  promotionsDriven: string;
  newProductSuggestions: string;
}

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SATISFACTION_OPTIONS = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];
const LIKELIHOOD_OPTIONS   = ['Extremely Likely', 'Very Likely', 'Likely', 'Unlikely', 'Very Unlikely'];
const YES_NO               = ['Yes', 'No'];
const YES_NO_PARTIAL       = ['Yes', 'Partially', 'No'];
const RATING_5             = ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'];
const CHECKOUT_OPTIONS     = ['Very Short (< 2 min)', 'Acceptable (2–5 min)', 'Long (5–10 min)', 'Too Long (> 10 min)'];
const FINDABILITY_OPTIONS  = ['Very Easy', 'Easy', 'Somewhat Difficult', 'Difficult'];
const QUALITY_OPTIONS      = ['Excellent', 'Good', 'Average', 'Below Average', 'Poor'];

const SECTION_META = [
  { key: 'overall',  label: 'Overall',   icon: Star,          color: 'text-yellow-500', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  { key: 'store',    label: 'Store',     icon: Store,         color: 'text-blue-500',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  { key: 'staff',    label: 'Staff',     icon: Users,         color: 'text-purple-500', bg: 'bg-purple-50',  border: 'border-purple-200' },
  { key: 'products', label: 'Products',  icon: ShoppingCart,  color: 'text-green-500',  bg: 'bg-green-50',   border: 'border-green-200'  },
];

const STEPS: Step[] = ['overall', 'store', 'staff', 'products', 'contact'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass  = "w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition bg-gray-50 focus:bg-white";
const selectClass = `${inputClass} appearance-none cursor-pointer`;

function SectionHeader({ icon: Icon, label, color, bg, border, subtitle }: {
  icon: any; label: string; color: string; bg: string; border: string; subtitle: string;
}) {
  return (
    <div className={`flex items-center gap-3 mb-6 p-4 rounded-2xl ${bg} border ${border}`}>
      <div className={`p-2 rounded-xl bg-white shadow-sm`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="font-black text-gray-900 text-base" style={{ fontFamily: "'Sora', sans-serif" }}>{label}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, optional = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; optional?: boolean;
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
          <option value="">— Select an option —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-90" />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, optional = true, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; optional?: boolean; rows?: number;
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputClass} resize-none`}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NPSSurveyPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [step, setStep] = useState<Step>('overall');
  const [submitting, setSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const [data, setData] = useState<SurveyData>({
    overallSatisfaction: '',
    recommendLikelihood: '',
    oneImprovement: '',
    metExpectations: '',
    threeWords: '',
    easyToFind: '',
    cleanliness: '',
    checkoutWait: '',
    greetedByStaff: '',
    staffFriendliness: '',
    staffRecommendation: '',
    staffRecommendationDetails: '',
    foundAllItems: '',
    productQuality: '',
    promotionsDriven: '',
    newProductSuggestions: '',
  });

  const [contact, setContact] = useState<ContactInfo>({ name: '', phone: '', email: '' });

  const set = (key: keyof SurveyData) => (v: string) => setData(d => ({ ...d, [key]: v }));

  const currentIdx = STEPS.indexOf(step);

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned && !/^(\+27|0)[0-9]{9}$/.test(cleaned)) {
      setPhoneError('Please enter a valid SA phone number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const contactStarted = !!(contact.name || contact.phone || contact.email);
  const contactValid   = !contactStarted || (!!contact.name.trim() && !!contact.phone.trim() && !phoneError);

  const doSubmit = async (withContact: boolean) => {
    if (withContact && (!contactValid || !contact.phone || !validatePhone(contact.phone))) return;
    setSubmitting(true);
    try {
      await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchSlug: slug,
          source: 'in-store',
          submittedAt: new Date().toISOString(),
          overall: {
            satisfaction: data.overallSatisfaction,
            recommendLikelihood: data.recommendLikelihood,
            oneImprovement: data.oneImprovement.trim(),
            metExpectations: data.metExpectations,
            threeWords: data.threeWords.trim(),
          },
          store: {
            easyToFind: data.easyToFind,
            cleanliness: data.cleanliness,
            checkoutWait: data.checkoutWait,
          },
          staff: {
            greeted: data.greetedByStaff,
            friendliness: data.staffFriendliness,
            madeRecommendation: data.staffRecommendation,
            recommendationDetails: data.staffRecommendationDetails.trim(),
          },
          products: {
            foundAllItems: data.foundAllItems,
            quality: data.productQuality,
            promotionsDriven: data.promotionsDriven,
            newProductSuggestions: data.newProductSuggestions.trim(),
          },
          contact: withContact && contact.name
            ? { name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim() || null }
            : null,
        }),
      });
      setStep('done');
    } catch (err) {
      console.error('NPS submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const navBtn = (label: string, onClick: () => void, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      style={{
        background: !disabled ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#d1d5db',
        fontFamily: "'Sora', sans-serif",
        boxShadow: !disabled ? '0 8px 24px rgba(249,115,22,0.35)' : 'none',
      }}
    >
      {submitting ? <div className="w-6 h-6 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : <><span>{label}</span><ChevronRight className="w-5 h-5" /></>}
    </button>
  );

  const backBtn = (to: Step) => (
    <button onClick={() => setStep(to)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
      ← Back
    </button>
  );

  const cardHeader = (backTo?: Step) => (
    <div className="flex items-center justify-between mb-5">
      {backTo ? backBtn(backTo) : <div />}
      <div className="flex gap-1.5">
        {STEPS.slice(0, -1).map((s, i) => (
          <div key={s} className={`rounded-full transition-all duration-300 h-2 ${i <= currentIdx - (step === 'contact' ? 0 : 0) ? 'w-6 bg-brand-orange' : 'w-2 bg-gray-200'}`} />
        ))}
      </div>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>Thank you!</h1>
          <p className="text-gray-500 text-lg mb-2">Your feedback means a lot to us.</p>
          <p className="text-gray-400 text-sm">We use every response to improve your shopping experience.</p>
          <button
            onClick={() => { setStep('overall'); setData({ overallSatisfaction:'',recommendLikelihood:'',oneImprovement:'',metExpectations:'',threeWords:'',easyToFind:'',cleanliness:'',checkoutWait:'',greetedByStaff:'',staffFriendliness:'',staffRecommendation:'',staffRecommendationDetails:'',foundAllItems:'',productQuality:'',promotionsDriven:'',newProductSuggestions:'',}); setContact({name:'',phone:'',email:''}); }}
            className="mt-8 text-sm text-brand-orange underline underline-offset-4"
          >
            Submit another response
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          
            <h1 className="text-4xl font-black text-gray-900 leading-tight mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              How was your<br />visit today?
            </h1>
            <p className="text-gray-500">Your feedback helps us serve you better.</p>
          </div>

          {/* ── Section 1: Overall Satisfaction ── */}
          {step === 'overall' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {cardHeader()}
              <SectionHeader icon={Star} label="Overall Satisfaction" color="text-yellow-500" bg="bg-yellow-50" border="border-yellow-200" subtitle="Tell us about your visit today" />

              <SelectField label="How satisfied were you with your overall experience today?" value={data.overallSatisfaction} onChange={set('overallSatisfaction')} options={SATISFACTION_OPTIONS} />
              <SelectField label="How likely are you to recommend our store to friends and family?" value={data.recommendLikelihood} onChange={set('recommendLikelihood')} options={LIKELIHOOD_OPTIONS} />
              <SelectField label="Did our products and services meet your expectations?" value={data.metExpectations} onChange={set('metExpectations')} options={['Exceeded Expectations', 'Met Expectations', 'Partially Met', 'Did Not Meet Expectations']} />
              <TextField label="What is one thing we could do to improve your experience?" value={data.oneImprovement} onChange={set('oneImprovement')} placeholder="e.g. More parking, faster checkout, wider variety…" />
              <TextField label="How would you describe your experience in three words?" value={data.threeWords} onChange={set('threeWords')} placeholder="e.g. Friendly, organised, affordable…" rows={1} />

              {navBtn('Next — Store Experience', () => setStep('store'), !data.overallSatisfaction || !data.recommendLikelihood || !data.metExpectations)}
            </div>
          )}

          {/* ── Section 2: Store Experience ── */}
          {step === 'store' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {cardHeader('overall')}
              <SectionHeader icon={Store} label="Store Experience & Environment" color="text-blue-500" bg="bg-blue-50" border="border-blue-200" subtitle="Help us keep the store great" />

              <SelectField label="How easy was it to find what you were looking for?" value={data.easyToFind} onChange={set('easyToFind')} options={FINDABILITY_OPTIONS} />
              <SelectField label="How would you rate the cleanliness of our store?" value={data.cleanliness} onChange={set('cleanliness')} options={RATING_5} />
              <SelectField label="Were the checkout lines acceptable?" value={data.checkoutWait} onChange={set('checkoutWait')} options={CHECKOUT_OPTIONS} />

              {navBtn('Next — Staff & Service', () => setStep('staff'), !data.easyToFind || !data.cleanliness || !data.checkoutWait)}
            </div>
          )}

          {/* ── Section 3: Staff ── */}
          {step === 'staff' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {cardHeader('store')}
              <SectionHeader icon={Users} label="Staff Performance & Service" color="text-purple-500" bg="bg-purple-50" border="border-purple-200" subtitle="Our team wants to do better" />

              <SelectField label="Were you greeted by a staff member in-store?" value={data.greetedByStaff} onChange={set('greetedByStaff')} options={YES_NO} />
              <SelectField label="How would you rate the friendliness and knowledge of our staff?" value={data.staffFriendliness} onChange={set('staffFriendliness')} options={RATING_5} />
              <SelectField label="Did any staff member make a product recommendation to you?" value={data.staffRecommendation} onChange={set('staffRecommendation')} options={YES_NO} />
              {data.staffRecommendation === 'Yes' && (
                <TextField label="What product was recommended?" value={data.staffRecommendationDetails} onChange={set('staffRecommendationDetails')} placeholder="e.g. They suggested the bulk cooking oil deal…" optional />
              )}

              {navBtn('Next — Products & Purchases', () => setStep('products'), !data.greetedByStaff || !data.staffFriendliness || !data.staffRecommendation)}
            </div>
          )}

          {/* ── Section 4: Products ── */}
          {step === 'products' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {cardHeader('staff')}
              <SectionHeader icon={ShoppingCart} label="Products & Purchase Feedback" color="text-green-500" bg="bg-green-50" border="border-green-200" subtitle="Help us stock what you need" />

              <SelectField label="Did you find all the items you were looking for?" value={data.foundAllItems} onChange={set('foundAllItems')} options={YES_NO_PARTIAL} />
              <SelectField label="How would you rate the quality of our products?" value={data.productQuality} onChange={set('productQuality')} options={QUALITY_OPTIONS} />
              <SelectField label="Were you drawn in by any of our current promotions or specials?" value={data.promotionsDriven} onChange={set('promotionsDriven')} options={YES_NO} />
              <TextField label="What new products or features would you like to see in our store?" value={data.newProductSuggestions} onChange={set('newProductSuggestions')} placeholder="e.g. More organic options, a loyalty card, bulk cleaning supplies…" />

              {navBtn('Next — Your Details', () => setStep('contact'), !data.foundAllItems || !data.productQuality || !data.promotionsDriven)}
            </div>
          )}

          {/* ── Step 5: Contact ── */}
          {step === 'contact' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {cardHeader('products')}

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-brand-orange" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>Stay in touch</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Leave your details and we'll follow up on your feedback.{' '}
                  <span className="font-semibold text-gray-700">Completely optional.</span>
                </p>
              </div>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Full Name {contactStarted && <span className="text-brand-orange">*</span>}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input type="text" value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} placeholder="Your name" className={`${inputClass} pl-10`} />
                </div>
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Phone Number {contactStarted && <span className="text-brand-orange">*</span>}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="tel" value={contact.phone}
                    onChange={e => { setContact(c => ({ ...c, phone: e.target.value })); if (phoneError) validatePhone(e.target.value); }}
                    onBlur={e => e.target.value && validatePhone(e.target.value)}
                    placeholder="e.g. 072 123 4567"
                    className={`${inputClass} pl-10 ${phoneError ? 'border-red-300 ring-1 ring-red-300' : ''}`}
                  />
                </div>
                {phoneError && <p className="text-xs text-red-500 mt-1 ml-1">{phoneError}</p>}
              </div>

              {/* Email */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email Address <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="you@example.com" className={`${inputClass} pl-10`} />
                </div>
              </div>

              {/* Submit with contact */}
              <button
                onClick={() => doSubmit(true)}
                disabled={submitting || (contactStarted && !contactValid)}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}
              >
                {submitting ? <div className="w-6 h-6 border-2 border-white/60 border-t-white rounded-full animate-spin" /> : 'Submit Feedback'}
              </button>

              {/* Skip */}
              <button
                onClick={() => { setContact({ name: '', phone: '', email: '' }); doSubmit(false); }}
                disabled={submitting}
                className="w-full mt-3 py-3 rounded-2xl font-medium text-gray-400 text-sm hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                Skip &amp; submit anonymously
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">Your details are only used to follow up on your feedback.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}