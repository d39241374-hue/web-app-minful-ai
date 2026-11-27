import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import chibiManagerImg from '../assets/images/chibi_tree_manager_1795700337468.jpg';
import { getTodayDateStr, hasCrisisSignal } from '../constants';
import {
  fetchDeepWorkReflectionQuestions,
  submitDeepWorkReflectionFeedback,
  type DeepWorkReflectionFeedback,
  type DeepWorkReflectionPrompt,
} from '../services/aiService';
import type { DeepWorkSessionSummary, JournalEntry, UserProfile } from '../types';

interface DeepWorkReflectionModalProps {
  open: boolean;
  user: UserProfile;
  session: DeepWorkSessionSummary | null;
  onClose: () => void;
  onSaveReflection: (
    sessionId: string,
    journalEntry: Omit<JournalEntry, 'id' | 'uid'>,
  ) => Promise<void>;
  onOpenJournal: () => void;
  onTriggerCrisis: () => void;
}

const SOUND_LABELS: Record<DeepWorkSessionSummary['soundMode'], string> = {
  none: 'Im lặng',
  alpha: 'Alpha 10Hz',
  beta: 'Beta 18Hz',
  theta: 'Theta 6Hz',
  rain: 'Mưa rừng',
};

const MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.88,
};

export function DeepWorkReflectionModal({
  open,
  user,
  session,
  onClose,
  onSaveReflection,
  onOpenJournal,
  onTriggerCrisis,
}: DeepWorkReflectionModalProps) {
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptError, setPromptError] = useState('');
  const [promptData, setPromptData] = useState<DeepWorkReflectionPrompt | null>(null);

  const [focusScore, setFocusScore] = useState(4);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [feedback, setFeedback] = useState<DeepWorkReflectionFeedback | null>(null);

  const loadedSessionIdRef = useRef<string>('');
  const savedSessionIdsRef = useRef<Set<string>>(new Set());

  const loadQuestions = async (targetSession: DeepWorkSessionSummary) => {
    setLoadingPrompt(true);
    setPromptError('');
    try {
      const res = await fetchDeepWorkReflectionQuestions({
        session: targetSession,
        fullname: user.fullname,
        treeName: user.treeName,
      });
      setPromptData(res);
      loadedSessionIdRef.current = targetSession.id;
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Không thể kết nối Gemini AI.');
    } finally {
      setLoadingPrompt(false);
    }
  };

  useEffect(() => {
    if (!open || !session) return;
    if (loadedSessionIdRef.current !== session.id) {
      setPromptData(null);
      setPromptError('');
      setSubmitError('');
      setFeedback(null);
      setFocusScore(session.interruptionCount === 0 ? 5 : 4);
      setAnswers(['', '', '']);
      void loadQuestions(session);
    }
  }, [open, session?.id]);

  const handleSelectChip = (qIndex: number, chip: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      const current = (next[qIndex] || '').trim();
      if (!current) {
        next[qIndex] = chip;
      } else if (current.toLowerCase().includes(chip.toLowerCase())) {
        return prev;
      } else {
        next[qIndex] = `${current}. ${chip}`;
      }
      return next;
    });
  };

  const handleAnswerChange = (qIndex: number, val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = val;
      return next;
    });
  };

  const allAnswered =
    Boolean(promptData) &&
    promptData!.questions.length >= 3 &&
    [0, 1, 2].every((idx) => (answers[idx] || '').trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !promptData || !allAnswered || submitting) return;

    const combinedText = answers.join(' ');
    if (hasCrisisSignal(combinedText)) {
      onTriggerCrisis();
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const qaPayload = promptData.questions.slice(0, 3).map((q, idx) => ({
        question: q.question,
        answer: (answers[idx] || '').trim(),
      }));

      const aiFeedback = await submitDeepWorkReflectionFeedback({
        session,
        focusScore,
        answers: qaPayload,
      });

      setFeedback(aiFeedback);

      if (!savedSessionIdsRef.current.has(session.id)) {
        const d = new Date();
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const dateLabel = `${getTodayDateStr().slice(5)} ${timeStr} · Phản chiếu`.slice(0, 40);
        const lessonText = `Q1: ${qaPayload[0]?.answer || ''}\nQ2 (CDS-HS): ${qaPayload[1]?.answer || ''}`.slice(
          0,
          600,
        );

        await onSaveReflection(session.id, {
          dateLabel,
          mood: `Phản chiếu Deep Work (${focusScore}/5 tập trung)`.slice(0, 80),
          screenTime: `Gián đoạn phiên: ${session.interruptionCount} lần (${session.awaySecs}s)`.slice(0, 80),
          deepWorkNote: `${session.durationMins}p · ${session.intention}`.slice(0, 120),
          distractionLesson: lessonText,
          gratitude: (qaPayload[2]?.answer || 'Hoàn thành phiên tập trung sâu.').slice(0, 400),
          tomorrowPlan: aiFeedback.nextMicroHabit.slice(0, 400),
          cdsNote: (session.lastCdsScore != null
            ? `${session.lastCdsScore.toFixed(2)} / 5.0`
            : 'Tự phản chiếu'
          ).slice(0, 40),
          aiCognitiveTrap: aiFeedback.cognitiveTrap.slice(0, 160),
          aiInsight: aiFeedback.cdsInsight.slice(0, 800),
          aiNextStep: aiFeedback.nextMicroHabit.slice(0, 400),
        });
        savedSessionIdsRef.current.add(session.id);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không thể phân tích tự phản chiếu.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySaved = session ? savedSessionIdsRef.current.has(session.id) : false;

  return (
    <AnimatePresence>
      {open && session && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={onClose}
          className="fixed inset-0 z-[75] bg-slate-950/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={MODAL_SPRING}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tự phản chiếu sau phiên Deep Work"
            className="glass-card-solid led-frame relative overflow-hidden max-w-3xl w-full rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 pb-[calc(1.1rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl space-y-3.5 max-h-[92dvh] flex flex-col"
          >
            <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={chibiManagerImg}
                  alt="Linh Mộc Quản Gia"
                  className="w-11 h-11 rounded-2xl object-cover object-top ring-2 ring-emerald-400/60 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    <span>Tự phản chiếu CDS-HS · Gemini AI</span>
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                    Nhìn lại phiên Deep Work {session.durationMins} phút
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Telemetry Strip (Zero-Pill Clean Data Line) */}
            <div className="px-3.5 py-2 rounded-2xl bg-slate-100/85 dark:bg-slate-800/65 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700 dark:text-slate-200 min-w-0">
                <span className="inline-flex items-center gap-1 font-mono-num font-bold text-emerald-700 dark:text-emerald-400">
                  <Clock className="w-3.5 h-3.5" />
                  {session.durationMins}p
                </span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="truncate max-w-[260px]" title={session.intention}>
                  Mục tiêu: <strong className="text-slate-900 dark:text-white">{session.intention}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span>{SOUND_LABELS[session.soundMode]}</span>
                {session.isGroupSession && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                      Học nhóm ({session.groupSize || 2})
                    </span>
                  </>
                )}
              </div>
              <div className="font-mono-num font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                {session.interruptionCount === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">0 gián đoạn</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">
                    {session.interruptionCount} lần rời tab ({session.awaySecs}s)
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="smooth-scroll overflow-y-auto flex-1 min-h-0 pr-1 space-y-3.5">
              {loadingPrompt ? (
                <div className="py-12 px-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 flex flex-col items-center justify-center text-center gap-3">
                  <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 max-w-md">
                    Gemini AI đang đọc dữ liệu phiên học của bạn để tạo 3 câu hỏi tự phản chiếu CDS-HS...
                  </p>
                </div>
              ) : promptError ? (
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3">
                  <p className="text-sm text-rose-700 dark:text-rose-300">{promptError}</p>
                  <button
                    type="button"
                    onClick={() => void loadQuestions(session)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử gọi lại Gemini AI
                  </button>
                </div>
              ) : feedback ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="p-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="w-4 h-4" />
                        Nhận diện CDS-HS
                      </span>
                      <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {alreadySaved ? 'Đã lưu Sổ tay · +15 XP' : '+15 XP'}
                      </span>
                    </div>
                    <div className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {feedback.cognitiveTrap}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-emerald-500/5 to-indigo-500/10 space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      <Sparkles className="w-4 h-4" />
                      Phân tích tự nhận thức từ Gemini AI
                    </div>
                    <p className="text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed">
                      {feedback.cdsInsight}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/75 dark:bg-slate-900/60 space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vi thói quen cho phiên tiếp theo
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {feedback.nextMicroHabit}
                    </p>
                  </div>
                </motion.div>
              ) : promptData ? (
                <form id="deepwork-reflection-form" onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="p-3.5 rounded-2xl border border-sky-500/25 bg-sky-500/8 text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                    <span className="font-bold text-sky-700 dark:text-sky-300">Gemini AI: </span>
                    {promptData.sessionAssessment}
                  </div>

                  {/* Quick Focus Rating 1-5 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/45">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Mức độ nhập tâm của bạn trong phiên này:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setFocusScore(score)}
                          className={`min-w-[36px] min-h-[34px] px-2.5 rounded-xl font-mono-num text-xs font-bold transition-colors ${
                            focusScore === score
                              ? 'aurora-accent-btn shadow-sm'
                              : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3 Personalized Reflection Questions */}
                  <div className="space-y-3">
                    {promptData.questions.slice(0, 3).map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="p-3.5 rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Câu {idx + 1}/3 · {q.focusArea}
                          </span>
                          {answers[idx]?.trim() && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {q.question}
                        </p>

                        {q.quickChips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {q.quickChips.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => handleSelectChip(idx, chip)}
                                className="min-h-[30px] px-2.5 py-1 rounded-lg border border-slate-300/80 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/70 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                        )}

                        <textarea
                          rows={2}
                          maxLength={300}
                          value={answers[idx] || ''}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                          placeholder="Chọn nhanh gợi ý ở trên hoặc viết ngắn cảm nhận của bạn..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/90 dark:bg-slate-950/75 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                      {submitError}
                    </div>
                  )}
                </form>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 shrink-0">
              {feedback ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenJournal();
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" />
                    Xem trong Sổ tay 7 mục
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="aurora-accent-btn min-h-[42px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ml-auto"
                  >
                    Hoàn tất
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    Để sau
                  </button>
                  <button
                    type="submit"
                    form="deepwork-reflection-form"
                    disabled={!allAnswered || submitting || loadingPrompt}
                    className="aurora-accent-btn min-h-[42px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold disabled:opacity-45 whitespace-nowrap ml-auto shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang phân tích CDS-HS...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Gửi tự phản chiếu (+15 XP)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
