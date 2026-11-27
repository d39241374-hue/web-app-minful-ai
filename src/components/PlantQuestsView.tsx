import { useState } from 'react';
import { Droplets, Plus, Sprout } from 'lucide-react';
import type { PlantQuest, UserProfile } from '../types';

interface PlantQuestsViewProps {
  user: UserProfile;
  quests: PlantQuest[];
  onWaterQuest: (quest: PlantQuest) => Promise<void>;
  onCreateQuest: (text: string, seedCost: number) => Promise<void>;
}

export function PlantQuestsView({ user, quests, onWaterQuest, onCreateQuest }: PlantQuestsViewProps) {
  const [text, setText] = useState('');
  const [seedCost, setSeedCost] = useState(40);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = text.trim();
    if (!cleaned) return;
    setCreating(true);
    try {
      await onCreateQuest(cleaned, seedCost);
      setText('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col justify-between gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
          Chăm sóc &amp; Tưới nước Vườn 3D
        </h1>
        <div className="glass-panel rounded-2xl px-3.5 py-2 flex items-center gap-2 shrink-0">
          <Sprout className="w-4 h-4 text-emerald-500" />
          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Số dư:</span>
          <span className="font-mono-num text-base font-bold text-slate-900 dark:text-white">
            {user.seedPoints.toLocaleString('vi-VN')} mầm
          </span>
        </div>
      </div>

      {/* Quests List */}
      <div className="smooth-scroll overflow-y-auto flex-1 min-h-0 pr-0.5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quests.map((q) => {
            const canAfford = user.seedPoints >= q.seedCost;
            const xpGain = q.seedCost * 2;
            return (
              <div
                key={q.id}
                className="scroll-fade-item relative glass-panel rounded-2xl p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div className="led-strip absolute top-0 inset-x-5 h-[2px] opacity-80" />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 font-mono-num">
                    {q.seedCost} mầm · +{xpGain} XP · {q.count || 0} lần
                  </div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {q.text}
                  </h2>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => void onWaterQuest(q)}
                  className="aurora-accent-btn min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold disabled:opacity-45 transition-opacity whitespace-nowrap"
                >
                  <Droplets className="w-4 h-4" />
                  {canAfford ? 'Tưới ngay & Gọi mưa 3D' : `Thiếu ${q.seedCost - user.seedPoints} mầm`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Custom Quest */}
      <section className="scroll-fade-item led-frame glass-panel relative rounded-2xl p-3.5 space-y-2 shrink-0">
        <div className="led-strip absolute top-0 inset-x-5 h-[3px]" />
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          Tạo nghi thức chăm cây cá nhân
        </h2>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-12 gap-2.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={180}
            placeholder="Ví dụ: Tưới nước thưởng sau 45 phút giải đề Vật lý"
            className="sm:col-span-7 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <select
            value={seedCost}
            onChange={(e) => setSeedCost(Number(e.target.value))}
            className="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none font-mono-num"
          >
            <option value={20}>20 mầm (+40 XP)</option>
            <option value={40}>40 mầm (+80 XP)</option>
            <option value={80}>80 mầm (+160 XP)</option>
            <option value={150}>150 mầm (+300 XP)</option>
          </select>
          <button
            type="submit"
            disabled={creating || !text.trim()}
            className="sm:col-span-2 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tạo mới
          </button>
        </form>
      </section>
    </div>
  );
}
