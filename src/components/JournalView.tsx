import { useState } from 'react';
import { BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { hasCrisisSignal } from '../constants';
import { analyzeJournalWithAi } from '../services/aiService';
import type { JournalEntry, UserProfile } from '../types';

interface JournalViewProps {
  user: UserProfile;
  journals: JournalEntry[];
  onSaveJournal: (entry: Omit<JournalEntry, 'id' | 'uid'>) => Promise<void>;
  onDeleteJournal: (journalId: string) => Promise<void>;
  onTriggerCrisis: () => void;
}

const MOOD_OPTIONS = [
  'Bình yên & Sáng suốt',
  'Hào hứng học tập',
  'Hơi mệt nhưng tập trung',
  'Dễ xao nhãng hôm nay',
  'Áp lực bài vở',
];

export function JournalView({
  user,
  journals,
  onSaveJournal,
  onDeleteJournal,
  onTriggerCrisis,
}: JournalViewProps) {
  const [mood, setMood] = useState(MOOD_OPTIONS[0]);
  const [screenTime, setScreenTime] = useState('45 phút giải trí');
  const [distractionLesson, setDistractionLesson] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const combined = `${distractionLesson} ${gratitude} ${tomorrowPlan}`;
    if (hasCrisisSignal(combined)) {
      onTriggerCrisis();
    }

    setSaving(true);
    setAiError('');
    try {
      const deepWorkNote = `${user.todayFocusMins} phút Deep Work hôm nay`;
      const cdsNote = user.lastCdsScore ? `${user.lastCdsScore.toFixed(2)} / 5.0` : 'Chưa đo';

      let aiCognitiveTrap: string | undefined;
      let aiInsight: string | undefined;
      let aiNextStep: string | undefined;

      try {
        const analysis = await analyzeJournalWithAi({
          mood,
          screenTime,
          deepWorkNote,
          distractionLesson,
          gratitude,
          tomorrowPlan,
          cdsScore: user.lastCdsScore ?? null,
        });
        aiCognitiveTrap = analysis.cognitiveTrap;
        aiInsight = analysis.insight;
        aiNextStep = analysis.nextStep;
      } catch (err) {
        setAiError(
          err instanceof Error
            ? `Lưu sổ tay thành công, nhưng phân tích AI tạm gián đoạn: ${err.message}`
            : 'Lưu sổ tay thành công, chưa kết nối được Gemini AI.',
        );
      }

      const d = new Date();
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      await onSaveJournal({
        dateLabel,
        mood,
        screenTime,
        deepWorkNote,
        distractionLesson: distractionLesson.trim() || 'Giữ tốt nguyên tắc điện thoại ngủ ngoài bàn học.',
        gratitude: gratitude.trim() || 'Đã dành thời gian chăm sóc bản thân và học tập.',
        tomorrowPlan: tomorrowPlan.trim() || 'Hoàn thành ít nhất 1 phiên Deep Work 25 phút.',
        cdsNote,
        aiCognitiveTrap,
        aiInsight,
        aiNextStep,
      });

      setDistractionLesson('');
      setGratitude('');
      setTomorrowPlan('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
          Sổ tay Phản chiếu Tâm lý 7 Mục &amp; Gemini AI
        </h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
        {/* Left: Compact 7-Item Form */}
        <form
          onSubmit={handleSubmit}
          className="scroll-fade-item led-frame lg:col-span-7 glass-panel relative rounded-3xl p-4 sm:p-5 flex flex-col gap-2.5 min-h-0 overflow-y-auto flex-1"
        >
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
          <div className="grid sm:grid-cols-2 gap-3 shrink-0">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                1. Cảm xúc chủ đạo hôm nay
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm font-medium text-slate-900 dark:text-white outline-none"
              >
                {MOOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                2. Thời lượng mạng xã hội hôm nay
              </label>
              <input
                type="text"
                maxLength={80}
                value={screenTime}
                onChange={(e) => setScreenTime(e.target.value)}
                placeholder="VD: 35 phút TikTok, 20 phút YouTube"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/55 text-xs sm:text-sm text-slate-700 dark:text-slate-200 shrink-0">
            <span>
              <span className="text-slate-500 dark:text-slate-400">3. Deep Work: </span>
              <strong className="font-mono-num text-slate-900 dark:text-white">{user.todayFocusMins} phút</strong>
            </span>
            <span>
              <span className="text-slate-500 dark:text-slate-400">4. CDS-HS: </span>
              <strong className="font-mono-num text-slate-900 dark:text-white">
                {user.lastCdsScore ? `${user.lastCdsScore.toFixed(2)} / 5.0` : 'Chưa đo'}
              </strong>
            </span>
          </div>

          <div className="space-y-1 shrink-0 lg:flex-1 lg:flex lg:flex-col lg:min-h-[88px]">
            <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 block shrink-0">
              5. Điều khiến mình xao nhãng hôm nay &amp; bài học rút ra
            </label>
            <textarea
              rows={2}
              maxLength={580}
              value={distractionLesson}
              onChange={(e) => setDistractionLesson(e.target.value)}
              placeholder="Mình đã mở điện thoại lúc nào? Cảm xúc ngay trước đó là gì?"
              className="w-full min-h-[64px] lg:flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 shrink-0">
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                6. Điều tự hào / biết ơn hôm nay
              </label>
              <input
                type="text"
                maxLength={380}
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="VD: Giải xong 2 bài hình không gian"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                7. Cam kết nhỏ cho ngày mai
              </label>
              <input
                type="text"
                maxLength={380}
                value={tomorrowPlan}
                onChange={(e) => setTomorrowPlan(e.target.value)}
                placeholder="VD: Học 25 phút trước khi mở điện thoại"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {aiError && <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 shrink-0">{aiError}</p>}

          <div className="flex justify-end shrink-0 pt-0.5">
            <button
              type="submit"
              disabled={saving}
              className="aurora-accent-btn w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {saving ? 'Gemini AI đang phân tích...' : 'Lưu Sổ tay & Phân tích AI (+40 XP)'}
            </button>
          </div>
        </form>

        {/* Right: Scrollable Journal History */}
        <section className="scroll-fade-item lg:col-span-5 glass-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2 text-base sm:text-lg font-display font-bold text-slate-900 dark:text-white shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Nhật ký đã lưu ({journals.length})
          </div>

          <div className="smooth-scroll overflow-y-auto flex-1 pr-1 space-y-3 min-h-0">
            {journals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-[15px] text-slate-500 dark:text-slate-400 px-4 py-10">
                Chưa có trang sổ tay nào. Hãy ghi lại dòng phản chiếu đầu tiên ở biểu mẫu bên trái để nhận phân tích từ Gemini AI.
              </div>
            ) : (
              journals.map((entry) => (
                <article
                  key={entry.id}
                  className="scroll-fade-item p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/65 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-300 font-mono-num">
                        {entry.dateLabel} · {entry.mood} · {entry.deepWorkNote}
                      </div>
                      <h3 className="font-display text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                        {entry.distractionLesson}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDeleteJournal(entry.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                      aria-label="Xóa nhật ký"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Biết ơn: </span>
                      {entry.gratitude}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Ngày mai: </span>
                      {entry.tomorrowPlan}
                    </div>
                  </div>

                  {entry.aiInsight && (
                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{entry.aiCognitiveTrap || 'Nhận diện thói quen số'}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{entry.aiInsight}</p>
                      {entry.aiNextStep && (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Gợi ý CDS-HS: {entry.aiNextStep}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
