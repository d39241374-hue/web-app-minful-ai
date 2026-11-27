import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckSquare,
  Clock,
  Droplets,
  MessageSquare,
  Moon,
  ShieldAlert,
  Sparkles,
  Sun,
  Trees,
  X,
} from 'lucide-react';
import chibiManagerImg from '../assets/images/chibi_tree_manager_1795700337468.jpg';
import { getTitleByLevel } from '../constants';
import type { TabId, UserProfile } from '../types';

export function ScrollFadeSection({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.32, ease: 'easeOut', delay }}
      className={`scroll-fade-item ${className}`}
    >
      {children}
    </motion.div>
  );
}

interface ChibiManagerAvatarProps {
  onClick: () => void;
  pendingTasksCount: number;
  timerRunning: boolean;
}

export function ChibiManagerAvatar({
  onClick,
  pendingTasksCount,
  timerRunning,
}: ChibiManagerAvatarProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      title="Mở Trợ lý Quản lý Cây Chibi"
      aria-label="Mở Trợ lý Quản lý Cây Chibi"
      className="led-frame relative min-h-[40px] inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 transition-colors shrink-0"
    >
      <img
        src={chibiManagerImg}
        alt="Linh Mộc Quản Gia Chibi"
        className="w-8 h-8 rounded-full object-cover object-top shrink-0 ring-1 ring-emerald-400/60"
      />
      <div className="hidden sm:flex flex-col items-start text-left leading-none">
        <span className="text-[11px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
          Linh Mộc
        </span>
        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          {timerRunning
            ? 'Đang canh phiên'
            : pendingTasksCount > 0
              ? `${pendingTasksCount} việc chờ`
              : 'Quản lý'}
        </span>
      </div>
      {pendingTasksCount > 0 && (
        <span className="sm:hidden font-mono-num text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          {pendingTasksCount}
        </span>
      )}
    </motion.button>
  );
}

interface ChibiSidebarCardProps {
  user: UserProfile;
  pendingTasksCount: number;
  timerRunning: boolean;
  onOpenManager: () => void;
}

export function ChibiSidebarCard({
  user,
  pendingTasksCount,
  timerRunning,
  onOpenManager,
}: ChibiSidebarCardProps) {
  const tip = timerRunning
    ? 'Mình đang canh phiên Deep Work cùng bạn!'
    : user.todayFocusMins === 0
      ? 'Bắt đầu 25 phút để tưới nắng cho cây nhé.'
      : pendingTasksCount > 0
        ? `Còn ${pendingTasksCount} nhiệm vụ đang chờ bạn.`
        : 'Hôm nay bạn giữ nhịp học rất tốt!';

  return (
    <button
      type="button"
      onClick={onOpenManager}
      className="led-frame w-full rounded-2xl p-2.5 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800/90 transition-colors text-left flex items-center gap-2.5 group"
    >
      <img
        src={chibiManagerImg}
        alt="Cây Chibi Quản lý Ứng dụng"
        className="w-11 h-11 rounded-xl object-cover object-top shrink-0 ring-2 ring-emerald-400/50 group-hover:scale-105 transition-transform"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-xs font-extrabold aurora-gradient-text truncate">
          <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>Linh Mộc Quản Gia</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5">
          {tip}
        </p>
      </div>
    </button>
  );
}

interface ChibiManagerModalProps {
  open: boolean;
  user: UserProfile;
  pendingTasksCount: number;
  totalTasksCount: number;
  timerRunning: boolean;
  formattedTimer: string;
  isDark: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabId) => void;
  onToggleTheme: () => void;
  onTriggerAwakeningTest: () => void;
}

export function ChibiManagerModal({
  open,
  user,
  pendingTasksCount,
  totalTasksCount,
  timerRunning,
  formattedTimer,
  isDark,
  onClose,
  onSelectTab,
  onToggleTheme,
  onTriggerAwakeningTest,
}: ChibiManagerModalProps) {
  const xpPct = user.maxXp > 0 ? Math.min(100, Math.round((user.xp / user.maxXp) * 100)) : 100;

  const managerAdvice = timerRunning
    ? `Phiên Deep Work đang đếm (${formattedTimer}). Hãy giữ nguyên tab này để cây hấp thụ trọn vẹn ánh sáng và XP nhé!`
    : user.todayFocusMins === 0
      ? `Chào ${user.fullname}! Hôm nay "${user.treeName}" chưa đón giọt nắng tập trung nào. Thử một phiên 25 phút ngay nhé?`
      : pendingTasksCount > 0
        ? `Bạn đã tập trung ${user.todayFocusMins} phút hôm nay và còn ${pendingTasksCount} nhiệm vụ đang mở. Hoàn thành từng bước nhỏ sẽ giúp cây mau thăng cấp!`
        : `Tuyệt vời! Bạn đã giữ chuỗi ${user.streakDays} ngày và hoàn thành mọi nhiệm vụ. Đừng quên ghi Sổ tay 7 mục hoặc tưới nước cho cây.`;

  const quickActions: Array<{
    tab: TabId;
    label: string;
    sub: string;
    icon: typeof Clock;
    accent: string;
  }> = [
    {
      tab: 'timer',
      label: timerRunning ? `Deep Work (${formattedTimer})` : 'Bắt đầu Deep Work',
      sub: 'Đồng hồ & sóng não',
      icon: Clock,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      tab: 'tasks',
      label: `Nhiệm vụ (${pendingTasksCount}/${totalTasksCount})`,
      sub: 'Quản lý & chia việc AI',
      icon: CheckSquare,
      accent: 'text-sky-600 dark:text-sky-400',
    },
    {
      tab: 'chat',
      label: 'Cố vấn Gemini AI',
      sub: 'Tâm lý · Toán · Văn · Anh',
      icon: MessageSquare,
      accent: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      tab: 'plant_quests',
      label: 'Tưới nước & Chăm cây',
      sub: `${user.seedPoints.toLocaleString('vi-VN')} mầm sẵn sàng`,
      icon: Droplets,
      accent: 'text-cyan-600 dark:text-cyan-400',
    },
  ];

  const handleJump = (tab: TabId) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="led-frame glass-card-solid relative overflow-hidden w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 max-h-[88dvh] overflow-y-auto"
          >
            <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />

            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="led-frame rounded-2xl shrink-0">
                  <img
                    src={chibiManagerImg}
                    alt="Linh Mộc Quản Gia"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-top"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Quản lý ứng dụng Chibi
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                    Linh Mộc Quản Gia
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                    {user.treeName} · Cấp {user.level}/10 · {getTitleByLevel(user.level)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng bảng quản lý Chibi"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Speech Bubble Advice */}
            <div className="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
              {managerAdvice}
            </div>

            {/* Progress & KPI Strip */}
            <div className="space-y-2 rounded-2xl p-3.5 bg-slate-100/80 dark:bg-slate-800/65 border border-slate-200/80 dark:border-slate-700/70">
              <div className="flex items-center justify-between text-xs font-mono-num font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  Tiến độ cấp {user.level}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {user.xp.toLocaleString('vi-VN')} / {user.maxXp.toLocaleString('vi-VN')} XP ({xpPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full led-strip rounded-full transition-all duration-300" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono-num">
                <div className="rounded-xl bg-white/75 dark:bg-slate-900/75 py-1.5 px-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Hôm nay</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{user.todayFocusMins}p</div>
                </div>
                <div className="rounded-xl bg-white/75 dark:bg-slate-900/75 py-1.5 px-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Chuỗi</div>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{user.streakDays} ngày</div>
                </div>
                <div className="rounded-xl bg-white/75 dark:bg-slate-900/75 py-1.5 px-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Điểm mầm</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {user.seedPoints.toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Navigation Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.tab}
                    type="button"
                    onClick={() => handleJump(act.tab)}
                    className="min-h-[54px] p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/70 hover:border-sky-400/60 text-left transition-colors flex items-start gap-2.5"
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${act.accent}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{act.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{act.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Utility Controls */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleJump('home')}
                className="min-h-[42px] px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Trees className="w-3.5 h-3.5 text-emerald-500" />
                Vườn 3D
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="min-h-[42px] px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                {isDark ? 'Ngày' : 'Đêm'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerAwakeningTest();
                }}
                className="min-h-[42px] px-2.5 py-2 rounded-xl border border-amber-400/50 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Nhắc tab
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
