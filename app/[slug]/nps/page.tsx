'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, MessageSquare, CheckCircle, ChevronRight } from 'lucide-react';

const SCORE_LABELS: Record<number, string> = {
  0: 'Terrible',
  1: 'Very Bad',
  2: 'Bad',
  3: 'Poor',
  4: 'Below Average',
  5: 'Average',
  6: 'Okay',
  7: 'Good',
  8: 'Very Good',
  9: 'Great',
  10: 'Outstanding!',
};

const QUICK_TAGS = [
  'Friendly staff',
  'Fast service',
  'Great prices',
  'Good stock',
  'Clean store',
  'Easy to find items',
  'Long wait time',
  'Out of stock',
  'Unhelpful staff',
  'Hard to navigate',
];

export default function NPSSurveyPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [step, setStep] = useState<'score' | 'feedback' | 'done'>('score');
  const [score, setScore] = useState<number | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayScore = hoveredScore ?? score;

  const getScoreColor = (s: number | null) => {
    if (s === null) return 'text-gray-400';
    if (s <= 6) return 'text-red-500';
    if (s <= 8) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreBg = (s: number) => {
    if (score === s) {
      if (s <= 6) return 'bg-red-500 text-white border-red-500 scale-110 shadow-lg shadow-red-200';
      if (s <= 8) return 'bg-yellow-400 text-white border-yellow-400 scale-110 shadow-lg shadow-yellow-200';
      return 'bg-green-500 text-white border-green-500 scale-110 shadow-lg shadow-green-200';
    }
    if (hoveredScore === s) {
      if (s <= 6) return 'bg-red-50 border-red-300 text-red-600 scale-105';
      if (s <= 8) return 'bg-yellow-50 border-yellow-300 text-yellow-600 scale-105';
      return 'bg-green-50 border-green-300 text-green-600 scale-105';
    }
    return 'bg-white border-gray-200 text-gray-700 hover:border-gray-400';
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchSlug: slug,
          score,
          tags: selectedTags,
          comment: comment.trim(),
          submittedAt: new Date().toISOString(),
          source: 'in-store',
        }),
      });
      setStep('done');
    } catch (err) {
      console.error('Failed to submit NPS:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-once">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
            Thank you!
          </h1>
          <p className="text-gray-500 text-lg mb-2">Your feedback means a lot to us.</p>
          <p className="text-gray-400 text-sm">We use every response to improve your shopping experience.</p>
          <button
            onClick={() => { setStep('score'); setScore(null); setSelectedTags([]); setComment(''); }}
            className="mt-8 text-sm text-brand-orange underline underline-offset-4"
          >
            Submit another response
          </button>
        </div>
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </div>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-10">
           
            <h1 className="text-4xl font-black text-gray-900 leading-tight mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              How was your<br />visit today?
            </h1>
            <p className="text-gray-500">Your feedback helps us serve you better.</p>
          </div>

          {step === 'score' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">
                How likely are you to recommend us to a friend?
              </p>

              {/* Score display */}
              <div className="text-center mb-6 h-10">
                {displayScore !== null && (
                  <div className={`text-2xl font-black transition-all duration-150 ${getScoreColor(displayScore)}`} style={{ fontFamily: "'Sora', sans-serif" }}>
                    {displayScore} — {SCORE_LABELS[displayScore]}
                  </div>
                )}
              </div>

              {/* Score buttons */}
              <div className="grid grid-cols-11 gap-1 mb-4">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => { setScore(i); }}
                    onMouseEnter={() => setHoveredScore(i)}
                    onMouseLeave={() => setHoveredScore(null)}
                    className={`aspect-square rounded-xl text-sm font-bold border-2 transition-all duration-150 ${getScoreBg(i)}`}
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {i}
                  </button>
                ))}
              </div>

              <div className="flex justify-between text-xs text-gray-400 mb-8 px-1">
                <span>Not at all likely</span>
                <span>Extremely likely</span>
              </div>

              <button
                onClick={() => score !== null && setStep('feedback')}
                disabled={score === null}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: score !== null ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#d1d5db',
                  fontFamily: "'Sora', sans-serif",
                  boxShadow: score !== null ? '0 8px 24px rgba(249,115,22,0.35)' : 'none',
                }}
              >
                <span>Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 'feedback' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 p-8 border border-orange-100">
              {/* Score recap pill */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setStep('score')}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Change score
                </button>
                <div className={`font-black text-lg px-4 py-1 rounded-full ${
                  score! <= 6 ? 'bg-red-100 text-red-600' :
                  score! <= 8 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`} style={{ fontFamily: "'Sora', sans-serif" }}>
                  Score: {score}
                </div>
              </div>

              {/* Quick tags */}
              <p className="text-sm font-semibold text-gray-600 mb-3">What stood out? <span className="text-gray-400 font-normal">(optional)</span></p>
              <div className="flex flex-wrap gap-2 mb-6">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                      selectedTags.includes(tag)
                        ? 'bg-brand-orange text-white border-brand-orange shadow-md shadow-orange-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Comment */}
              <p className="text-sm font-semibold text-gray-600 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1 text-brand-orange" />
                Anything else to share? <span className="text-gray-400 font-normal">(optional)</span>
              </p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Tell us about your experience today…"
                rows={3}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
              />

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full mt-4 py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  fontFamily: "'Sora', sans-serif",
                  boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
                }}
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Submit Feedback</span>
                )}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">Anonymous · Takes less than a minute</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}