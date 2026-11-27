import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  Clock,
  CloudRain,
  CornerDownLeft,
  Droplets,
  MessageSquare,
  Moon,
  Pause,
  Play,
  Search,
  Sparkles,
  Sun,
  Trees,
  User,
  Users,
  X,
} from 'lucide-react';
import type { TabId, UserTask } from '../types';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabId) => void;
  tasks: UserTask[];
  timerRunning: boolean;
  rainActive: boolean;
  isDark: boolean;
  onToggleTimer: () => void;
  onToggleRain: () => void;
  onToggleTheme: () => void;
  onOpenChibiManager: () => void;
  onFocusTask: (task: UserTask) => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint: string;
  group: 'Điều hướng' | 'Thao tác nhanh' | 'Nhiệm vụ chờ';
  icon: typeof Trees;
  keywords: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onSelectTab,
  tasks,
  timerRunning,
  rainActive,
  isDark,
  onToggleTimer,
  onToggleRain,
  onToggleTheme,
  onOpenChibiManager,
  onFocusTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: 'act-timer',
        label: timerRunning ? 'Tạm dừng phiên Deep Work' : 'Bắt đầu / Tiếp tục Deep Work',
        hint: 'Đồng hồ tập trung',
        group: 'Thao tác nhanh',
        icon: timerRunning ? Pause : Play,
        keywords: 'deep work bat dau tam dung timer dong ho',
        action: () => {
          onToggleTimer();
          onClose();
        },
      },
      {
        id: 'act-rain',
        label: rainActive ? 'Tắt âm thanh Mưa rừng' : 'Bật âm thanh Mưa rừng',
        hint: 'Âm thanh nền tập trung',
        group: 'Thao tác nhanh',
        icon: CloudRain,
        keywords: 'mua rung am thanh rain audio',
        action: () => {
          onToggleRain();
          onClose();
        },
      },
      {
        id: 'act-theme',
        label: isDark ? 'Chuyển giao diện Ban ngày' : 'Chuyển giao diện Ban đêm',
        hint: 'Chế độ Sáng / Tối',
        group: 'Thao tác nhanh',
        icon: isDark ? Sun : Moon,
        keywords: 'giao dien ngay dem dark light theme',
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'act-chibi',
        label: 'Mở Linh Mộc Quản Gia Chibi',
        hint: 'Tổng quan & nhắc nhở',
        group: 'Thao tác nhanh',
        icon: Sparkles,
        keywords: 'chibi linh moc quan gia tro ly',
        action: () => {
          onClose();
          onOpenChibiManager();
        },
      },
    ];

    const navs: Array<{ id: TabId; label: string; hint: string; icon: typeof Trees; keywords: string }> = [
      { id: 'home', label: 'Vườn Tâm Trí 3D', hint: 'Trang chủ & cây 3D', icon: Trees, keywords: 'vuon 3d cay home' },
      { id: 'timer', label: 'Phòng Deep Work & Học nhóm', hint: 'Bộ đếm & phòng nhóm', icon: Clock, keywords: 'deep work nhom group timer' },
      { id: 'tasks', label: 'Nhiệm vụ học tập', hint: 'Quản lý & chia nhỏ AI', icon: CheckSquare, keywords: 'nhiem vu task todo' },
      { id: 'chat', label: 'Cố vấn Gemini AI & Diễn đàn', hint: 'AI · Diễn đàn · Bạn bè', icon: MessageSquare, keywords: 'ai co van dien dan chat forum' },
      { id: 'cds', label: 'Đánh giá CDS-HS', hint: 'Bất hòa nhận thức số', icon: Activity, keywords: 'cds khao sat do chi so' },
      { id: 'journal', label: 'Sổ tay 7 mục', hint: 'Phản chiếu tâm lý AI', icon: BookOpen, keywords: 'so tay nhat ky journal' },
      { id: 'plant_quests', label: 'Tưới cây & Nghi thức', hint: 'Dùng điểm mầm', icon: Droplets, keywords: 'tuoi cay mam quests' },
      { id: 'friends_pets', label: 'Bạn bè & Thiên Long', hint: 'Kết bạn & nâng cấp rồng', icon: Users, keywords: 'ban be rong thien long friends' },
      { id: 'leaderboard', label: 'Bảng xếp hạng', hint: 'Top vườn trường', icon: Award, keywords: 'xep hang leaderboard rank' },
      { id: 'research_lab', label: 'Số liệu KHKT', hint: 'Thống kê & xuất CSV', icon: BarChart3, keywords: 'so lieu khkt csv chart' },
      { id: 'survey', label: 'Khảo sát trải nghiệm', hint: 'Đánh giá 1–5', icon: ClipboardCheck, keywords: 'khao sat survey' },
      { id: 'profile', label: 'Hồ sơ & Thành tựu', hint: 'Thông tin & huy hiệu', icon: User, keywords: 'ho so profile huy hieu' },
    ];

    const navItems: CommandItem[] = navs.map((n) => ({
      id: `nav-${n.id}`,
      label: n.label,
      hint: n.hint,
      group: 'Điều hướng',
      icon: n.icon,
      keywords: n.keywords,
      action: () => {
        onSelectTab(n.id);
        onClose();
      },
    }));

    const taskItems: CommandItem[] = tasks
      .filter((t) => !t.completed)
      .slice(0, 6)
      .map((t) => ({
        id: `task-${t.id}`,
        label: `Học ngay: ${t.text}`,
        hint: `${t.category}${t.estimatedMins ? ` · ${t.estimatedMins}p` : ''}`,
        group: 'Nhiệm vụ chờ',
        icon: Play,
        keywords: `${t.text} ${t.category} hoc ngay task`,
        action: () => {
          onFocusTask(t);
          onClose();
        },
      }));

    return [...actions, ...taskItems, ...navItems];
  }, [
    isDark,
    onClose,
    onFocusTask,
    onOpenChibiManager,
    onSelectTab,
    onToggleRain,
    onToggleTheme,
    onToggleTimer,
    rainActive,
    tasks,
    timerRunning,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-3 sm:px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Bảng điều khiển nhanh"
            className="led-frame glass-card-solid relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />

            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm trang, nhiệm vụ hoặc thao tác nhanh (Deep Work, Mưa rừng)..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng bảng tìm nhanh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[54vh] overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Không tìm thấy mục phù hợp.
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.action}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
                        active
                          ? 'bg-emerald-500/12 border border-emerald-500/30 text-slate-900 dark:text-white'
                          : 'border border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100/75 dark:hover:bg-slate-800/75'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            active
                              ? 'aurora-accent-btn text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{item.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.group} · {item.hint}
                          </div>
                        </div>
                      </div>

                      {active && (
                        <CornerDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>↑↓ chọn · Enter mở · Esc đóng</span>
              <span className="font-mono-num">Ctrl+K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
