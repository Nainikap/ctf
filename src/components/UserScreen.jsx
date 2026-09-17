import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  RotateCcw, 
  Award,
  BookOpen,
  Send,
  ArrowRight
} from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { 
  unlockQuestionsWithOTP, 
  getActiveSession, 
  submitAssessment, 
  markOTPExpired, 
  clearActiveSession 
} from '../services/otpService';

export default function UserScreen({ onRequestCoordinator }) {
  const [otpInput, setOtpInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const active = getActiveSession();
    if (active) {
      if (active.expiresAt && Date.now() >= active.expiresAt) {
        markOTPExpired(active.code);
        clearActiveSession();
        setIsExpired(true);
      } else {
        setSession(active);
        const savedAnswers = localStorage.getItem(`ctf_answers_${active.code}`);
        if (savedAnswers) {
          try {
            setAnswers(JSON.parse(savedAnswers));
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  }, []);

  const handleSelectOption = (questionId, option) => {
    if (isExpired || result) return;
    const nextAnswers = { ...answers, [questionId]: option };
    setAnswers(nextAnswers);
    if (session && session.code) {
      localStorage.setItem(`ctf_answers_${session.code}`, JSON.stringify(nextAnswers));
    }
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    setErrorMessage('');
    const code = otpInput.trim();
    if (!code) {
      setErrorMessage('Please enter the OTP or JWT token provided by the coordinator.');
      return;
    }

    const res = unlockQuestionsWithOTP(code);
    if (!res.success) {
      setErrorMessage(res.error);
      return;
    }

    setSession(res.data);
    setIsExpired(false);
    setResult(null);

    const savedAnswers = localStorage.getItem(`ctf_answers_${res.data.code}`);
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch (e) {
        console.error(e);
      }
    } else {
      setAnswers({});
    }
  };

  const handleExpire = () => {
    if (session && !result) {
      markOTPExpired(session.code);
      const subRes = submitAssessment(session.code, answers);
      setIsExpired(true);
      if (subRes.success) {
        setResult(subRes);
      }
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    if (session) {
      const subRes = submitAssessment(session.code, answers);
      if (subRes.success) {
        setResult(subRes);
      }
    }
    setIsSubmitting(false);
  };

  const handleBackToEntry = () => {
    clearActiveSession();
    setSession(null);
    setResult(null);
    setIsExpired(false);
    setAnswers({});
    setOtpInput('');
    setErrorMessage('');
  };

  // -------------------------------------------------------------
  // VIEW 1: ASSESSMENT RESULTS / EXPIRED VIEW
  // -------------------------------------------------------------
  if (result || isExpired) {
    const questions = session?.questions || result?.questions || [];
    const score = result?.score;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Results Banner (Solid Box) */}
        <div className={`p-6 rounded-lg border-2 mb-6 shadow-sm ${
          isExpired 
            ? 'bg-red-50 border-red-500 text-red-950' 
            : 'bg-white border-yellow-400 text-gray-900'
        }`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold ${
                isExpired ? 'bg-red-600 text-white' : 'bg-yellow-400 text-black'
              }`}>
                {isExpired ? (
                  <Clock className="w-7 h-7" />
                ) : (
                  <Award className="w-7 h-7" />
                )}
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-gray-600">
                  {isExpired ? 'Status: Expired' : 'Assessment Completed'}
                </span>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isExpired ? "Time's Up! 20-Minute Window Ended" : 'Test Submitted'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Candidate: <strong>{session?.candidate || 'Participant'}</strong> | OTP: <span className="font-mono font-bold text-red-700">{session?.code}</span>
                </p>
              </div>
            </div>

            {score && (
              <div className="text-center px-6 py-3 rounded-lg bg-gray-50 border-2 border-gray-300 min-w-[140px]">
                <div className="text-xs text-gray-500 uppercase font-bold">Score</div>
                <div className="text-3xl font-extrabold font-mono text-red-600">
                  {score.correct} / {score.total}
                </div>
                <div className="text-xs text-gray-600 font-bold">
                  {score.percentage}%
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
            <span>
              <strong>Notice:</strong> This OTP is permanently expired and cannot be reused to retrieve questions.
            </span>
            <button
              onClick={handleBackToEntry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-white hover:bg-gray-100 text-gray-800 font-bold border border-gray-300 shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-red-600" />
              Return to Entry
            </button>
          </div>
        </div>

        {/* Detailed Questions Review */}
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-red-600" />
          Review Questions & Answers
        </h3>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const userChoice = answers[q.id];
            const isAnswered = !!userChoice;
            const userLetter = userChoice ? userChoice.charAt(0).toUpperCase() : '';
            const correctLetter = q.answer ? q.answer.charAt(0).toUpperCase() : '';
            const isCorrect = isAnswered && userLetter === correctLetter;

            return (
              <div 
                key={q.id || idx}
                className={`p-5 rounded-lg border-2 bg-white ${
                  isCorrect
                    ? 'border-green-400'
                    : isAnswered
                    ? 'border-red-400'
                    : 'border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-700">
                      Q{idx + 1}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                      q.difficulty === 'easy'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : q.difficulty === 'medium'
                        ? 'bg-yellow-200 text-yellow-900 border border-yellow-400'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {q.difficulty}
                    </span>
                    {q.category && (
                      <span className="text-xs text-gray-500 font-medium">
                        • {q.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 className="w-4 h-4" /> Correct
                      </span>
                    ) : isAnswered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                        <AlertCircle className="w-4 h-4" /> Incorrect
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-gray-500">
                        Unanswered
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-gray-900 font-semibold text-base mb-3">
                  {q.question}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => {
                    const optLetter = opt.charAt(0).toUpperCase();
                    const isSelected = userLetter === optLetter;
                    const isTheCorrectOpt = correctLetter === optLetter;

                    let optStyle = 'bg-white border border-gray-300 text-gray-700';
                    if (isTheCorrectOpt) {
                      optStyle = 'bg-green-50 border-2 border-green-500 text-green-950 font-bold';
                    } else if (isSelected && !isTheCorrectOpt) {
                      optStyle = 'bg-red-50 border-2 border-red-400 text-red-900 font-medium line-through';
                    }

                    return (
                      <div
                        key={oIdx}
                        className={`p-2.5 rounded border text-sm flex items-start gap-2 ${optStyle}`}
                      >
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-gray-200">
                          {optLetter}
                        </span>
                        <span className="flex-1">{opt.substring(opt.indexOf('.') + 1).trim()}</span>
                        {isTheCorrectOpt && (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Correct: <strong className="text-green-700 font-bold">{q.answer}</strong>
                  </span>
                  {userChoice && (
                    <span>
                      Your choice: <strong className={isCorrect ? 'text-green-700' : 'text-red-700'}>{userChoice}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE QUESTIONS VIEW (UNLOCKED WITH OTP)
  // -------------------------------------------------------------
  if (session && session.questions) {
    const questions = session.questions;
    const answeredCount = Object.keys(answers).length;
    const totalCount = questions.length;

    return (
      <div className="min-h-[calc(100vh-80px)] pb-16">
        {/* Sticky Header (Solid White Box with Gray Border) */}
        <header className="sticky top-0 z-30 bg-white border-b-2 border-gray-300 shadow-sm px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-red-600 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-gray-600">Candidate Session</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300">
                    OTP: {session.code}
                  </span>
                </div>
                <h1 className="text-base font-bold text-gray-900">
                  {session.candidate || 'Participant'}
                </h1>
              </div>
            </div>

            {/* Countdown Timer */}
            <CountdownTimer 
              expiresAt={session.expiresAt} 
              startedAt={session.startedAt} 
              onExpire={handleExpire} 
            />

            {/* Submit Button */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs text-gray-500 font-semibold">Answered</div>
                <div className="font-mono text-sm font-bold text-gray-900">
                  <span className="text-red-600 font-extrabold">{answeredCount}</span> / {totalCount}
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow"
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            </div>
          </div>
        </header>

        {/* Question Cards List */}
        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-5">
          <div className="p-3.5 rounded bg-yellow-50 border border-yellow-300 text-xs text-yellow-900 flex items-center justify-between">
            <span>
              <strong>5 Questions Unlocked:</strong> 2 Easy, 2 Medium, 1 Hard.
            </span>
            <span className="font-bold">
              Time limit: 20 Minutes
            </span>
          </div>

          {questions.map((q, idx) => {
            const selectedOption = answers[q.id];

            return (
              <article 
                key={q.id || idx}
                className="bg-white border-2 border-gray-300 rounded-lg p-6 shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gray-100 border border-gray-300 text-gray-800 font-mono font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-gray-800">
                      Question {idx + 1} of 5
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded uppercase ${
                      q.difficulty === 'easy'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : q.difficulty === 'medium'
                        ? 'bg-yellow-200 text-yellow-900 border border-yellow-400'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {q.difficulty}
                    </span>
                    {q.category && (
                      <span className="text-xs text-gray-500 font-medium">
                        {q.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <p className="text-gray-900 text-base font-semibold leading-relaxed mb-4">
                  {q.question}
                </p>

                {/* Radio Options */}
                <div className="space-y-2.5">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = selectedOption === opt;
                    const optLetter = opt.charAt(0).toUpperCase();
                    const optText = opt.substring(opt.indexOf('.') + 1).trim();

                    return (
                      <label
                        key={oIdx}
                        onClick={() => handleSelectOption(q.id, opt)}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-red-50 border-red-600 text-red-950 font-semibold'
                            : 'bg-white border-gray-200 hover:border-gray-400 text-gray-800'
                        }`}
                      >
                        {/* Radio Check Circle */}
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-red-600 bg-red-600'
                            : 'border-gray-400 bg-white'
                        }`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </div>

                        {/* Letter Badge */}
                        <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-red-200 text-red-900'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {optLetter}
                        </span>

                        {/* Text */}
                        <span className="text-sm leading-relaxed flex-1">
                          {optText}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </article>
            );
          })}

          {/* Bottom Submit Box */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4 shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-600 font-semibold">Answered:</span>
              <div className="font-mono text-sm font-bold text-gray-900">
                <span className="text-red-600">{answeredCount}</span> of {totalCount} completed
              </div>
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow"
            >
              <Send className="w-4 h-4" />
              Finish & Submit Test
            </button>
          </div>
        </main>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70">
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6 max-w-md w-full shadow-xl">
              <div className="w-12 h-12 rounded bg-yellow-100 border border-yellow-300 text-yellow-800 flex items-center justify-center mb-3">
                <HelpCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Submit Assessment?</h3>
              <p className="text-gray-700 text-sm mb-4">
                {answeredCount < totalCount ? (
                  <span className="text-red-700 font-medium">
                    You have answered {answeredCount} of {totalCount} questions. Unanswered questions will receive 0 points.
                  </span>
                ) : (
                  <span>
                    You have answered all {totalCount} questions. Once submitted, your OTP is permanently completed and cannot be reopened.
                  </span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm border border-gray-300"
                >
                  Continue Answering
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow"
                >
                  {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: OTP INPUT GATE SCREEN (Initial User Screen)
  // -------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Solid White Card */}
        <div className="bg-white border-2 border-gray-300 rounded-lg p-8 shadow-sm">
          
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-3">
              <KeyRound className="w-7 h-7" />
            </div>
            <span className="text-xs uppercase font-bold text-red-700 tracking-wider">
              Participant Gate
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              Enter Assessment OTP
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Enter the unique OTP or JWT token provided by your coordinator to unlock your 5 questions.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded bg-red-50 border-2 border-red-400 text-red-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Access Denied</strong>
                {errorMessage}
              </div>
            </div>
          )}

          {/* OTP Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Coordinator OTP / Token
              </label>
              <input
                id="otp"
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="e.g. 583921"
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-red-600 text-gray-900 placeholder-gray-400 text-center font-mono text-xl font-bold tracking-widest outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow flex items-center justify-center gap-2"
            >
              <span>Unlock 5 Questions</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Rules Summary (Solid Box) */}
          <div className="mt-6 pt-5 border-t border-gray-200 space-y-2 text-xs text-gray-700">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Clock className="w-4 h-4 text-red-600 shrink-0" />
              <span>20-Minute Timer starts immediately upon entering OTP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></span>
              <span>Unlocks 5 Random Questions: 2 Easy, 2 Medium, 1 Hard</span>
            </div>
            <div className="flex items-center gap-2 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
              <span>Expired OTPs cannot be reused to retrieve questions</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 mt-4">
          Need an OTP? Contact your assessment coordinator.
        </div>
      </div>
    </div>
  );
}
