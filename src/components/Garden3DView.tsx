import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Eye,
  EyeOff,
  Layers,
  Leaf,
  Lock,
  Play,
  RotateCcw,
  Snowflake,
  Sparkles,
  Sun,
  Target,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  STAGE_INFO,
  WEATHER_OPTIONS,
  getDragonUpgradeLevel,
  getMaxXpForLevel,
} from '../constants';
import { MindfulGardenScene, type TreeTouchPayload, type XpProgressMeta } from '../three/MindfulGardenScene';
import type { PublicGarden, StudyRoom, UserProfile, WeatherEffect } from '../types';
import { audioEngine, triggerHapticFeedback } from '../utils/audio';

interface Garden3DViewProps {
  user: UserProfile;
  visitingFriend: PublicGarden | null;
  previewLevel: number;
  todaySessions: number;
  isDark: boolean;
  rainTriggerKey: number;
  hasTreeBlessing?: boolean;
  incomingRoomInvites?: StudyRoom[];
  onJoinRoomInvite?: (room: StudyRoom) => void;
  onConsumeTreeBlessing?: () => void;
  onSelectPreviewLevel: (level: number) => void;
  onExitVisit: () => void;
  onStartFocus: () => void;
  onRainEffect: () => void;
}

const DAILY_GOALS = [
  { sessions: 2, mins: 45, label: '2 phiên · 45p' },
  { sessions: 3, mins: 60, label: '3 phiên · 60p' },
  { sessions: 4, mins: 90, label: '4 phiên · 90p' },
] as const;

export function Garden3DView({
  user,
  visitingFriend,
  previewLevel,
  todaySessions,
  isDark,
  rainTriggerKey,
  hasTreeBlessing = false,
  incomingRoomInvites = [],
  onJoinRoomInvite,
  onConsumeTreeBlessing,
  onSelectPreviewLevel,
  onExitVisit,
  onStartFocus,
  onRainEffect,
}: Garden3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<MindfulGardenScene | null>(null);
  const prevLevelRef = useRef<number>(previewLevel);
  const prevUserXpRef = useRef<number>(user.xp);
  const prevUserLevelRef = useRef<number>(user.level);
  const xpGainTimerRef = useRef<number | null>(null);
  const touchFeedbackTimerRef = useRef<number | null>(null);
  const consumeBlessingRef = useRef(onConsumeTreeBlessing);
  consumeBlessingRef.current = onConsumeTreeBlessing;
  const [dockExpanded, setDockExpanded] = useState(false);
  const [dockTab, setDockTab] = useState<'weather' | 'levels'>('weather');
  const [zenMode, setZenMode] = useState(false);
  const [weather, setWeather] = useState<WeatherEffect>('sunlight');
  const [xpGainDelta, setXpGainDelta] = useState<number | null>(null);
  const [treeTouchNotice, setTreeTouchNotice] = useState<{ key: number; boosted: boolean; text: string } | null>(null);
  const [goalIndex, setGoalIndex] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(`mindful_daily_goal_idx_${user.uid}`) || '1', 10);
      return Number.isFinite(saved) && saved >= 0 && saved < DAILY_GOALS.length ? saved : 1;
    } catch {
      return 1;
    }
  });

  const activeGoal = DAILY_GOALS[goalIndex] || DAILY_GOALS[1];
  const goalPct = Math.min(
    100,
    Math.round(
      ((Math.min(1, todaySessions / activeGoal.sessions) + Math.min(1, user.todayFocusMins / activeGoal.mins)) /
        2) *
        100,
    ),
  );
  const goalReached = todaySessions >= activeGoal.sessions && user.todayFocusMins >= activeGoal.mins;
  const remainingSessions = Math.max(0, activeGoal.sessions - todaySessions);
  const remainingMins = Math.max(0, activeGoal.mins - user.todayFocusMins);

  const cycleDailyGoal = () => {
    setGoalIndex((prev) => {
      const next = (prev + 1) % DAILY_GOALS.length;
      try {
        localStorage.setItem(`mindful_daily_goal_idx_${user.uid}`, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const displayLevel = visitingFriend ? visitingFriend.level : previewLevel;
  const stageMeta = STAGE_INFO[displayLevel - 1] || STAGE_INFO[0];
  const isJudge = user.role === 'judge';
  const dragonLevel = visitingFriend ? visitingFriend.dragonUpgradeLevel : getDragonUpgradeLevel(user);

  const xpState: { progress: number; meta: XpProgressMeta } = (() => {
    if (visitingFriend) {
      const friendMax = getMaxXpForLevel(visitingFriend.level);
      const isFriendMax = visitingFriend.level >= 10;
      const friendXp = visitingFriend.xp || 0;
      return {
        progress: isFriendMax ? 1 : Math.min(1, Math.max(0, friendXp / Math.max(1, friendMax))),
        meta: {
          currentXp: friendXp,
          maxXp: friendMax,
          level: visitingFriend.level,
          isMaxLevel: isFriendMax,
          isCompletedStage: false,
        },
      };
    }

    if (displayLevel < user.level) {
      const stageMax = getMaxXpForLevel(displayLevel);
      return {
        progress: 1,
        meta: {
          currentXp: stageMax,
          maxXp: stageMax,
          level: displayLevel,
          isMaxLevel: false,
          isCompletedStage: true,
        },
      };
    }

    if (displayLevel === user.level) {
      const maxXp = Math.max(1, user.maxXp || getMaxXpForLevel(user.level));
      const currentXp = Math.max(0, user.xp || 0);
      const isMaxLevel = user.level >= 10;
      return {
        progress: isMaxLevel ? 1 : Math.min(1, currentXp / maxXp),
        meta: {
          currentXp,
          maxXp,
          level: user.level,
          isMaxLevel,
          isCompletedStage: false,
        },
      };
    }

    const targetMax = getMaxXpForLevel(displayLevel);
    return {
      progress: 0,
      meta: {
        currentXp: 0,
        maxXp: targetMax,
        level: displayLevel,
        isMaxLevel: false,
        isCompletedStage: false,
      },
    };
  })();

  const xpPercent = Math.round(xpState.progress * 100);
  const xpMotionProgress = useMotionValue(xpState.progress);
  const xpSpringProgress = useSpring(xpMotionProgress, {
    stiffness: 120,
    damping: 14,
    mass: 0.85,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new MindfulGardenScene(container, displayLevel, isDark);
    scene.setWeather(weather);
    scene.setPostDeepWorkBlessing(Boolean(hasTreeBlessing && !visitingFriend));
    scene.setOnTreeTouch((payload: TreeTouchPayload) => {
      audioEngine.playTreeTouchSparkle(payload.boosted);
      triggerHapticFeedback(payload.boosted ? [14, 36, 20] : 10);
      setTreeTouchNotice({
        key: Date.now(),
        boosted: payload.boosted,
        text: payload.boosted
          ? 'Ánh sáng Deep Work lan tỏa · Mưa lá vàng rực rỡ'
          : 'Cây tâm trí phát sáng · Lá rơi nhẹ nhàng',
      });
      if (touchFeedbackTimerRef.current) window.clearTimeout(touchFeedbackTimerRef.current);
      touchFeedbackTimerRef.current = window.setTimeout(() => setTreeTouchNotice(null), 2600);
      if (payload.boosted) {
        consumeBlessingRef.current?.();
      }
    });
    xpMotionProgress.jump(xpState.progress);
    scene.setSpringArcProgress(xpState.progress);
    scene.setXpProgress(xpState.progress, xpState.meta, { syncExternalSpring: true });
    sceneRef.current = scene;
    prevLevelRef.current = displayLevel;

    const unsubscribe = xpSpringProgress.on('change', (latest) => {
      sceneRef.current?.setSpringArcProgress(latest);
    });

    return () => {
      unsubscribe();
      if (xpGainTimerRef.current) window.clearTimeout(xpGainTimerRef.current);
      if (touchFeedbackTimerRef.current) window.clearTimeout(touchFeedbackTimerRef.current);
      scene.setOnTreeTouch(undefined);
      scene.dispose();
      sceneRef.current = null;
    };
    // Mount once for the 3D view; subsequent updates use imperative methods below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    if (prevLevelRef.current !== displayLevel) {
      sceneRef.current.setLevel(displayLevel, true);
      prevLevelRef.current = displayLevel;
    }
  }, [displayLevel]);

  useEffect(() => {
    const leveledUp = !visitingFriend && user.level > prevUserLevelRef.current;
    const xpGained = !visitingFriend && user.xp > prevUserXpRef.current;

    if (!visitingFriend && (leveledUp || xpGained)) {
      const gainedAmount = leveledUp ? Math.max(10, user.xp) : user.xp - prevUserXpRef.current;
      if (gainedAmount > 0 && displayLevel === user.level) {
        setXpGainDelta(gainedAmount);
        if (xpGainTimerRef.current) window.clearTimeout(xpGainTimerRef.current);
        xpGainTimerRef.current = window.setTimeout(() => setXpGainDelta(null), 2600);
        sceneRef.current?.triggerXpGainPulse();
      }
      if (leveledUp) {
        xpMotionProgress.jump(0);
      }
    }

    prevUserXpRef.current = user.xp;
    prevUserLevelRef.current = user.level;

    xpMotionProgress.set(xpState.progress);
    sceneRef.current?.setXpProgress(xpState.progress, xpState.meta, { syncExternalSpring: true });
  }, [
    xpState.progress,
    xpState.meta.currentXp,
    xpState.meta.maxXp,
    xpState.meta.level,
    xpState.meta.isMaxLevel,
    xpState.meta.isCompletedStage,
    displayLevel,
    visitingFriend,
    user.xp,
    user.level,
    xpMotionProgress,
  ]);

  useEffect(() => {
    const activeMeta = WEATHER_OPTIONS.find((opt) => opt.id === weather);
    if (activeMeta && displayLevel < activeMeta.minLevel) {
      setWeather('clear');
    }
  }, [displayLevel, weather]);

  useEffect(() => {
    sceneRef.current?.setWeather(weather);
  }, [weather]);

  useEffect(() => {
    sceneRef.current?.updateSkyTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (rainTriggerKey > 0) {
      sceneRef.current?.triggerRainShower();
    }
  }, [rainTriggerKey]);

  useEffect(() => {
    sceneRef.current?.setPostDeepWorkBlessing(Boolean(hasTreeBlessing && !visitingFriend));
  }, [hasTreeBlessing, visitingFriend]);

  const handleTriggerRain = () => {
    sceneRef.current?.triggerRainShower();
    onRainEffect();
  };

  return (
    <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden bg-slate-950">
      {/* Isolated WebGL Canvas Container — touch-none prevents page scroll during 3D orbit */}
      <div ref={mountRef} className="w-full h-full absolute inset-0 touch-none" />

      {/* Zen Mode Restore Button */}
      {zenMode && (
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={() => setZenMode(false)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-slate-950/70 border border-white/15 text-xs font-semibold text-white shadow-lg hover:bg-slate-900/90 transition-colors"
            title="Hiện lại bảng điều khiển"
          >
            <Eye className="w-4 h-4 text-emerald-300" />
            <span>Hiện HUD</span>
          </button>
        </div>
      )}

      {/* Slim Non-Occluding Top HUD + Camera Bar */}
      {!zenMode && (
        <div className="absolute top-2.5 inset-x-2.5 sm:top-3.5 sm:inset-x-4 z-10 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          {/* Compact Top-Left Tree Badge */}
          <div className="pointer-events-auto flex flex-col items-start gap-1.5">
            <div className="w-[256px] sm:w-[288px] rounded-xl bg-slate-950/65 backdrop-blur-md border border-white/15 px-3 py-2 text-white shadow-lg">
              {visitingFriend ? (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="font-display text-xs sm:text-sm font-bold truncate">
                      {visitingFriend.treeName}
                    </span>
                    <button
                      type="button"
                      onClick={onExitVisit}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-white whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Về vườn
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {visitingFriend.fullname} · Lv.{visitingFriend.level}/10
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-xs sm:text-sm font-bold truncate">
                      {user.treeName}
                    </span>
                    <span className="font-mono-num text-[11px] sm:text-xs font-bold text-emerald-300 whitespace-nowrap shrink-0">
                      Cấp {displayLevel}/10 · {xpState.meta.isMaxLevel ? 'MAX' : `${xpPercent}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-200 font-mono-num">
                    <span className="whitespace-nowrap">Rồng {dragonLevel}/5</span>
                    <span className="font-semibold text-emerald-300 whitespace-nowrap shrink-0">
                      {user.seedPoints.toLocaleString('vi-VN')} mầm
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Quick Summary Card ('Tóm tắt nhanh') */}
            {!visitingFriend && (
              <div className="w-[256px] sm:w-[288px] rounded-xl bg-slate-950/65 backdrop-blur-md border border-white/15 px-3 py-2 text-white shadow-lg space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {goalReached ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Target className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    )}
                    <span className="font-display text-xs font-bold whitespace-nowrap">Tóm tắt nhanh</span>
                  </div>
                  <button
                    type="button"
                    onClick={cycleDailyGoal}
                    title="Nhấn để đổi mục tiêu tập trung mỗi ngày"
                    className="font-mono-num text-[11px] font-semibold text-sky-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Mục tiêu: {activeGoal.label}
                  </button>
                </div>

                <div className="flex items-baseline justify-between gap-2 text-[11px] font-mono-num">
                  <span className="text-slate-200">
                    Hôm nay:{' '}
                    <strong className="text-white">
                      {todaySessions}/{activeGoal.sessions} phiên
                    </strong>
                  </span>
                  <span className={goalReached ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                    {user.todayFocusMins}/{activeGoal.mins}p
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-white/12 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, goalPct)}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                    className={`h-full rounded-full ${goalReached ? 'bg-emerald-400' : 'aurora-xp-fill'}`}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={goalReached ? 'text-emerald-300 font-semibold truncate' : 'text-slate-300 truncate'}>
                    {goalReached
                      ? 'Đã đạt mục tiêu hôm nay!'
                      : `Cần thêm ${remainingSessions > 0 ? `${remainingSessions} phiên` : `${remainingMins} phút`}`}
                  </span>
                  <span className="font-mono-num font-bold text-emerald-300 shrink-0">{goalPct}%</span>
                </div>
              </div>
            )}

            {/* Incoming Group Study Room Invite Banner */}
            <AnimatePresence>
              {!visitingFriend && incomingRoomInvites.length > 0 && onJoinRoomInvite && (
                <motion.button
                  key={`home-room-invite-${incomingRoomInvites[0].id}`}
                  type="button"
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onJoinRoomInvite(incomingRoomInvites[0])}
                  className="w-[256px] sm:w-[288px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-sky-600/88 backdrop-blur-md border border-sky-300/50 text-white text-left shadow-lg hover:bg-sky-500/90 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-sky-100 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">
                        {incomingRoomInvites[0].hostName} mời học nhóm
                      </div>
                      <div className="text-[10px] text-sky-100 truncate">
                        {incomingRoomInvites[0].title}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold underline whitespace-nowrap shrink-0">
                    Vào ngay
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {hasTreeBlessing && !visitingFriend && (
                <motion.button
                  key="tree-blessing-hint"
                  type="button"
                  initial={{ opacity: 0, y: 6, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.94 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => sceneRef.current?.triggerTreeTouchEffect()}
                  className="w-[256px] sm:w-[288px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/22 backdrop-blur-md border border-amber-300/45 text-amber-100 text-[11px] font-semibold shadow-lg hover:bg-amber-500/32 transition-colors text-left"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate">Chạm vào cây 3D để đón ánh sáng &amp; lá rơi</span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {xpGainDelta !== null && (
                <motion.div
                  key={`xp-gain-${xpGainDelta}-${user.xp}`}
                  initial={{ opacity: 0, y: 10, scale: 0.72 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/90 text-white text-xs font-bold font-mono-num shadow-lg border border-emerald-300/60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+{xpGainDelta} XP · Vòng năng lượng 3D</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {treeTouchNotice && (
                <motion.div
                  key={`tree-touch-${treeTouchNotice.key}`}
                  initial={{ opacity: 0, y: 8, scale: 0.88 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-lg border ${
                    treeTouchNotice.boosted
                      ? 'bg-amber-500/90 text-slate-950 border-amber-200/80'
                      : 'bg-emerald-600/88 text-white border-emerald-300/50'
                  }`}
                >
                  <Leaf className="w-3.5 h-3.5 shrink-0" />
                  <span>{treeTouchNotice.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Compact Top-Right Camera & Focus Bar */}
          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0 ml-auto">
            <div className="flex items-center gap-0.5 rounded-xl bg-slate-950/65 border border-white/15 p-1 text-white shadow-lg">
              <button
                type="button"
                onClick={() => sceneRef.current?.adjustZoom(-0.18)}
                title="Phóng to"
                aria-label="Phóng to"
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => sceneRef.current?.adjustZoom(0.2)}
                title="Thu nhỏ"
                aria-label="Thu nhỏ"
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => sceneRef.current?.setCameraPreset('canopy')}
                title="Ngắm tán cây"
                aria-label="Ngắm tán cây"
                className="hidden sm:flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
              >
                <Compass className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => sceneRef.current?.setCameraPreset('reset')}
                title="Góc nhìn mặc định"
                aria-label="Đặt lại góc nhìn"
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleTriggerRain}
                title="Gọi cơn mưa dưỡng chất 3D"
                aria-label="Gọi cơn mưa 3D"
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-lg hover:bg-white/15 text-sky-300 transition-colors"
              >
                <CloudRain className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZenMode(true)}
                title="Ẩn giao diện để ngắm cây toàn màn hình"
                aria-label="Ẩn giao diện"
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              onClick={onStartFocus}
              className="aurora-accent-btn min-h-[40px] sm:min-h-[42px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg hover:opacity-95 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Deep Work</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Ultra-Slim Collapsible Bottom Zen Bar (Collapsed by default so 3D tree & island are unobstructed) */}
      {!zenMode && (
        <div className="absolute bottom-[calc(4.4rem+env(safe-area-inset-bottom))] lg:bottom-3 inset-x-2.5 sm:inset-x-4 z-10 pointer-events-none flex justify-center">
          <div className="pointer-events-auto max-w-2xl w-full rounded-2xl bg-slate-950/72 border border-white/15 text-white shadow-xl overflow-hidden">
            {/* Expandable Tabbed Drawer (Single compact row to avoid covering trunk/island) */}
            <AnimatePresence initial={false}>
              {dockExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="border-b border-white/10 overflow-hidden"
                >
                <div className="px-3 pt-2 pb-1.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDockTab('weather')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                        dockTab === 'weather' ? 'bg-white/18 text-white' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-300" />
                      <span>Thời tiết</span>
                    </button>
                    {!visitingFriend && (
                      <button
                        type="button"
                        onClick={() => setDockTab('levels')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                          dockTab === 'levels' ? 'bg-white/18 text-white' : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Tiến hóa 1–10</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-300 truncate min-w-0 hidden sm:inline">
                    {stageMeta.tree} · {stageMeta.dragon}
                  </span>
                </div>

                {dockTab === 'weather' && (
                  <div className="px-3 pb-2.5 pt-1 flex items-center gap-1.5 overflow-x-auto">
                    {WEATHER_OPTIONS.map((opt) => {
                      const unlocked = displayLevel >= opt.minLevel;
                      const active = weather === opt.id;
                      const Icon =
                        opt.id === 'sunlight'
                          ? Sun
                          : opt.id === 'rain'
                            ? CloudRain
                            : opt.id === 'autumn'
                              ? Leaf
                              : opt.id === 'snow'
                                ? Snowflake
                                : Sparkles;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => setWeather(opt.id)}
                          title={
                            unlocked
                              ? opt.description
                              : `Đạt cây Cấp ${opt.minLevel} để mở khóa hiệu ứng ${opt.label}`
                          }
                          className={`min-h-[34px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'aurora-accent-btn text-white shadow-sm'
                              : unlocked
                                ? 'bg-white/10 text-slate-100 hover:bg-white/20'
                                : 'bg-white/5 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {unlocked ? <Icon className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{opt.label}</span>
                          {!unlocked && <span className="font-mono-num text-[11px] opacity-80">Lv.{opt.minLevel}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {dockTab === 'levels' && !visitingFriend && (
                  <div className="px-3 pb-2.5 pt-1 flex items-center gap-1.5 overflow-x-auto">
                    {STAGE_INFO.map((st) => {
                      const unlocked = isJudge || st.level <= user.level;
                      const active = displayLevel === st.level;
                      return (
                        <button
                          key={st.level}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => onSelectPreviewLevel(st.level)}
                          title={unlocked ? `${st.tree} · ${st.dragon}` : `Đạt cấp ${st.level} để mở khóa`}
                          className={`min-h-[34px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'aurora-accent-btn text-white shadow-sm'
                              : unlocked
                                ? 'bg-white/10 text-slate-200 hover:bg-white/20'
                                : 'bg-white/5 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {!unlocked && <Lock className="w-3 h-3" />}
                          <span className="font-mono-num">Cấp {st.level}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slim Single-Line Footer Bar */}
            <div className="px-3 py-1.5 flex items-center justify-between gap-2.5">
              <p className="text-xs font-medium text-slate-100 truncate min-w-0 flex-1">
                {stageMeta.tree} · {stageMeta.dragon}
              </p>
              <button
                type="button"
                onClick={() => setDockExpanded((v) => !v)}
                className="min-h-[32px] inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{dockExpanded ? 'Thu gọn' : 'Thời tiết & Cấp'}</span>
                {dockExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
