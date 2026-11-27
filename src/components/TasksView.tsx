import { useState } from 'react';
import { Check, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { breakdownGoalWithAi, type BreakdownTaskItem } from '../services/aiService';
import type { UserTask } from '../types';

interface TasksViewProps {
  tasks: UserTask[];
  onAddTask: (text: string, category: string, estimatedMins?: number) => Promise<void>;
  onToggleTask: (task: UserTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onFocusTask?: (task: UserTask) => void;
}

const CATEGORIES = ['Toán Học', 'Văn Học', 'Khoa Học', 'Ngoại Ngữ'];

export function TasksView({ tasks, onAddTask, onToggleTask, onDeleteTask, onFocusTask }: TasksViewProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Toán Học');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const [goalInput, setGoalInput] = useState('');
  const [subjectHint, setSubjectHint] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [suggestions, setSuggestions] = useState<BreakdownTaskItem[]>([]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = text.trim();
    if (!cleaned) return;
    await onAddTask(cleaned, category);
    setText('');
  };

  const handleAiBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = goalInput.trim();
    if (!cleaned) return;
    setAiLoading(true);
    setAiError('');
    try {
      const items = await breakdownGoalWithAi({ goal: cleaned, subjectHint: subjectHint || undefined });
      setSuggestions(items);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể phân tách mục tiêu với Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAll = async () => {
    for (const item of suggestions) {
      await onAddTask(item.text, item.category, item.estimatedMins);
    }
    setSuggestions([]);
    setGoalInput('');
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'done') return t.completed;
    return true;
  });

  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            Nhiệm vụ học tập Deep Work
          </h1>
        </div>
        <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 font-mono-num">
          Đã hoàn thành: {doneCount}/{tasks.length}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
        {/* Left: Creation Forms (AI Breakdown + Manual) */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
          {/* Manual Task Creation */}
          <section className="scroll-fade-item glass-panel rounded-3xl p-4 space-y-2.5 shrink-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Thêm nhiệm vụ mới
            </h2>
            <form onSubmit={handleAdd} className="space-y-2.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={220}
                placeholder="Nhập việc cần hoàn thành (VD: Giải 10 bài Hình học)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="grid grid-cols-12 gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="col-span-7 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="col-span-5 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Thêm việc
                </button>
              </div>
            </form>
          </section>

          {/* Gemini AI Goal Breakdown — overflow-y-auto flex-1 avoids bottom button clipping */}
          <section className="scroll-fade-item led-frame glass-panel relative rounded-3xl p-4 flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-0">
            <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Gemini AI chia nhỏ mục tiêu
              </h2>
            </div>

            <form onSubmit={handleAiBreakdown} className="space-y-2 shrink-0">
              <textarea
                rows={2}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                maxLength={350}
                placeholder="Nhập mục tiêu lớn (VD: Ôn tập hàm số mũ & logarit giữa kỳ)..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
              />
              <div className="grid grid-cols-12 gap-2">
                <select
                  value={subjectHint}
                  onChange={(e) => setSubjectHint(e.target.value)}
                  className="col-span-5 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="">Tự động</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={aiLoading || !goalInput.trim()}
                  className="col-span-7 min-h-[42px] aurora-accent-btn px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
                >
                  {aiLoading ? 'AI đang tách việc...' : 'Phân tách bằng AI'}
                </button>
              </div>
            </form>

            {aiError && <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 shrink-0">{aiError}</p>}

            {suggestions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Đề xuất ({suggestions.length} bước):
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleAcceptAll()}
                    className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors whitespace-nowrap"
                  >
                    Thêm tất cả
                  </button>
                </div>
                <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60"
                    >
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {s.text}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-300 font-mono-num mt-0.5">
                          {s.category} · {s.estimatedMins} phút
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await onAddTask(s.text, s.category, s.estimatedMins);
                          setSuggestions((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:border-emerald-500 whitespace-nowrap shrink-0"
                      >
                        Thêm
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: Scrollable Task List */}
        <section className="scroll-fade-item lg:col-span-7 glass-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-3.5 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Danh sách nhiệm vụ ({filtered.length})
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl w-full sm:w-auto">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'pending', label: 'Chưa xong' },
                  { id: 'done', label: 'Đã xong' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                    filter === f.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="smooth-scroll overflow-y-auto flex-1 pr-1 min-h-0">
            {filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center py-10 text-center text-[15px] text-slate-500 dark:text-slate-400">
                Chưa có nhiệm vụ nào trong mục này. Hãy thêm mới hoặc dùng Gemini AI ở cột bên trái.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {filtered.map((task) => (
                  <div key={task.id} className="scroll-fade-item py-3.5 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => void onToggleTask(task)}
                      className="flex items-start gap-3.5 text-left flex-1 min-w-0 group"
                    >
                      <span
                        className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-500'
                        }`}
                      >
                        {task.completed && <Check className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`text-[15px] font-semibold leading-snug ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.text}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-300 mt-0.5 font-mono-num">
                          {task.category}
                          {task.estimatedMins ? ` · ${task.estimatedMins} phút` : ''}
                          {task.rewarded ? ' · Đã nhận thưởng' : ' · +25 XP & +15 mầm'}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!task.completed && onFocusTask && (
                        <button
                          type="button"
                          onClick={() => onFocusTask(task)}
                          title="Đưa nhiệm vụ này vào phòng Deep Work ngay"
                          className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Học ngay</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onDeleteTask(task.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                        aria-label="Xóa nhiệm vụ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
