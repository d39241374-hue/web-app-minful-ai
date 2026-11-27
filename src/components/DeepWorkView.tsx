import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bell,
  BellRing,
  Brain,
  Check,
  CheckCircle2,
  CloudRain,
  Crown,
  Headphones,
  LogOut,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
  Volume2,
  Waves,
  Wind,
} from 'lucide-react';
import { getDragonXpMultiplier } from '../constants';
import { audioEngine, triggerHapticFeedback } from '../utils/audio';
import { FocusWaveChart } from './FocusWaveChart';
import type {
  BinauralMode,
  DeepWorkSessionSummary,
  Friendship,
  LeaveEventLog,
  PublicGarden,
  StudyRoom,
  StudyRoomMember,
  StudyRoomMemberStatus,
  UserProfile,
  UserTask,
} from '../types';

interface DeepWorkViewProps {
  user: UserProfile;
  tasks: UserTask[];
  friendships: Friendship[];
  publicGardens: PublicGarden[];
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  selectedPresetMins: number;
  selectedTaskId: string;
  selectedCoStudyPairId: string;
  sessionIntention: string;
  binauralMode: BinauralMode;
  rainActive: boolean;
  leaveGuardEnabled: boolean;
  leaveSoundEnabled: boolean;
  leaveEvents: LeaveEventLog[];
  activeStudyRoom: StudyRoom | null;
  studyRoomMembers: StudyRoomMember[];
  incomingRoomInvites: StudyRoom[];
  isGroupCoStudyBonus: boolean;
  onCreateStudyRoom: (title: string, invitedUids: string[]) => Promise<void> | void;
  onJoinStudyRoom: (room: StudyRoom) => Promise<void> | void;
  onInviteMoreToRoom: (newFriendUids: string[]) => Promise<void> | void;
  onLeaveOrEndStudyRoom: () => Promise<void> | void;
  onSelectPreset: (mins: number, isDemo?: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onSelectCoStudy: (pairId: string) => void;
  onChangeIntention: (val: string) => void;
  onToggleStart: () => void;
  onReset: () => void;
  onChangeBinaural: (mode: BinauralMode) => void;
  onToggleRain: () => void;
  onToggleLeaveGuard: () => void;
  onToggleLeaveSound: () => void;
  onTestLeaveAlert: () => void;
  onRequestBrowserNotif: () => void;
  lastCompletedSession?: DeepWorkSessionSummary | null;
  onOpenReflection?: () => void;
}

type BreathPhase = {
  key: 'inhale' | 'hold' | 'exhale';
  label: string;
  secs: number;
};

const BREATH_CYCLE: BreathPhase[] = [
  { key: 'inhale', label: 'Hít vào', secs: 4 },
  { key: 'hold', label: 'Giữ hơi', secs: 7 },
  { key: 'exhale', label: 'Thở ra', secs: 8 },
];

const MEMBER_STATUS_META: Record<
  StudyRoomMemberStatus | 'invited',
  { label: string; dotClass: string; textClass: string; cardBorder: string }
> = {
  focusing: {
    label: 'Đang tập trung',
    dotClass: 'bg-emerald-500 animate-pulse',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    cardBorder: 'border-emerald-500/35 bg-emerald-500/[0.06]',
  },
  ready: {
    label: 'Sẵn sàng',
    dotClass: 'bg-sky-500',
    textClass: 'text-sky-700 dark:text-sky-300',
    cardBorder: 'border-sky-500/30 bg-sky-500/[0.05]',
  },
  paused: {
    label: 'Tạm dừng',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-300',
    cardBorder: 'border-amber-500/30 bg-amber-500/[0.05]',
  },
  away: {
    label: 'Rời tab',
    dotClass: 'bg-rose-500 animate-pulse',
    textClass: 'text-rose-700 dark:text-rose-300',
    cardBorder: 'border-rose-500/35 bg-rose-500/[0.06]',
  },
  completed: {
    label: 'Hoàn thành',
    dotClass: 'bg-violet-500',
    textClass: 'text-violet-700 dark:text-violet-300',
    cardBorder: 'border-violet-500/35 bg-violet-500/[0.06]',
  },
  left: {
    label: 'Đã rời phòng',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-500 dark:text-slate-400',
    cardBorder: 'border-slate-300/60 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/30 opacity-70',
  },
  invited: {
    label: 'Chờ vào phòng',
    dotClass: 'bg-amber-400',
    textClass: 'text-slate-600 dark:text-slate-300',
    cardBorder: 'border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/30',
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function DeepWorkView({
  user,
  tasks,
  friendships,
  publicGardens,
  secondsLeft,
  totalSeconds,
  isRunning,
  selectedPresetMins,
  selectedTaskId,
  selectedCoStudyPairId,
  sessionIntention,
  binauralMode,
  rainActive,
  leaveGuardEnabled,
  leaveSoundEnabled,
  leaveEvents,
  activeStudyRoom,
  studyRoomMembers,
  incomingRoomInvites,
  isGroupCoStudyBonus,
  onCreateStudyRoom,
  onJoinStudyRoom,
  onInviteMoreToRoom,
  onLeaveOrEndStudyRoom,
  onSelectPreset,
  onSelectTask,
  onSelectCoStudy,
  onChangeIntention,
  onToggleStart,
  onReset,
  onChangeBinaural,
  onToggleRain,
  onToggleLeaveGuard,
  onToggleLeaveSound,
  onTestLeaveAlert,
  onRequestBrowserNotif,
  lastCompletedSession = null,
  onOpenReflection,
}: DeepWorkViewProps) {
  const [focusFullscreen, setFocusFullscreen] = useState(false);
  const [volume, setVolume] = useState(0.08);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathIndex, setBreathIndex] = useState(0);
  const [breathCountdown, setBreathCountdown] = useState(4);
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mindful_haptic_enabled') !== '0';
    } catch {
      return true;
    }
  });
  const [hapticPulseKey, setHapticPulseKey] = useState(0);

  // Row 3 Bento Mode: Focus Wave vs Group Study Session
  const [bottomPanel, setBottomPanel] = useState<'wave' | 'group'>(() =>
    activeStudyRoom || incomingRoomInvites.length > 0 ? 'group' : 'wave',
  );
  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [selectedInviteUids, setSelectedInviteUids] = useState<string[]>([]);
  const [showInviteMore, setShowInviteMore] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);

  // Auto-open Group Study tab when joining/creating a room or receiving an invite
  useEffect(() => {
    if (activeStudyRoom || incomingRoomInvites.length > 0) {
      setBottomPanel('group');
    }
  }, [activeStudyRoom?.id, incomingRoomInvites.length]);

  useEffect(() => {
    if (!activeStudyRoom) {
      setShowInviteMore(false);
    }
  }, [activeStudyRoom]);

  const startHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusFullscreen) {
        setFocusFullscreen(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusFullscreen((v) => !v);
        return;
      }
      if (e.code === 'Space') {
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        startHandlerRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusFullscreen]);

  useEffect(() => {
    if (!breathingActive) return;
    let stepIdx = 0;
    let left = BREATH_CYCLE[0].secs;
    setBreathIndex(0);
    setBreathCountdown(left);

    const timer = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        stepIdx = (stepIdx + 1) % BREATH_CYCLE.length;
        left = BREATH_CYCLE[stepIdx].secs;
        setBreathIndex(stepIdx);
      }
      setBreathCountdown(left);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [breathingActive]);

  const currentBreath = BREATH_CYCLE[breathIndex];
  const breathProgress =
    1 - Math.max(0, Math.min(1, (breathCountdown - 1) / Math.max(1, currentBreath.secs)));

  const isJudge = user.role === 'judge';
  const isRoomHost = activeStudyRoom ? activeStudyRoom.hostUid === user.uid : true;
  const isNonHostInRoom = Boolean(activeStudyRoom && !isRoomHost);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const activeTask = pendingTasks.find((t) => t.id === selectedTaskId);
  const hasCoStudyMultiplier = Boolean(selectedCoStudyPairId || isGroupCoStudyBonus);
  const mult = getDragonXpMultiplier(user) + (hasCoStudyMultiplier ? 0.15 : 0);
  const estMins = totalSeconds === 10 ? 25 : Math.max(1, Math.round(totalSeconds / 60));
  const estXp = Math.round(estMins * 4 * mult);
  const estSeeds = Math.round(estMins * 2);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const clockStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progressRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, (totalSeconds - secondsLeft) / totalSeconds)) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const svgRadius = 104;
  const svgCircumference = 2 * Math.PI * svgRadius;
  const svgDashOffset = svgCircumference * (1 - progressRatio);
  const tipAngleRad = -Math.PI / 2 + progressRatio * Math.PI * 2;
  const tipX = 120 + Math.cos(tipAngleRad) * svgRadius;
  const tipY = 120 + Math.sin(tipAngleRad) * svgRadius;

  const notifStatus =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

  const friendOptions = friendships.map((f) => {
    const peerUid = f.uidA === user.uid ? f.uidB : f.uidA;
    const garden = publicGardens.find((g) => g.uid === peerUid);
    return {
      pairId: f.id,
      uid: peerUid,
      name: garden ? `${garden.fullname} (${garden.className})` : `Bạn học (${peerUid.slice(0, 6)})`,
      days: f.days,
    };
  });

  // Candidate classmates/friends to invite to Group Study Room (accepted friends first, then public classmates)
  const inviteCandidates = useMemo(() => {
    const friendUids = new Set<string>();
    const list: Array<{ uid: string; name: string; className: string; isFriend: boolean }> = [];

    friendships.forEach((f) => {
      const peerUid = f.uidA === user.uid ? f.uidB : f.uidA;
      if (peerUid === user.uid || friendUids.has(peerUid)) return;
      friendUids.add(peerUid);
      const garden = publicGardens.find((g) => g.uid === peerUid);
      list.push({
        uid: peerUid,
        name: garden?.fullname || `Bạn học (${peerUid.slice(0, 6)})`,
        className: garden?.className || 'Bạn bè',
        isFriend: true,
      });
    });

    publicGardens.forEach((g) => {
      if (g.uid === user.uid || friendUids.has(g.uid)) return;
      friendUids.add(g.uid);
      list.push({
        uid: g.uid,
        name: g.fullname,
        className: g.className,
        isFriend: false,
      });
    });

    return list;
  }, [friendships, publicGardens, user.uid]);

  const activeRoomRoster = useMemo(() => {
    if (!activeStudyRoom) return [];
    return activeStudyRoom.participantUids.map((pUid) => {
      const member = studyRoomMembers.find((m) => m.uid === pUid);
      const garden = publicGardens.find((g) => g.uid === pUid);
      const isMe = pUid === user.uid;
      const isHost = pUid === activeStudyRoom.hostUid;
      const fullname =
        member?.fullname ||
        (isMe ? user.fullname : garden?.fullname || (isHost ? activeStudyRoom.hostName : `Bạn học ${pUid.slice(0, 5)}`));
      const className = member?.className || (isMe ? user.className : garden?.className || 'Học sinh');
      const level = member?.level || (isMe ? user.level : garden?.level || 1);
      const status: StudyRoomMemberStatus | 'invited' = member ? member.status : 'invited';
      const intention = member?.intention || (isMe ? sessionIntention.trim() : '');
      return {
        uid: pUid,
        fullname,
        className,
        level,
        isMe,
        isHost,
        status,
        intention,
      };
    });
  }, [activeStudyRoom, studyRoomMembers, publicGardens, user, sessionIntention]);

  const remainingSlots = activeStudyRoom ? Math.max(0, 8 - activeStudyRoom.participantUids.length) : 7;
  const uninvitedCandidates = activeStudyRoom
    ? inviteCandidates.filter((c) => !activeStudyRoom.participantUids.includes(c.uid))
    : inviteCandidates;

  const presets = [
    { id: 'p15', shortLabel: '15p', mins: 15, demo: false },
    { id: 'p25', shortLabel: '25p', mins: 25, demo: false },
    { id: 'p45', shortLabel: '45p', mins: 45, demo: false },
    { id: 'p60', shortLabel: '60p', mins: 60, demo: false },
    ...(isJudge ? [{ id: 'demo10', shortLabel: '10s', mins: 0, demo: true }] : []),
  ];

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    audioEngine.setVolume(val);
  };

  const toggleHaptic = () => {
    setHapticEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mindful_haptic_enabled', next ? '1' : '0');
      } catch {
        // ignore storage error
      }
      if (next) {
        triggerHapticFeedback(12);
        audioEngine.playTactilePress('tick');
      }
      return next;
    });
  };

  const handleStartWithHaptic = () => {
    if (isNonHostInRoom) return;
    if (hapticEnabled) {
      triggerHapticFeedback(isRunning ? 12 : [14, 24, 10]);
      audioEngine.playTactilePress(isRunning ? 'pause' : 'start');
      setHapticPulseKey((k) => k + 1);
    }
    onToggleStart();
  };
  startHandlerRef.current = handleStartWithHaptic;

  const handleResetWithHaptic = () => {
    if (isNonHostInRoom) return;
    if (hapticEnabled) {
      triggerHapticFeedback(10);
      audioEngine.playTactilePress('reset');
    }
    onReset();
  };

  const handleSelectPresetWithTick = (minsVal: number, isDemo?: boolean) => {
    if (isNonHostInRoom) return;
    if (hapticEnabled) {
      triggerHapticFeedback(8);
      audioEngine.playTactilePress('tick');
    }
    onSelectPreset(minsVal, isDemo);
  };

  const toggleInviteUid = (uid: string) => {
    const maxSelect = activeStudyRoom ? remainingSlots : 7;
    setSelectedInviteUids((prev) => {
      if (prev.includes(uid)) {
        return prev.filter((id) => id !== uid);
      }
      if (prev.length >= maxSelect) {
        return prev;
      }
      return [...prev, uid];
    });
  };

  const handleCreateRoomSubmit = async () => {
    if (roomBusy) return;
    setRoomBusy(true);
    try {
      if (hapticEnabled) {
        triggerHapticFeedback(12);
        audioEngine.playTactilePress('start');
      }
      const fallbackTitle = sessionIntention.trim() || `Phiên học nhóm ${estMins}p`;
      await onCreateStudyRoom(roomTitleInput.trim() || fallbackTitle, selectedInviteUids);
      setRoomTitleInput('');
      setSelectedInviteUids([]);
    } finally {
      setRoomBusy(false);
    }
  };

  const handleInviteMoreSubmit = async () => {
    if (roomBusy || selectedInviteUids.length === 0) return;
    setRoomBusy(true);
    try {
      await onInviteMoreToRoom(selectedInviteUids);
      setSelectedInviteUids([]);
      setShowInviteMore(false);
    } finally {
      setRoomBusy(false);
    }
  };

  const statusHeadline = activeStudyRoom
    ? isRunning
      ? `Học nhóm · ${activeRoomRoster.filter((m) => m.status !== 'left' && m.status !== 'invited').length} thành viên`
      : isRoomHost
        ? `Phòng nhóm · Sẵn sàng ${estMins}p`
        : `Đồng bộ · Host ${activeStudyRoom.hostName}`
    : isRunning
      ? leaveGuardEnabled
        ? 'Đang tập trung · Bảo vệ bật'
        : 'Đang tập trung sâu'
      : totalSeconds === 10
        ? 'Chế độ Demo BGK'
        : progressRatio > 0 && progressRatio < 1
          ? 'Đang tạm dừng phiên'
          : `Sẵn sàng · ${selectedPresetMins} phút`;

  return (
    <div
      className={
        focusFullscreen
          ? 'fixed inset-0 z-50 aurora-surface p-4 sm:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col items-center justify-center overflow-y-auto'
          : 'max-w-7xl w-full mx-auto lg:h-full lg:flex-1 lg:overflow-hidden min-h-0 flex flex-col gap-2.5'
      }
    >
      {/* Top Studio Header Bar */}
      {!focusFullscreen && (
        <header className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-bold text-[#0f162b] dark:text-white tracking-tight text-balance truncate">
              Phòng Học Tập Trung Deep Work
            </h1>
            {activeStudyRoom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Học nhóm ({activeStudyRoom.participantUids.length}/8)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold font-mono-num text-slate-700 dark:text-slate-200">
              <span>{mult.toFixed(2)}x XP</span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-emerald-700 dark:text-emerald-400">Hôm nay {user.todayFocusMins}p</span>
              <span aria-hidden="true" className="text-slate-400 hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline text-sky-600 dark:text-sky-400">Chuỗi {user.streakDays} ngày</span>
            </div>

            <button
              type="button"
              onClick={toggleHaptic}
              aria-pressed={hapticEnabled}
              title="Bật hoặc tắt phản hồi rung và âm nhấn xúc giác"
              className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                hapticEnabled
                  ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hapticEnabled ? 'Rung: Bật' : 'Rung: Tắt'}</span>
            </button>

            <button
              type="button"
              onClick={() => setFocusFullscreen(true)}
              title="Mở chế độ tập trung toàn màn hình (Phím F)"
              aria-label="Toàn màn hình"
              className="min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Toàn màn hình</span>
            </button>
          </div>
        </header>
      )}

      {/* Unified Bento Control Grid — Zero-Scroll Desktop Workspace */}
      <div
        className={`grid gap-3 flex-1 min-h-0 ${
          focusFullscreen ? 'max-w-2xl w-full' : 'lg:grid-cols-12 items-stretch'
        }`}
      >
        {/* LEFT DECK (5 cols): Dedicated Chronometer, Presets & Tactile Execution */}
        <section
          className={`${
            focusFullscreen ? '' : 'lg:col-span-5'
          } led-frame glass-panel relative rounded-3xl p-4 flex flex-col justify-between gap-2.5 min-h-0`}
        >
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />

          {/* Top Bar inside Timer Card: Duration Presets + Reward Preview (or Collapse in Fullscreen) */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div
              role="group"
              aria-label="Chọn thời lượng tập trung"
              className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-200/75 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/70 overflow-x-auto max-w-full"
            >
              {presets.map((p) => {
                const active = p.demo ? totalSeconds === 10 : selectedPresetMins === p.mins && totalSeconds !== 10;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isRunning || isNonHostInRoom}
                    onClick={() => handleSelectPresetWithTick(p.mins, p.demo)}
                    aria-pressed={active}
                    className={`relative min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                      active
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="deepworkPresetIndicator"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg aurora-accent-btn shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{p.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {focusFullscreen ? (
              <button
                type="button"
                onClick={() => setFocusFullscreen(false)}
                title="Thu gọn về bố cục phòng học (Esc)"
                className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Thu gọn</span>
              </button>
            ) : (
              <div className="text-right font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                +{estXp} XP · +{estSeeds} mầm
              </div>
            )}
          </div>

          {/* Fullscreen Editable Intention Banner */}
          {focusFullscreen && (
            <div className="shrink-0">
              <input
                type="text"
                value={sessionIntention}
                onChange={(e) => onChangeIntention(e.target.value)}
                maxLength={140}
                placeholder="Mục tiêu phiên học (VD: Giải 5 câu Tích phân)..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 text-sm text-center font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          )}

          {/* Luminous Aurora Chronometer — Spacious Focal Anchor */}
          <div className="relative flex flex-col items-center justify-center flex-1 min-h-0 py-1">
            <AnimatePresence>
              {hapticPulseKey > 0 && (
                <motion.div
                  key={`dial-pulse-${hapticPulseKey}`}
                  initial={{ scale: 0.88, opacity: 0.65 }}
                  animate={{ scale: 1.22, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className={`pointer-events-none absolute rounded-full border-2 border-emerald-400/70 ${
                    focusFullscreen ? 'w-60 h-60 sm:w-72 sm:h-72' : 'w-48 h-48 sm:w-52 sm:h-52 xl:w-56 xl:h-56'
                  }`}
                />
              )}
            </AnimatePresence>

            <motion.div
              animate={hapticPulseKey > 0 ? { scale: [1, 0.975, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={`deepwork-clock-shell aspect-square shrink-0 ${
                focusFullscreen ? 'w-60 h-60 sm:w-72 sm:h-72' : 'w-44 h-44 sm:w-52 sm:h-52 xl:w-56 xl:h-56'
              } flex items-center justify-center ${isRunning ? 'is-running' : ''}`}
            >
              <div className="deepwork-aurora-glow" />
              <div className="deepwork-aurora-ring" />

              <div className="relative z-10 w-[calc(100%-12px)] h-[calc(100%-12px)] rounded-full bg-white/95 dark:bg-slate-950/92 flex items-center justify-center shadow-inner">
                <svg
                  viewBox="0 0 240 240"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="deepworkArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="50%" stopColor="#0EA5E9" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>

                  {Array.from({ length: 24 }).map((_, i) => {
                    const ang = (i / 24) * Math.PI * 2;
                    const isMajor = i % 6 === 0;
                    const r1 = isMajor ? 92 : 95;
                    const r2 = 99;
                    return (
                      <line
                        key={i}
                        x1={120 + Math.cos(ang) * r1}
                        y1={120 + Math.sin(ang) * r1}
                        x2={120 + Math.cos(ang) * r2}
                        y2={120 + Math.sin(ang) * r2}
                        stroke="currentColor"
                        strokeWidth={isMajor ? 2 : 1.2}
                        className={
                          isMajor
                            ? 'text-slate-400/75 dark:text-slate-500/80'
                            : 'text-slate-300/65 dark:text-slate-700/75'
                        }
                      />
                    );
                  })}

                  <circle
                    cx="120"
                    cy="120"
                    r={svgRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-200/75 dark:text-slate-800/80"
                  />

                  <circle
                    cx="120"
                    cy="120"
                    r={svgRadius}
                    fill="none"
                    stroke="url(#deepworkArcGrad)"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeDasharray={svgCircumference}
                    strokeDashoffset={svgDashOffset}
                    transform="rotate(-90 120 120)"
                    style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />

                  {progressRatio > 0.01 && (
                    <circle
                      cx={tipX}
                      cy={tipY}
                      r="5"
                      fill="#38BDF8"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      style={{
                        transition:
                          'cx 0.55s cubic-bezier(0.16, 1, 0.3, 1), cy 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  )}
                </svg>

                <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight max-w-[155px] truncate">
                    {statusHeadline}
                  </span>
                  <div
                    aria-live="off"
                    className={`font-mono-num font-extrabold tracking-tight text-slate-900 dark:text-white my-0.5 ${
                      focusFullscreen ? 'text-4xl sm:text-5xl' : 'text-4xl xl:text-[2.75rem]'
                    }`}
                  >
                    {clockStr}
                  </div>
                  <div className="text-[11px] font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                    {progressPercent}% hoàn thành
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Active Goal Readout Strip inside Chronometer Card */}
          {!focusFullscreen && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/65 border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="text-slate-600 dark:text-slate-300 truncate">
                <strong className="text-slate-900 dark:text-white">Mục tiêu:</strong>{' '}
                {sessionIntention.trim() || activeTask?.text || 'Tập trung tự do'}
              </span>
              {hasCoStudyMultiplier && (
                <span className="font-mono-num font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap shrink-0">
                  Co-Study +15%
                </span>
              )}
            </div>
          )}

          {/* Primary Action Buttons with Haptic Feedback Simulation */}
          {isNonHostInRoom && activeStudyRoom ? (
            <div className="grid grid-cols-12 gap-2 shrink-0">
              <div className="col-span-8 min-h-[44px] px-3 py-2 rounded-xl border border-sky-500/35 bg-sky-500/10 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-sky-800 dark:text-sky-200">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
                <span className="truncate">
                  {isRunning
                    ? `Đang chạy cùng ${activeStudyRoom.hostName}`
                    : `Chờ ${activeStudyRoom.hostName} bấm chạy`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onLeaveOrEndStudyRoom()}
                className="col-span-4 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Rời phòng</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2 shrink-0">
              <motion.button
                type="button"
                onClick={handleStartWithHaptic}
                title="Bắt đầu / Tạm dừng (Phím Space)"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.94 }}
                animate={
                  hapticPulseKey > 0
                    ? {
                        x: [0, -2.5, 2.5, -1.5, 1.5, 0],
                        scale: [1, 0.965, 1.02, 1],
                      }
                    : { x: 0, scale: 1 }
                }
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden col-span-8 aurora-accent-btn min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-95 whitespace-nowrap"
              >
                {hapticPulseKey > 0 && (
                  <motion.span
                    key={`btn-ripple-${hapticPulseKey}`}
                    initial={{ scale: 0.2, opacity: 0.6 }}
                    animate={{ scale: 2.3, opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-0 m-auto w-24 h-24 rounded-full bg-white/35"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-2">
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>
                    {activeStudyRoom
                      ? isRunning
                        ? 'Tạm dừng nhóm'
                        : progressRatio > 0
                          ? 'Tiếp tục nhóm'
                          : 'Bắt đầu cùng nhóm'
                      : isRunning
                        ? 'Tạm dừng'
                        : progressRatio > 0
                          ? 'Tiếp tục'
                          : 'Bắt đầu tập trung'}
                  </span>
                </span>
              </motion.button>

              <motion.button
                type="button"
                onClick={handleResetWithHaptic}
                whileTap={{ scale: 0.95 }}
                className="col-span-4 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </motion.button>
            </div>
          )}

          {/* Fullscreen Quick Controls */}
          {focusFullscreen && (
            <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleRain}
                aria-pressed={rainActive}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  rainActive
                    ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CloudRain className="w-4 h-4" />
                <span>{rainActive ? 'Tắt mưa rừng' : 'Mưa rừng'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleLeaveGuard}
                aria-pressed={leaveGuardEnabled}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  leaveGuardEnabled
                    ? 'border-emerald-500/60 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {leaveGuardEnabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                <span>{leaveGuardEnabled ? 'Bảo vệ: Bật' : 'Bảo vệ: Tắt'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBreathingActive((v) => !v)}
                aria-pressed={breathingActive}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  breathingActive
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Wind className="w-4 h-4" />
                <span>
                  {breathingActive ? `${currentBreath.label} · ${breathCountdown}s` : 'Nhịp thở 4-7-8'}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleHaptic}
                aria-pressed={hapticEnabled}
                className={`min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  hapticEnabled
                    ? 'border-indigo-500/50 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Waves className="w-4 h-4" />
                <span>{hapticEnabled ? 'Rung: Bật' : 'Rung: Tắt'}</span>
              </button>
            </div>
          )}
        </section>

        {/* RIGHT DECK (7 cols): Cohesive 3-Row Bento Grid */}
        {!focusFullscreen && (
          <aside className="lg:col-span-7 flex flex-col gap-2.5 min-h-0">
            {/* BENTO ROW 1: Session Goal, Task Link & Co-Study Card */}
            <section className="glass-panel rounded-2xl p-3 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Target className="w-4 h-4 text-emerald-500 shrink-0" />
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                    Mục tiêu &amp; Nhiệm vụ phiên học
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lastCompletedSession && onOpenReflection && !isRunning && (
                    <button
                      type="button"
                      onClick={onOpenReflection}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
                    >
                      <Brain className="w-3 h-3" />
                      <span>Tự phản chiếu AI</span>
                    </button>
                  )}
                  {incomingRoomInvites.length > 0 && !activeStudyRoom && (
                    <button
                      type="button"
                      onClick={() => setBottomPanel('group')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 transition-colors whitespace-nowrap"
                    >
                      <Users className="w-3 h-3" />
                      <span>{incomingRoomInvites.length} lời mời học nhóm</span>
                    </button>
                  )}
                  {activeTask && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã gắn nhiệm vụ
                    </span>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <label htmlFor="deepwork-intention" className="sr-only">
                    Mục tiêu phiên học tập trung
                  </label>
                  <input
                    id="deepwork-intention"
                    type="text"
                    value={sessionIntention}
                    onChange={(e) => onChangeIntention(e.target.value)}
                    maxLength={140}
                    placeholder="Mục tiêu (VD: Giải 5 câu Tích phân)..."
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="deepwork-task-select" className="sr-only">
                    Chọn nhiệm vụ
                  </label>
                  <select
                    id="deepwork-task-select"
                    value={selectedTaskId}
                    onChange={(e) => onSelectTask(e.target.value)}
                    aria-label="Nhiệm vụ gắn với phiên"
                    className="w-full min-h-[36px] px-2.5 py-1.5 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">Nhiệm vụ: Tự do</option>
                    {pendingTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.text}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="deepwork-costudy-select" className="sr-only">
                    Học cùng bạn
                  </label>
                  <div className="relative flex items-center">
                    <Users className="w-3.5 h-3.5 text-sky-500 absolute left-2.5 pointer-events-none" />
                    <select
                      id="deepwork-costudy-select"
                      value={selectedCoStudyPairId}
                      onChange={(e) => onSelectCoStudy(e.target.value)}
                      disabled={Boolean(activeStudyRoom)}
                      aria-label="Chọn bạn học cùng Co-Study"
                      className="w-full min-h-[36px] pl-7 pr-2 py-1.5 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-60"
                    >
                      <option value="">{activeStudyRoom ? 'Đang học nhóm' : 'Học một mình'}</option>
                      {friendOptions.map((f) => (
                        <option key={f.pairId} value={f.pairId}>
                          {f.name} · {f.days}đ (+15%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* BENTO ROW 2: 2-Column Environment Controls (Guard + Breathing | Brainwave + Rain) */}
            <div className="grid sm:grid-cols-2 gap-2.5 shrink-0">
              {/* Card A: Awakening Guard & 4-7-8 Breathing */}
              <div className="glass-panel rounded-2xl p-3 flex flex-col justify-between gap-2 border border-amber-500/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {leaveGuardEnabled ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                      Màng lọc Thức tỉnh
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onTestLeaveAlert}
                    className="min-h-[28px] px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
                  >
                    Thử nhắc
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleLeaveGuard}
                    aria-pressed={leaveGuardEnabled}
                    className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-semibold transition-colors flex items-center justify-between gap-1 ${
                      leaveGuardEnabled
                        ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">Rời tab</span>
                    <span className="font-mono-num text-[11px] font-bold shrink-0">
                      {leaveGuardEnabled ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleLeaveSound}
                    aria-pressed={leaveSoundEnabled}
                    className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-semibold transition-colors flex items-center justify-between gap-1 ${
                      leaveSoundEnabled
                        ? 'border-sky-500/50 bg-sky-500/12 text-sky-800 dark:text-sky-200'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">Chuông</span>
                    <span className="font-mono-num text-[11px] font-bold shrink-0">
                      {leaveSoundEnabled ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                    Gián đoạn:{' '}
                    <strong className="font-mono-num text-slate-900 dark:text-white">
                      {user.socialInterruptionCount} lần
                    </strong>
                    {leaveEvents.length > 0 && (
                      <span className="text-amber-700 dark:text-amber-300 font-mono-num">
                        {' '}
                        · {leaveEvents[0].awaySeconds}s
                      </span>
                    )}
                  </span>
                  {notifStatus === 'granted' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                      <BellRing className="w-3.5 h-3.5" />
                      <span>Đẩy bật</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequestBrowserNotif}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Thông báo</span>
                    </button>
                  )}
                </div>

                {/* Integrated 4-7-8 Breathing Strip */}
                <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <motion.div
                        animate={
                          breathingActive
                            ? {
                                scale:
                                  currentBreath.key === 'inhale'
                                    ? 1.15
                                    : currentBreath.key === 'hold'
                                      ? 1.15
                                      : 0.92,
                              }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                        className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0"
                      >
                        <Wind className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </motion.div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {breathingActive ? `${currentBreath.label} · ${breathCountdown}s` : 'Nhịp thở 4-7-8'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBreathingActive((v) => !v)}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        breathingActive
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                          : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {breathingActive ? 'Dừng' : 'Thực hành'}
                    </button>
                  </div>

                  <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ease-linear ${
                        breathingActive ? 'aurora-xp-fill opacity-100' : 'bg-slate-300 dark:bg-slate-700 opacity-35'
                      }`}
                      style={{
                        width: breathingActive ? `${Math.max(12, Math.round(breathProgress * 100))}%` : '100%',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card B: Binaural Beats & Forest Rain Soundscape */}
              <div className="glass-panel rounded-2xl p-3 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Headphones className="w-4 h-4 text-sky-500 shrink-0" />
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                      Sóng não &amp; Mưa Rừng
                    </h2>
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    {Math.round((volume / 0.4) * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'none', title: 'Tắt sóng' },
                      { id: 'alpha', title: 'Alpha 10Hz' },
                      { id: 'beta', title: 'Beta 18Hz' },
                      { id: 'theta', title: 'Theta 6Hz' },
                    ] as const
                  ).map((mode) => {
                    const active = binauralMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          if (hapticEnabled) {
                            triggerHapticFeedback(8);
                            audioEngine.playTactilePress('tick');
                          }
                          onChangeBinaural(mode.id);
                        }}
                        aria-pressed={active}
                        className={`min-h-[34px] px-2.5 py-1 rounded-xl text-left transition-colors flex items-center ${
                          active
                            ? 'aurora-accent-btn shadow-sm'
                            : 'border border-slate-300/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight truncate">{mode.title}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (hapticEnabled) {
                        triggerHapticFeedback(10);
                        audioEngine.playTactilePress('tick');
                      }
                      onToggleRain();
                    }}
                    aria-pressed={rainActive}
                    className={`w-full min-h-[34px] flex items-center justify-between px-2.5 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                      rainActive
                        ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <CloudRain className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Tiếng Mưa Rừng</span>
                    </span>
                    <span className="font-mono-num text-[11px] font-bold shrink-0">
                      {rainActive ? 'Đang phát' : 'Bật'}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 px-0.5 pt-0.5">
                    <Volume2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="range"
                      min={0.01}
                      max={0.4}
                      step={0.01}
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      aria-label="Âm lượng sóng não và tiếng mưa"
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO ROW 3: Toggleable Panel — Real-Time Group Study Session OR Live Focus Wave */}
            <section className="led-frame glass-panel relative rounded-2xl p-3 sm:p-3.5 flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
              <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />

              {/* Row 3 Switcher Header */}
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div
                  role="tablist"
                  aria-label="Chế độ bảng điều khiển mở rộng"
                  className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/75 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/70"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={bottomPanel === 'group'}
                    onClick={() => setBottomPanel('group')}
                    className={`min-h-[30px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      bottomPanel === 'group'
                        ? 'aurora-accent-btn shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Phiên học nhóm</span>
                    {(activeStudyRoom || incomingRoomInvites.length > 0) && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          activeStudyRoom ? 'bg-emerald-300 animate-pulse' : 'bg-sky-400 animate-pulse'
                        }`}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={bottomPanel === 'wave'}
                    onClick={() => setBottomPanel('wave')}
                    className={`min-h-[30px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      bottomPanel === 'wave'
                        ? 'aurora-accent-btn shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Sóng tập trung</span>
                  </button>
                </div>

                {bottomPanel === 'group' && activeStudyRoom && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isRoomHost && uninvitedCandidates.length > 0 && remainingSlots > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInviteUids([]);
                          setShowInviteMore((v) => !v);
                        }}
                        className="min-h-[28px] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-sky-500/40 bg-sky-500/12 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{showInviteMore ? 'Đóng mời' : 'Mời thêm'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void onLeaveOrEndStudyRoom()}
                      className="min-h-[28px] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-rose-300 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isRoomHost ? 'Kết thúc phòng' : 'Rời phòng'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Panel Content */}
              {bottomPanel === 'wave' ? (
                <div className="flex-1 min-h-0 flex flex-col justify-between">
                  <FocusWaveChart
                    weeklyFocusMins={user.weeklyFocusMins}
                    todayFocusMins={user.todayFocusMins}
                    ultraCompact
                    showModeToggle
                  />
                </div>
              ) : activeStudyRoom ? (
                /* ACTIVE GROUP STUDY ROOM VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                  {/* Room Metadata Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {activeStudyRoom.title}
                      </span>
                      <span className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 shrink-0">
                        {Math.round(activeStudyRoom.durationSecs / 60) || 1}p · {activeRoomRoster.length}/8
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                        isGroupCoStudyBonus
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isGroupCoStudyBonus
                        ? 'Co-Study +15% XP đang kích hoạt'
                        : 'Chờ bạn vào phòng để +15% XP'}
                    </span>
                  </div>

                  {/* Inline Invite More Friends Picker (Host Only) */}
                  {showInviteMore && isRoomHost && (
                    <div className="p-2 rounded-xl border border-sky-500/35 bg-sky-500/[0.06] flex flex-col gap-1.5 shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Mời thêm bạn bè (còn {remainingSlots} chỗ)
                        </span>
                        <button
                          type="button"
                          disabled={selectedInviteUids.length === 0 || roomBusy}
                          onClick={() => void handleInviteMoreSubmit()}
                          className="min-h-[26px] inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg aurora-accent-btn text-xs font-bold disabled:opacity-45"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Gửi lời mời ({selectedInviteUids.length})</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {uninvitedCandidates.map((c) => {
                          const picked = selectedInviteUids.includes(c.uid);
                          return (
                            <button
                              key={c.uid}
                              type="button"
                              onClick={() => toggleInviteUid(c.uid)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                                picked
                                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                                  : 'border-slate-300 dark:border-slate-700 bg-white/75 dark:bg-slate-900/75 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {picked && <Check className="w-3 h-3" />}
                              <span>{c.name}</span>
                              <span className="text-[10px] opacity-70">({c.className})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Real-Time Participant Status Cards Grid */}
                  <div className="grid sm:grid-cols-2 gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 content-start">
                    {activeRoomRoster.map((member) => {
                      const meta = MEMBER_STATUS_META[member.status];
                      return (
                        <div
                          key={member.uid}
                          className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 transition-colors ${meta.cardBorder}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg aurora-accent-btn flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(member.fullname)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {member.fullname}
                                  {member.isMe ? ' (Bạn)' : ''}
                                </span>
                                {member.isHost && (
                                  <Crown
                                    className="w-3 h-3 text-amber-500 shrink-0"
                                    aria-label="Trưởng nhóm"
                                  />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {member.intention
                                  ? member.intention
                                  : `${member.className} · Lv.${member.level}`}
                              </div>
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-1.5 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                            <span className={`text-[11px] font-bold whitespace-nowrap ${meta.textClass}`}>
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* IDLE / SETUP & INCOMING INVITATIONS VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                  {/* Pending Invitations from Friends */}
                  {incomingRoomInvites.length > 0 && (
                    <div className="space-y-1.5 shrink-0">
                      {incomingRoomInvites.slice(0, 2).map((invite) => (
                        <div
                          key={invite.id}
                          className="px-2.5 py-2 rounded-xl border border-sky-500/40 bg-sky-500/[0.08] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {invite.hostName} mời bạn: &ldquo;{invite.title}&rdquo;
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono-num">
                              {Math.round(invite.durationSecs / 60) || 1} phút ·{' '}
                              {invite.participantUids.length}/8 người ·{' '}
                              {invite.status === 'running' ? 'Đang chạy' : 'Đang chờ'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void onJoinStudyRoom(invite)}
                            className="min-h-[30px] px-3 py-1 rounded-lg aurora-accent-btn text-xs font-bold whitespace-nowrap shrink-0"
                          >
                            Tham gia
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create Group Study Room Bar */}
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <input
                      type="text"
                      value={roomTitleInput}
                      onChange={(e) => setRoomTitleInput(e.target.value)}
                      maxLength={80}
                      placeholder="Tên phòng học nhóm (VD: Ôn Toán cùng 11A1)..."
                      className="flex-1 min-h-[34px] px-3 py-1 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      disabled={roomBusy}
                      onClick={() => void handleCreateRoomSubmit()}
                      className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl aurora-accent-btn text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {selectedInviteUids.length > 0
                          ? `Tạo phòng & Mời (${selectedInviteUids.length})`
                          : 'Mở phòng học nhóm'}
                      </span>
                    </button>
                  </div>

                  {/* Friend / Classmate Selector */}
                  <div className="flex-1 min-h-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      <span>Chọn bạn bè để mời cùng đồng bộ ({selectedInviteUids.length}/7)</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">+15% XP Co-Study</span>
                    </div>

                    {inviteCandidates.length === 0 ? (
                      <div className="flex-1 min-h-0 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        Chưa có bạn bè trong danh sách. Bạn vẫn có thể mở phòng trước hoặc kết bạn tại mục Bạn bè &amp; Rồng.
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0 overflow-y-auto grid sm:grid-cols-2 gap-1.5 pr-0.5 content-start">
                        {inviteCandidates.map((c) => {
                          const selected = selectedInviteUids.includes(c.uid);
                          return (
                            <button
                              key={c.uid}
                              type="button"
                              onClick={() => toggleInviteUid(c.uid)}
                              aria-pressed={selected}
                              className={`px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                                selected
                                  ? 'border-emerald-500 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100'
                                  : 'border-slate-200/90 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 shrink-0">
                                  {getInitials(c.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{c.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {c.isFriend ? 'Bạn bè' : 'Cùng trường'} · {c.className}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {selected && <Check className="w-3 h-3" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
