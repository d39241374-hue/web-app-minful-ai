import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Clock,
  Eye,
  EyeOff,
  HeartHandshake,
  KeyRound,
  Loader2,
  PhoneCall,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import chibiManagerImg from '../assets/images/chibi_tree_manager_1795700337468.jpg';
import { CDS_QUESTIONS_10, TREE_NAME_SUGGESTIONS } from '../constants';
import { fetchCdsStudyAdvice, type CdsStudyAdvice } from '../services/aiService';
import type { UserProfile } from '../types';

const MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.88,
};

function MotionModalBackdrop({
  open,
  zClass = 'z-[70]',
  blurClass = 'bg-slate-950/65 backdrop-blur-sm',
  onBackdropClick,
  children,
}: {
  open: boolean;
  zClass?: string;
  blurClass?: string;
  onBackdropClick?: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={onBackdropClick}
          className={`fixed inset-0 ${zClass} ${blurClass} flex items-end sm:items-center justify-center p-0 sm:p-4`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SOUND_LABELS: Record<CdsStudyAdvice['recommendedSound'], string> = {
  alpha: 'Sóng Alpha 10Hz',
  beta: 'Sóng Beta 18Hz',
  theta: 'Sóng Theta 6Hz',
  rain: 'Tiếng Mưa Rừng',
};

interface CdsOnboardingModalProps {
  open: boolean;
  user: UserProfile;
  onSaveAssessment: (score: number, answers: number[]) => Promise<void>;
  onStartDeepWork: (advice?: CdsStudyAdvice | null) => void;
  onClose: () => void;
}

export function CdsOnboardingModal({
  open,
  user,
  onSaveAssessment,
  onStartDeepWork,
  onClose,
}: CdsOnboardingModalProps) {
  const [phase, setPhase] = useState<'questions' | 'result'>('questions');
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(10).fill(null));
  const [savedOnce, setSavedOnce] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [advice, setAdvice] = useState<CdsStudyAdvice | null>(null);
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('questions');
      setAnswers(Array(10).fill(null));
      setSavedOnce(false);
      setAiLoading(false);
      setAiError('');
      setAdvice(null);
    }
    return () => {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [open]);

  const answeredCount = answers.filter((v) => v !== null).length;
  const allAnswered = answeredCount === 10;
  const avg =
    answeredCount > 0
      ? Number(
          (
            answers.reduce<number>((sum, v) => sum + (v ?? 0), 0) / answeredCount
          ).toFixed(2),
        )
      : 0;

  const generateAdvice = async (finalAnswers: number[], finalScore: number) => {
    setPhase('result');
    setAiLoading(true);
    setAiError('');

    try {
      if (!savedOnce) {
        await onSaveAssessment(finalScore, finalAnswers);
        setSavedOnce(true);
      }
      const res = await fetchCdsStudyAdvice({
        answers: finalAnswers,
        score: finalScore,
        treeName: user.treeName,
        fullname: user.fullname,
        todayFocusMins: user.todayFocusMins,
        streakDays: user.streakDays,
      });
      setAdvice(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể kết nối Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectAnswer = (idx: number, val: number) => {
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);

    if (next.every((v) => v !== null) && !savedOnce && phase === 'questions') {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
      }
      const finalAnswers = next as number[];
      const finalScore = Number((finalAnswers.reduce((a, b) => a + b, 0) / 10).toFixed(2));
      autoTimerRef.current = window.setTimeout(() => {
        void generateAdvice(finalAnswers, finalScore);
      }, 260);
    }
  };

  const handleManualSubmit = () => {
    if (!allAnswered) return;
    const finalAnswers = answers as number[];
    const finalScore = Number((finalAnswers.reduce((a, b) => a + b, 0) / 10).toFixed(2));
    void generateAdvice(finalAnswers, finalScore);
  };

  return (
    <MotionModalBackdrop open={open} zClass="z-[70]">
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.96 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass-card-solid led-frame relative overflow-hidden max-w-4xl w-full rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 pb-[calc(1.1rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl space-y-3.5 max-h-[92dvh] flex flex-col"
      >
        <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden shrink-0" />

        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
              {phase === 'questions'
                ? '10 câu hỏi CDS-HS trước buổi học'
                : 'Lời khuyên & Lời chúc từ Gemini AI'}
            </h2>
            <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300 flex items-center gap-2 mt-0.5">
              {phase === 'questions' ? (
                <span>1 = Chưa từng · 3 = Đôi khi · 5 = Rất thường</span>
              ) : (
                <span className="font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                  CDS-HS: {avg.toFixed(2)} / 5.00
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-xl shrink-0"
          >
            {phase === 'result' ? 'Đóng' : 'Để sau'}
          </button>
        </div>

        {phase === 'questions' && (
          <div className="space-y-1 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono-num font-semibold">
              <span className="text-emerald-700 dark:text-emerald-400">
                Đã trả lời {answeredCount}/10
              </span>
              {answeredCount > 0 && (
                <span className="text-slate-600 dark:text-slate-300">
                  TB tạm tính: {avg.toFixed(2)}/5.0
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full led-strip transition-all duration-300 rounded-full"
                style={{ width: `${(answeredCount / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === 'questions' ? (
            <motion.div
              key="cds-questions-step"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="smooth-scroll overflow-y-auto pr-1 flex-1 min-h-0"
            >
              <div className="grid md:grid-cols-2 gap-2.5">
                {CDS_QUESTIONS_10.map((q, idx) => {
                  const chosen = answers[idx];
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-colors space-y-2 flex flex-col justify-between ${
                        chosen !== null
                          ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/45'
                      }`}
                    >
                      <p className="text-sm text-slate-800 dark:text-slate-100 leading-snug">{q}</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleSelectAnswer(idx, val)}
                            className={`min-h-[38px] py-1.5 rounded-xl text-sm font-bold tabular-nums transition-all ${
                              chosen === val
                                ? 'aurora-accent-btn shadow-sm scale-[1.02]'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="cds-ai-result-step"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="smooth-scroll overflow-y-auto flex-1 min-h-0 space-y-3.5 pr-1"
            >
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-100/85 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                <img
                  src={chibiManagerImg}
                  alt="Linh Mộc Quản Gia"
                  className="w-14 h-14 rounded-2xl object-cover object-top shrink-0 ring-2 ring-emerald-400/60"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {advice?.statusLabel || 'Đang tổng hợp trạng thái'}
                    </span>
                    <span className="font-mono-num text-sm font-extrabold text-sky-600 dark:text-sky-400">
                      {avg.toFixed(2)} / 5.00
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    Chào {user.fullname}, Linh Mộc &amp; Gemini AI đã ghi nhận 10 câu trả lời của bạn!
                  </p>
                </div>
              </div>

              {aiLoading ? (
                <div className="p-8 rounded-2xl border border-sky-500/25 bg-sky-500/5 flex flex-col items-center justify-center text-center gap-3">
                  <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Gemini AI đang phân tích 10 chỉ số để viết lời khuyên &amp; lời chúc cho buổi học...
                  </p>
                </div>
              ) : aiError ? (
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3">
                  <p className="text-sm text-rose-700 dark:text-rose-300">{aiError}</p>
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử gọi lại Gemini AI
                  </button>
                </div>
              ) : advice ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-emerald-500/8 to-indigo-500/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                        <Sparkles className="w-4 h-4" />
                        Lời khuyên cho buổi học này
                      </span>
                      <span className="text-xs font-mono-num font-bold text-emerald-700 dark:text-emerald-300">
                        Gợi ý: {advice.recommendedFocusMins}p · {SOUND_LABELS[advice.recommendedSound]}
                      </span>
                    </div>
                    <p className="text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed">
                      {advice.studyAdvice}
                    </p>
                  </div>

                  <div className="led-frame p-4 rounded-2xl bg-gradient-to-r from-emerald-500/12 via-teal-500/10 to-violet-500/12 space-y-1.5">
                    <div className="text-xs font-bold uppercase tracking-wider aurora-gradient-text">
                      Lời chúc gửi {user.fullname}
                    </div>
                    <p className="text-[15px] font-semibold text-slate-900 dark:text-white leading-relaxed">
                      “{advice.warmWish}”
                    </p>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 shrink-0 border-t border-slate-200/70 dark:border-slate-800/70">
          {phase === 'questions' ? (
            <>
              <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                {allAnswered
                  ? 'Đã đủ 10/10 câu! Đang mở lời khuyên AI...'
                  : `Còn ${10 - answeredCount} câu — hoàn tất để nhận lời khuyên AI`}
              </span>
              <button
                type="button"
                disabled={!allAnswered}
                onClick={handleManualSubmit}
                className="aurora-accent-btn min-h-[42px] px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-45 whitespace-nowrap"
              >
                Nhận lời khuyên AI (+20 XP)
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPhase('questions')}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Chỉnh lại câu trả lời
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Vào Vườn 3D
                </button>
                <button
                  type="button"
                  onClick={() => onStartDeepWork(advice)}
                  className="aurora-accent-btn min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt đầu Deep Work {advice ? `${advice.recommendedFocusMins}p` : ''}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </MotionModalBackdrop>
  );
}

interface NotificationGateModalProps {
  open: boolean;
  onAllow: () => void;
  onLater: () => void;
}

export function NotificationGateModal({ open, onAllow, onLater }: NotificationGateModalProps) {
  return (
    <MotionModalBackdrop open={open} zClass="z-[70]" onBackdropClick={onLater}>
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass-card-solid relative overflow-hidden max-w-lg w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl space-y-5"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/25">
          <Bell className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Bật nhắc nhở bảo vệ khi rời trang
          </h2>
          <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Cho phép thông báo để Mindful AI gửi cảnh báo ngay lập tức nếu bạn rời tab trong phiên Deep Work và báo chuông khi hết giờ học.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onLater}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="aurora-accent-btn min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          >
            Bật thông báo ngay
          </button>
        </div>
      </motion.div>
    </MotionModalBackdrop>
  );
}

const DISTRACTION_REASONS = [
  'Tra cứu tài liệu học tập',
  'Lỡ mở mạng xã hội theo thói quen',
  'Kiểm tra tin nhắn / thông báo',
  'Cần nghỉ mắt ít phút',
];

const SOCRATIC_PROMPTS = [
  'Mình vừa rời bài học vì thật sự cần tra cứu kiến thức, hay bộ não đang tìm kích thích nhanh để né tránh bài khó?',
  'Cảm xúc ngay trước khi mình chuyển sang tab khác là gì — chán nản, căng thẳng hay tò mò thoáng qua?',
  'Nếu giữ trọn sự tập trung thêm 10 phút nữa, mình sẽ hoàn thành được phần nào của mục tiêu hôm nay?',
];

interface AwakeningModalProps {
  open: boolean;
  awaySeconds: number;
  remainingLabel: string;
  sessionIntention?: string;
  interruptionCount: number;
  onReturnToStudy: (reason?: string) => void;
  onTakeBreak: (reason?: string) => void;
}

export function AwakeningModal({
  open,
  awaySeconds,
  remainingLabel,
  sessionIntention,
  interruptionCount,
  onReturnToStudy,
  onTakeBreak,
}: AwakeningModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(DISTRACTION_REASONS[1]);
  const [breathHold, setBreathHold] = useState(3);

  useEffect(() => {
    if (!open) return;
    setBreathHold(3);
    const id = window.setInterval(() => {
      setBreathHold((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const promptText = SOCRATIC_PROMPTS[interruptionCount % SOCRATIC_PROMPTS.length];

  return (
    <MotionModalBackdrop open={open} zClass="z-[80]" blurClass="bg-slate-950/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.95 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass-card-solid relative overflow-hidden max-w-xl w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl space-y-4 sm:space-y-5 border border-amber-500/35"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400">
                Cảnh báo rời trang Deep Work
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Màng Lọc Thức Tỉnh Socratic
              </h2>
            </div>
          </div>
          {breathHold > 0 && (
            <span className="font-mono-num text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
              Hít thở {breathHold}s
            </span>
          )}
        </div>

        {/* Real Telemetry Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Vừa rời trang</div>
            <div className="font-mono-num text-sm sm:text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {awaySeconds > 0 ? `${awaySeconds} giây` : 'Thử nghiệm'}
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Còn lại</div>
            <div className="font-mono-num text-sm sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
              {remainingLabel}
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Gián đoạn</div>
            <div className="font-mono-num text-sm sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {interruptionCount} lần
            </div>
          </div>
        </div>

        {sessionIntention && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">Mục tiêu phiên học: </span>
            {sessionIntention}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[15px] font-medium text-amber-950 dark:text-amber-100 leading-relaxed">
          “{promptText}”
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Ghi nhận nhanh nguyên nhân vừa rời màn hình:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DISTRACTION_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setSelectedReason(reason)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-left text-sm font-medium border transition-colors ${
                  selectedReason === reason
                    ? 'border-emerald-500 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={() => onTakeBreak(selectedReason)}
            className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Tạm dừng phiên để nghỉ
          </button>
          <button
            type="button"
            onClick={() => onReturnToStudy(selectedReason)}
            className="aurora-accent-btn min-h-[48px] px-6 py-3 rounded-xl text-sm font-bold shadow-md whitespace-nowrap"
          >
            Quay lại Deep Work ngay (+5 XP)
          </button>
        </div>
      </motion.div>
    </MotionModalBackdrop>
  );
}

interface CrisisModalProps {
  open: boolean;
  onClose: () => void;
  onOpenCounselor: () => void;
}

export function CrisisModal({ open, onClose, onOpenCounselor }: CrisisModalProps) {
  return (
    <MotionModalBackdrop open={open} zClass="z-[85]" blurClass="bg-slate-950/75 backdrop-blur-md" onBackdropClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="glass-card-solid relative overflow-hidden max-w-lg w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-7 shadow-2xl space-y-5 border border-rose-500/30"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <HeartHandshake className="w-6 h-6 shrink-0" />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Bạn không đơn độc · Hãy tìm sự hỗ trợ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
          Hệ thống nhận thấy bạn đang trải qua cảm xúc nặng nề. Xin hãy chia sẻ với người lớn đáng tin cậy hoặc gọi ngay đường dây hỗ trợ miễn phí 24/7:
        </p>

        <div className="space-y-3">
          <a
            href="tel:111"
            className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 transition-colors"
          >
            <div className="flex items-center gap-3">
              <PhoneCall className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-[15px] font-bold">Tổng đài Quốc gia Bảo vệ Trẻ em: 111</div>
                <div className="text-sm opacity-85">Miễn phí cước gọi · Hỗ trợ 24/7 trên toàn quốc</div>
              </div>
            </div>
            <span className="text-sm font-semibold">Gọi ngay</span>
          </a>
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Phòng Tư vấn Tâm lý Học đường THPT Hương Khê hoặc giáo viên chủ nhiệm luôn sẵn sàng lắng nghe bạn.
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
          >
            Đã hiểu
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCounselor();
            }}
            className="aurora-accent-btn min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          >
            Trò chuyện với Cố vấn AI
          </button>
        </div>
      </motion.div>
    </MotionModalBackdrop>
  );
}

interface RenameTreeModalProps {
  open: boolean;
  currentName: string;
  onSave: (newName: string) => Promise<void>;
  onClose: () => void;
}

export function RenameTreeModal({ open, currentName, onSave, onClose }: RenameTreeModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim().slice(0, 32);
    if (!cleaned) return;
    setSaving(true);
    try {
      await onSave(cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <MotionModalBackdrop open={open} zClass="z-[75]" onBackdropClick={onClose}>
      <motion.form
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-card-solid relative overflow-hidden max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-7 shadow-2xl space-y-5"
      >
        <div className="absolute top-0 inset-x-0 h-1 aurora-top-bar" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Đặt tên Cây Linh Mộc 3D
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Tên cây của bạn</span>
            <span className="font-mono-num">{name.length}/32</span>
          </div>
          <input
            type="text"
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Cổ Thụ Bạch Dương"
            className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {TREE_NAME_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="aurora-accent-btn min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? 'Đang lưu...' : 'Lưu tên cây'}
          </button>
        </div>
      </motion.form>
    </MotionModalBackdrop>
  );
}

interface JudgeAccessModalProps {
  open: boolean;
  onUnlock: (password: string) => boolean;
  onClose: () => void;
}

export function JudgeAccessModal({ open, onUnlock, onClose }: JudgeAccessModalProps) {
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onUnlock(pass.trim());
    if (!ok) {
      setError('Mật khẩu Ban giám khảo chưa chính xác.');
    } else {
      setPass('');
      setError('');
      onClose();
    }
  };

  return (
    <MotionModalBackdrop open={open} zClass="z-[75]" onBackdropClick={onClose}>
      <motion.form
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={MODAL_SPRING}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-card-solid relative overflow-hidden max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-7 shadow-2xl space-y-5"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Mở khóa chế độ Ban giám khảo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Chế độ Ban giám khảo sử dụng bộ nhớ cục bộ tạm thời, mở khóa toàn bộ 10 cấp độ Vườn 3D &amp; bộ đếm Demo 10 giây mà không ảnh hưởng dữ liệu học sinh thật.
        </p>

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Nhập mã truy cập BGK..."
            className="w-full min-h-[44px] px-4 py-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-[15px] outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label="Hiện/ẩn mật khẩu"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
          >
            Đóng
          </button>
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-sm font-bold hover:brightness-105 transition-all whitespace-nowrap"
          >
            Kích hoạt BGK
          </button>
        </div>
      </motion.form>
    </MotionModalBackdrop>
  );
}
