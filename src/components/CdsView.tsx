import { useState } from 'react';
import { Activity, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { CDS_QUESTIONS_10 } from '../constants';
import { fetchCdsStudyAdvice, type CdsStudyAdvice } from '../services/aiService';
import type { CdsRecord, UserProfile } from '../types';

interface CdsViewProps {
  user: UserProfile;
  records: CdsRecord[];
  onSaveAssessment: (score: number, answers: number[]) => Promise<void>;
}

export function CdsView({ user, records, onSaveAssessment }: CdsViewProps) {
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(3));
  const [saving, setSaving] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<CdsStudyAdvice | null>(null);
  const [aiError, setAiError] = useState('');

  const avg = Number((answers.reduce((a, b) => a + b, 0) / 10).toFixed(2));
  const latestScore = user.lastCdsScore ?? records[records.length - 1]?.score;

  const statusText =
    latestScore == null
      ? 'Chưa đo'
      : latestScore < 2.6
        ? 'Chủ động số'
        : latestScore <= 3.4
          ? 'Xao nhãng nhẹ'
          : 'Bất hòa cao';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAiError('');
    try {
      await onSaveAssessment(avg, answers);
      try {
        const res = await fetchCdsStudyAdvice({
          answers,
          score: avg,
          treeName: user.treeName,
          fullname: user.fullname,
          todayFocusMins: user.todayFocusMins,
          streakDays: user.streakDays,
        });
        setAiAdvice(res);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Chưa lấy được lời khuyên Gemini AI.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Build responsive SVG polyline for CDS trend
  const chartPoints = records.slice(-10);
  const svgW = 540;
  const svgH = 200;
  const padX = 36;
  const padY = 24;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const getCoord = (idx: number, score: number, len: number) => {
    const x = len <= 1 ? padX + plotW / 2 : padX + (idx / (len - 1)) * plotW;
    const norm = (Math.max(1, Math.min(5, score)) - 1) / 4;
    const y = padY + (1 - norm) * plotH;
    return { x, y };
  };

  const targetY = padY + (1 - (2.6 - 1) / 4) * plotH;
  const polylinePts = chartPoints
    .map((r, i) => {
      const p = getCoord(i, r.score, chartPoints.length);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
          Đánh giá Bất hòa nhận thức số (CDS-HS)
        </h1>

        <div className="glass-panel rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shrink-0">
          <Activity className="w-4 h-4 text-sky-500" />
          <div className="text-xs sm:text-sm">
            <span className="font-mono-num font-bold text-slate-900 dark:text-white">
              {latestScore != null ? `${latestScore.toFixed(2)}/5.0` : 'Chưa đo'}
            </span>
            <span className="text-slate-500 dark:text-slate-300"> · {statusText}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
        {/* Left: Trend Chart & Immediate AI Advice */}
        <section className="scroll-fade-item led-frame lg:col-span-5 glass-panel relative rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3 min-h-0 lg:overflow-y-auto">
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Diễn tiến CDS-HS
            </h2>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono-num">
              Mục tiêu &lt; 2.60
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0">
            {chartPoints.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4">
                Hoàn thành 10 câu hỏi bên phải để xem biểu đồ CDS-HS và lời khuyên AI.
              </p>
            ) : (
              <div className="w-full">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-40 sm:h-44">
                  {[1, 2, 3, 4, 5].map((tick) => {
                    const y = padY + (1 - (tick - 1) / 4) * plotH;
                    return (
                      <g key={tick}>
                        <line
                          x1={padX}
                          y1={y}
                          x2={svgW - padX}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-700/70"
                          strokeDasharray="3 3"
                        />
                        <text x={10} y={y + 4} fontSize="11" className="fill-slate-400 font-mono">
                          {tick}.0
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={padX}
                    y1={targetY}
                    x2={svgW - padX}
                    y2={targetY}
                    stroke="#10B981"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />

                  {chartPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#0EA5E9"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polylinePts}
                    />
                  )}

                  {chartPoints.map((rec, i) => {
                    const { x, y } = getCoord(i, rec.score, chartPoints.length);
                    return (
                      <g key={rec.id}>
                        <circle cx={x} cy={y} r="5" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          className="fill-slate-700 dark:fill-slate-200 font-mono"
                        >
                          {rec.score.toFixed(2)}
                        </text>
                        <text
                          x={x}
                          y={svgH - 4}
                          textAnchor="middle"
                          fontSize="10"
                          className="fill-slate-400 font-mono"
                        >
                          {rec.dateLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {saving ? (
            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-sky-700 dark:text-sky-300 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Gemini AI đang soạn lời khuyên &amp; lời chúc cho buổi học...</span>
            </div>
          ) : aiError ? (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 shrink-0">
              {aiError}
            </div>
          ) : aiAdvice ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-indigo-500/10 border border-emerald-500/25 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiAdvice.statusLabel}
                </span>
                <span className="font-mono-num">Gợi ý {aiAdvice.recommendedFocusMins}p</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-snug">
                {aiAdvice.studyAdvice}
              </p>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 italic">
                “{aiAdvice.warmWish}”
              </p>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 shrink-0">
              Thang 1–5: <strong>1</strong> Chưa từng · <strong>3</strong> Đôi khi · <strong>5</strong> Rất thường (thấp = tốt)
            </div>
          )}
        </section>

        {/* Right: All 10 Questions in Compact 2-Column Grid */}
        <form
          onSubmit={handleSubmit}
          className="scroll-fade-item lg:col-span-7 glass-panel rounded-3xl p-4 flex flex-col gap-2.5 min-h-0"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Bảng 10 câu hỏi CDS-HS
            </h2>
            <span className="text-sm font-mono-num font-bold text-sky-600 dark:text-sky-400">
              {avg.toFixed(2)} / 5.00
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 smooth-scroll overflow-y-auto flex-1 pr-0.5 min-h-0 content-start">
            {CDS_QUESTIONS_10.map((q, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/65 dark:bg-slate-900/60 flex flex-col justify-between gap-2"
              >
                <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 leading-snug">{q}</p>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const next = [...answers];
                        next[idx] = val;
                        setAnswers(next);
                      }}
                      className={`min-h-[32px] rounded-lg text-xs font-bold tabular-nums transition-colors ${
                        answers[idx] === val
                          ? 'aurora-accent-btn shadow-sm'
                          : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 shrink-0">
            <button
              type="submit"
              disabled={saving}
              className="aurora-accent-btn w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Đang lưu & hỏi AI...' : 'Lưu & Nhận lời khuyên AI (+20 XP)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
