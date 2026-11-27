import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Droplets,
  KeyRound,
  LogOut,
  Maximize2,
  Menu,
  MessageSquare,
  Minus,
  Moon,
  Pause,
  Pencil,
  Search,
  ShieldAlert,
  Sun,
  Trees,
  User,
  Users,
  X,
} from 'lucide-react';
import { getTitleByLevel } from '../constants';
import { audioEngine, triggerHapticFeedback } from '../utils/audio';
import type { BinauralMode, TabId, UserProfile, UserTask } from '../types';
import { ChibiManagerAvatar, ChibiManagerModal, ChibiSidebarCard } from './ChibiManager';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  user: UserProfile;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  binauralMode: BinauralMode;
  rainActive: boolean;
  timerRunning: boolean;
  timerSecondsLeft: number;
  timerTotalSeconds?: number;
  timerIntention?: string;
  activeGroupCount?: number;
  tasks?: UserTask[];
  onToggleTimer?: () => void;
  onToggleRain?: () => void;
  onFocusTask?: (task: UserTask) => void;
  pendingTasksCount?: number;
  totalTasksCount?: number;
  incomingGiftCount: number;
  incomingReqCount: number;
  onOpenRenameTree: () => void;
  onTriggerAwakeningTest: () => void;
  onOpenJudgeModal: () => void;
  onExitJudge: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof Trees;
  group: 'core' | 'community';
}> = [
  { id: 'home', label: 'Vườn 3D', shortLabel: 'Vườn 3D', icon: Trees, group: 'core' },
  { id: 'cds', label: 'Đo CDS-HS', shortLabel: 'CDS-HS', icon: Activity, group: 'core' },
  { id: 'timer', label: 'Deep Work', shortLabel: 'Deep Work', icon: Clock, group: 'core' },
  { id: 'journal', label: 'Sổ tay 7 mục', shortLabel: 'Sổ tay', icon: BookOpen, group: 'core' },
  { id: 'chat', label: 'Cố vấn AI', shortLabel: 'Cố vấn AI', icon: MessageSquare, group: 'core' },
  { id: 'research_lab', label: 'Số liệu KHKT', shortLabel: 'Số liệu', icon: BarChart3, group: 'core' },
  { id: 'tasks', label: 'Nhiệm vụ', shortLabel: 'Nhiệm vụ', icon: CheckSquare, group: 'core' },
  { id: 'plant_quests', label: 'Tưới cây', shortLabel: 'Tưới cây', icon: Droplets, group: 'community' },
  { id: 'friends_pets', label: 'Bạn bè & Rồng', shortLabel: 'Bạn & Rồng', icon: Users, group: 'community' },
  { id: 'leaderboard', label: 'Xếp hạng', shortLabel: 'Xếp hạng', icon: Award, group: 'community' },
  { id: 'survey', label: 'Khảo sát', shortLabel: 'Khảo sát', icon: ClipboardCheck, group: 'community' },
  { id: 'profile', label: 'Hồ sơ', shortLabel: 'Hồ sơ', icon: User, group: 'community' },
];

const MOBILE_DOCK_TABS: TabId[] = ['home', 'cds', 'timer', 'chat'];
const MOBILE_DRAWER_TABS: TabId[] = [
  'journal',
  'research_lab',
  'tasks',
  'plant_quests',
  'friends_pets',
  'leaderboard',
  'survey',
  'profile',
];

export function AppShell({
  user,
  activeTab,
  onSelectTab,
  sidebarCollapsed,
  onToggleSidebar,
  isDark,
  onToggleTheme,
  binauralMode,
  rainActive,
  timerRunning,
  timerSecondsLeft,
  timerTotalSeconds = 1500,
  timerIntention = '',
  activeGroupCount = 0,
  tasks = [],
  onToggleTimer,
  onToggleRain,
  onFocusTask,
  pendingTasksCount = 0,
  totalTasksCount = 0,
  incomingGiftCount,
  incomingReqCount,
  onOpenRenameTree,
  onTriggerAwakeningTest,
  onOpenJudgeModal,
  onExitJudge,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chibiManagerOpen, setChibiManagerOpen] = useState(false);
  const [miniWidgetMinimized, setMiniWidgetMinimized] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleSidebar();
      }
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleSidebar]);

  const mins = Math.floor(timerSecondsLeft / 60);
  const secs = timerSecondsLeft % 60;
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const timerProgressRatio =
    timerTotalSeconds > 0
      ? Math.max(0, Math.min(1, (timerTotalSeconds - timerSecondsLeft) / timerTotalSeconds))
      : 0;
  const timerProgressPct = Math.round(timerProgressRatio * 100);
  const miniRingRadius = 15;
  const miniRingCircumference = 2 * Math.PI * miniRingRadius;
  const miniRingOffset = miniRingCircumference * (1 - timerProgressRatio);
  const isJudge = user.role === 'judge';
  const socialAlerts = incomingGiftCount + incomingReqCount;
  const isDrawerTabActive = MOBILE_DRAWER_TABS.includes(activeTab);

  const handleMobileNav = (tab: TabId) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden aurora-surface text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar Rail */}
      <aside
        className={`relative hidden lg:flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/78 dark:bg-slate-900/78 backdrop-blur-xl shrink-0 transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div className="led-strip-vertical absolute top-0 right-0 bottom-0 w-[2px] opacity-75 pointer-events-none" />
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => onSelectTab('home')}
              className="font-display text-lg font-extrabold tracking-tight aurora-gradient-text whitespace-nowrap shrink-0"
            >
              Mindful AI
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Thu gọn / Mở rộng thanh bên (Ctrl+B)"
            aria-label="Thu gọn hoặc mở rộng thanh bên"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullname}</div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate font-mono-num">
                  {user.className} · Lv.{user.level} · {user.seedPoints.toLocaleString('vi-VN')} mầm
                </div>
              </div>
            </div>
            <ChibiSidebarCard
              user={user}
              pendingTasksCount={pendingTasksCount}
              timerRunning={timerRunning}
              onOpenManager={() => setChibiManagerOpen(true)}
            />
          </div>
        )}

        <nav className="smooth-scroll flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const showCount = item.id === 'friends_pets' && socialAlerts > 0;
            const prevGroup = idx > 0 ? NAV_ITEMS[idx - 1].group : item.group;
            const showDivider = prevGroup !== item.group;
            return (
              <div key={item.id}>
                {showDivider && (
                  <div className="my-1.5 border-t border-slate-200/75 dark:border-slate-800/75" aria-hidden="true" />
                )}
                <button
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'aurora-accent-btn shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className="w-[17px] h-[17px] shrink-0" />
                  {!sidebarCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!sidebarCollapsed && showCount && (
                    <span className="font-mono-num text-xs font-bold opacity-95">{socialAlerts}</span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-0.5 shrink-0">
          {isJudge ? (
            <button
              type="button"
              onClick={onExitJudge}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors whitespace-nowrap ${
                sidebarCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Thoát BGK</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenJudgeModal}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap ${
                sidebarCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Chế độ BGK</span>}
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap ${
              sidebarCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="relative flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top Workspace Header — Compact 3-Zone Bar */}
        <header className="relative h-14 px-3.5 sm:px-5 pt-[env(safe-area-inset-top)] border-b border-slate-200/70 dark:border-slate-800/70 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onSelectTab('home')}
              className="lg:hidden font-display text-base font-extrabold aurora-gradient-text whitespace-nowrap shrink-0"
            >
              Mindful AI
            </button>
            <span className="lg:hidden text-xs font-mono-num font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap truncate">
              · Lv.{user.level} · {user.seedPoints.toLocaleString('vi-VN')} mầm
            </span>

            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 truncate">
              <span className="font-bold text-slate-900 dark:text-white truncate">{user.treeName}</span>
              <button
                type="button"
                onClick={onOpenRenameTree}
                title="Đổi tên cây 3D"
                aria-label="Đổi tên cây 3D"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums whitespace-nowrap">{getTitleByLevel(user.level)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num tabular-nums whitespace-nowrap">Chuỗi {user.streakDays} ngày</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-400 font-semibold">
                {user.todayFocusMins}p hôm nay
              </span>
              {isJudge && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    BGK
                  </span>
                </>
              )}
              {(binauralMode !== 'none' || rainActive) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    Âm thanh bật
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {timerRunning && (
              <button
                type="button"
                onClick={() => onSelectTab('timer')}
                className="min-h-[36px] px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 font-mono-num text-xs sm:text-sm font-bold hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="sm:hidden">{formattedTimer}</span>
                <span className="hidden sm:inline">
                  {activeTab !== 'timer' ? `Đang học ${formattedTimer} · Quay lại` : formattedTimer}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              title="Mở bảng tìm nhanh & điều hướng (Ctrl+K)"
              aria-label="Tìm nhanh"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-mono-num text-[11px] text-slate-400">Ctrl+K</span>
            </button>

            <ChibiManagerAvatar
              onClick={() => setChibiManagerOpen(true)}
              pendingTasksCount={pendingTasksCount}
              timerRunning={timerRunning}
            />

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Chuyển giao diện Ngày' : 'Chuyển giao diện Đêm'}
              aria-label={isDark ? 'Chuyển giao diện Ngày' : 'Chuyển giao diện Đêm'}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              <span className="hidden sm:inline">{isDark ? 'Ngày' : 'Đêm'}</span>
            </button>
          </div>
        </header>

        {/* Active View Content — Viewport-Locked Flex Container */}
        <main
          className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative ${
            activeTab === 'home'
              ? ''
              : 'p-3 sm:p-4 lg:p-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-4'
          }`}
        >
          {activeTab !== 'home' && (
            <>
              <div
                aria-hidden="true"
                className="lg:hidden pointer-events-none absolute top-0 inset-x-0 h-4 z-20 bg-gradient-to-b from-[var(--bg-milk)]/80 to-transparent"
              />
              <div
                aria-hidden="true"
                className="lg:hidden pointer-events-none absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] inset-x-0 h-5 z-20 bg-gradient-to-t from-[var(--bg-milk)]/85 to-transparent"
              />
            </>
          )}
          {activeTab === 'home' ? (
            children
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="smooth-scroll overflow-y-auto flex-1 min-h-0 flex flex-col"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Mobile Bottom Sheet Menu for ALL Tabs & Account Actions */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.45 }}
                onDragEnd={(_event, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 450) {
                    setMobileMenuOpen(false);
                  }
                }}
                className="smooth-scroll glass-card-solid relative overflow-hidden w-full rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl space-y-4 max-h-[84dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />
                <div className="w-11 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />

                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                      {user.fullname} · {user.className}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {user.treeName} · Cấp {user.level} · {user.todayFocusMins} phút hôm nay
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    aria-label="Đóng menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <ChibiSidebarCard
                  user={user}
                  pendingTasksCount={pendingTasksCount}
                  timerRunning={timerRunning}
                  onOpenManager={() => {
                    setMobileMenuOpen(false);
                    setChibiManagerOpen(true);
                  }}
                />

                <div className="grid grid-cols-2 gap-2.5">
                  {MOBILE_DRAWER_TABS.map((tabId) => {
                    const item = NAV_ITEMS.find((n) => n.id === tabId)!;
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    const showAlert = tabId === 'friends_pets' && socialAlerts > 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleMobileNav(item.id)}
                        className={`min-h-[48px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-left transition-colors ${
                          active
                            ? 'aurora-accent-btn shadow-sm'
                            : 'border border-slate-200 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/75 text-slate-800 dark:text-slate-100 hover:border-sky-400/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`} />
                        <span className="truncate flex-1">{item.label}</span>
                        {showAlert && (
                          <span className="font-mono-num text-xs font-bold">{socialAlerts}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenRenameTree();
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <Pencil className="w-4 h-4" />
                    Đổi tên cây
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onTriggerAwakeningTest();
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-amber-400/50 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Thử nhắc rời trang
                  </button>
                  {isJudge ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void onExitJudge();
                      }}
                      className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-amber-400/40 text-xs font-semibold text-amber-700 dark:text-amber-300"
                    >
                      <KeyRound className="w-4 h-4" />
                      Thoát BGK
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenJudgeModal();
                      }}
                      className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <KeyRound className="w-4 h-4" />
                      Chế độ BGK
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void onLogout();
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Bottom Navigation (5 Touch-Friendly Targets, Safe-Area Aware) */}
        <nav
          aria-label="Điều hướng di động"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-1"
        >
          <div className="led-strip absolute top-0 inset-x-0 h-[2px] opacity-85 pointer-events-none" />
          {MOBILE_DOCK_TABS.map((tabId) => {
            const item = NAV_ITEMS.find((n) => n.id === tabId)!;
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileNav(item.id)}
                className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobileDockIndicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className="absolute top-0.5 w-8 h-0.5 rounded-full led-strip"
                  />
                )}
                <Icon className="w-5 h-5" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
              mobileMenuOpen || isDrawerTabActive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {(mobileMenuOpen || isDrawerTabActive) && (
              <motion.span
                layoutId="mobileDockIndicator"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute top-0.5 w-8 h-0.5 rounded-full led-strip"
              />
            )}
            <Menu className="w-5 h-5" />
            <span>{socialAlerts > 0 ? `Menu (${socialAlerts})` : 'Menu'}</span>
          </button>
        </nav>

        {/* Floating Bottom-Corner Deep Work Status Widget (when running on other tabs) */}
        <AnimatePresence>
          {timerRunning && activeTab !== 'timer' && (
            <motion.aside
              aria-label="Trạng thái phiên Deep Work đang chạy"
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.94 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`absolute right-3 lg:right-4 lg:bottom-4 z-30 ${
                activeTab === 'home'
                  ? 'bottom-[calc(7.6rem+env(safe-area-inset-bottom))]'
                  : 'bottom-[calc(4.6rem+env(safe-area-inset-bottom))]'
              }`}
            >
              {miniWidgetMinimized ? (
                <div className="glass-card-solid led-frame relative rounded-2xl px-2.5 py-1.5 flex items-center gap-2 shadow-xl">
                  <div className="led-strip absolute top-0 inset-x-3 h-[2px]" />
                  <button
                    type="button"
                    onClick={() => onSelectTab('timer')}
                    title="Quay lại phòng Deep Work"
                    className="flex items-center gap-2 text-left group"
                  >
                    <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 36 36" className="w-7 h-7 -rotate-90" aria-hidden="true">
                        <circle
                          cx="18"
                          cy="18"
                          r="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-slate-200 dark:text-slate-800"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="13"
                          fill="none"
                          stroke="url(#miniWidgetGrad)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 13}
                          strokeDashoffset={2 * Math.PI * 13 * (1 - timerProgressRatio)}
                        />
                        <defs>
                          <linearGradient id="miniWidgetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#0EA5E9" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 absolute" />
                    </div>
                    <span className="font-mono-num text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {formattedTimer}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiniWidgetMinimized(false)}
                    aria-label="Mở rộng widget Deep Work"
                    title="Mở rộng"
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="glass-card-solid led-frame relative w-[256px] sm:w-[274px] rounded-2xl p-2.5 flex items-center gap-2.5 shadow-xl">
                  <div className="led-strip absolute top-0 inset-x-4 h-[2px]" />

                  <button
                    type="button"
                    onClick={() => onSelectTab('timer')}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
                    title="Nhấn để mở phòng Deep Work"
                  >
                    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 38 38" className="w-10 h-10 -rotate-90" aria-hidden="true">
                        <defs>
                          <linearGradient id="miniWidgetGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="55%" stopColor="#0EA5E9" />
                            <stop offset="100%" stopColor="#6366F1" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="19"
                          cy="19"
                          r={miniRingRadius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          className="text-slate-200/80 dark:text-slate-800"
                        />
                        <circle
                          cx="19"
                          cy="19"
                          r={miniRingRadius}
                          fill="none"
                          stroke="url(#miniWidgetGradFull)"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeDasharray={miniRingCircumference}
                          strokeDashoffset={miniRingOffset}
                          style={{ transition: 'stroke-dashoffset 0.45s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        />
                      </svg>
                      <span className="font-mono-num text-[10px] font-bold text-emerald-700 dark:text-emerald-300 absolute">
                        {timerProgressPct}%
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span className="text-emerald-700 dark:text-emerald-400">Deep Work</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeGroupCount >= 1 ? `Học nhóm (${activeGroupCount})` : 'Đang chạy'}</span>
                      </div>
                      <div className="font-mono-num text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                        {formattedTimer}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {timerIntention.trim() || 'Giữ vững dòng chảy tập trung'}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {onToggleTimer && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          triggerHapticFeedback(12);
                          audioEngine.playTactilePress('pause');
                          onToggleTimer();
                        }}
                        aria-label="Tạm dừng Deep Work"
                        title="Tạm dừng"
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectTab('timer')}
                      aria-label="Mở phòng Deep Work"
                      title="Mở phòng Deep Work"
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-xl aurora-accent-btn text-white shadow-sm"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMiniWidgetMinimized(true)}
                      aria-label="Thu gọn widget"
                      title="Thu gọn"
                      className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        <ChibiManagerModal
          open={chibiManagerOpen}
          user={user}
          pendingTasksCount={pendingTasksCount}
          totalTasksCount={totalTasksCount}
          timerRunning={timerRunning}
          formattedTimer={formattedTimer}
          isDark={isDark}
          onClose={() => setChibiManagerOpen(false)}
          onSelectTab={onSelectTab}
          onToggleTheme={onToggleTheme}
          onTriggerAwakeningTest={onTriggerAwakeningTest}
        />

        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectTab={onSelectTab}
          tasks={tasks}
          timerRunning={timerRunning}
          rainActive={rainActive}
          isDark={isDark}
          onToggleTimer={() => onToggleTimer?.()}
          onToggleRain={() => onToggleRain?.()}
          onToggleTheme={onToggleTheme}
          onOpenChibiManager={() => setChibiManagerOpen(true)}
          onFocusTask={(task) => {
            if (onFocusTask) {
              onFocusTask(task);
            } else {
              onSelectTab('timer');
            }
          }}
        />
      </div>
    </div>
  );
}
