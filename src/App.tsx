import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { MotionConfig } from 'motion/react';
import { AppShell } from './components/AppShell';
import { AuthView } from './components/AuthView';
import { CdsView } from './components/CdsView';
import { ChatView } from './components/ChatView';
import { DeepWorkReflectionModal } from './components/DeepWorkReflectionModal';
import { DeepWorkView } from './components/DeepWorkView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FireworksCanvas } from './components/FireworksCanvas';
import { FriendsAndDragonView } from './components/FriendsAndDragonView';
import { Garden3DView } from './components/Garden3DView';
import { JournalView } from './components/JournalView';
import {
  AwakeningModal,
  CdsOnboardingModal,
  CrisisModal,
  JudgeAccessModal,
  NotificationGateModal,
  RenameTreeModal,
} from './components/Modals';
import { PlantQuestsView } from './components/PlantQuestsView';
import {
  LeaderboardView,
  ProfileView,
  ResearchLabView,
  SurveyView,
} from './components/ResearchAndStatsViews';
import { TasksView } from './components/TasksView';
import { ToastContainer } from './components/ToastContainer';
import {
  JUDGE_PASSWORD,
  createJudgeAccount,
  getDefaultPlantQuests,
  getDragonXpMultiplier,
  getMaxXpForLevel,
  getTitleByLevel,
  getTodayDateStr,
} from './constants';
import { auth, googleProvider } from './firebase';
import {
  addJournalEntry,
  addPlantQuest,
  addUserTask,
  claimGardenGift,
  createStudyRoom,
  deleteJournalEntry,
  ensureUserDocuments,
  inviteStudyRoomParticipants,
  joinOrUpdateStudyRoomMember,
  markPlantQuestUsed,
  postForumMessage,
  removeUserTask,
  respondFriendRequest,
  saveAiMessage,
  saveCdsAssessment,
  sendFriendInvite,
  sendGardenGift,
  sendPrivatePeerMessage,
  submitKhktSurvey,
  subscribeAiMessages,
  subscribeCdsRecords,
  subscribeForumMessages,
  subscribeFriendRequests,
  subscribeFriendships,
  subscribeIncomingGifts,
  subscribeJournals,
  subscribePlantQuests,
  subscribePublicGardens,
  subscribeStudyRoomMembers,
  subscribeStudyRooms,
  subscribeUserProfile,
  subscribeUserTasks,
  updateCoStudyStreak,
  updateProfileInfo,
  updateProgressionStats,
  updateStudyRoomTimer,
  updateUserTask,
} from './services/firestoreService';
import type {
  AiChatMessage,
  BinauralMode,
  CdsRecord,
  ChatMode,
  DeepWorkSessionSummary,
  ForumMessage,
  FriendRequest,
  Friendship,
  GardenGift,
  JournalEntry,
  KhktSurvey,
  LeaveEventLog,
  PlantQuest,
  PublicGarden,
  StudyRoom,
  StudyRoomMember,
  StudyRoomMemberStatus,
  TabId,
  ToastItem,
  UserProfile,
  UserTask,
} from './types';
import { audioEngine } from './utils/audio';

const DEFAULT_PAGE_TITLE = 'Mindful AI – Vườn Tâm Trí 3D';

function formatClock(totalSecs: number): string {
  const m = Math.floor(Math.max(0, totalSecs) / 60);
  const s = Math.max(0, totalSecs) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getWeekDayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function MindfulAppInner() {
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mindful_theme') === 'dark';
    } catch {
      return false;
    }
  });

  // 3D & Celebration states
  const [previewLevel, setPreviewLevel] = useState(1);
  const [visitingFriend, setVisitingFriend] = useState<PublicGarden | null>(null);
  const [rainTriggerKey, setRainTriggerKey] = useState(0);
  const [fireworksKey, setFireworksKey] = useState(0);
  const [pendingTreeBlessing, setPendingTreeBlessing] = useState(false);

  // Domain Collections
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [quests, setQuests] = useState<PlantQuest[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [cdsRecords, setCdsRecords] = useState<CdsRecord[]>([]);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [forumMessages, setForumMessages] = useState<ForumMessage[]>([]);
  const [publicGardens, setPublicGardens] = useState<PublicGarden[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [incomingReqs, setIncomingReqs] = useState<FriendRequest[]>([]);
  const [outgoingReqs, setOutgoingReqs] = useState<FriendRequest[]>([]);
  const [incomingGifts, setIncomingGifts] = useState<GardenGift[]>([]);

  // Deep Work Timer & Audio States
  const [selectedPresetMins, setSelectedPresetMins] = useState(25);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedCoStudyPairId, setSelectedCoStudyPairId] = useState('');
  const [binauralMode, setBinauralMode] = useState<BinauralMode>('none');
  const [rainActive, setRainActive] = useState(false);
  const [sessionIntention, setSessionIntention] = useState('');
  const [leaveGuardEnabled, setLeaveGuardEnabled] = useState(true);
  const [leaveSoundEnabled, setLeaveSoundEnabled] = useState(true);
  const [leaveEvents, setLeaveEvents] = useState<LeaveEventLog[]>([]);
  const [lastLeaveSeconds, setLastLeaveSeconds] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);

  // Real-Time Group Study Room States
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [activeStudyRoomId, setActiveStudyRoomId] = useState('');
  const [studyRoomMembers, setStudyRoomMembers] = useState<StudyRoomMember[]>([]);
  const [isTabAway, setIsTabAway] = useState(false);
  const [completedInRoomId, setCompletedInRoomId] = useState('');

  // Modals & Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [notifGateOpen, setNotifGateOpen] = useState(false);
  const [awakeningOpen, setAwakeningOpen] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [judgeModalOpen, setJudgeModalOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [lastCompletedSession, setLastCompletedSession] = useState<DeepWorkSessionSummary | null>(null);

  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;
  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;
  const awayStartRef = useRef<number | null>(null);
  const titleFlashRef = useRef<number | null>(null);
  const sessionLeaveCountRef = useRef(0);
  const sessionAwaySecsRef = useRef(0);
  const completedRoomRunRef = useRef<string>('');
  const seenRoomInviteIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedMemberRef = useRef<{
    roomId: string;
    status: StudyRoomMemberStatus;
    intention: string;
  } | null>(null);

  const pushToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('mindful_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);

  // Sync today's completed Deep Work sessions count from localStorage + todayFocusMins
  useEffect(() => {
    if (!user) {
      setTodaySessions(0);
      return;
    }
    const todayKey = `mindful_today_sessions_${user.uid}_${getTodayDateStr()}`;
    let stored = 0;
    try {
      stored = Math.max(0, parseInt(localStorage.getItem(todayKey) || '0', 10) || 0);
    } catch {
      stored = 0;
    }
    const inferred = user.todayFocusMins > 0 ? Math.max(1, Math.floor(user.todayFocusMins / 25)) : 0;
    setTodaySessions(Math.max(stored, inferred));
  }, [user]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (judgeMode) {
        setAuthReady(true);
        return;
      }
      if (!fbUser) {
        setFirebaseUid(null);
        setUser(null);
        setTasks([]);
        setQuests([]);
        setJournals([]);
        setCdsRecords([]);
        setAiMessages([]);
        setFriendships([]);
        setIncomingReqs([]);
        setOutgoingReqs([]);
        setIncomingGifts([]);
        setAuthReady(true);
        return;
      }
      try {
        setFirebaseUid(fbUser.uid);
        const profile = await ensureUserDocuments(fbUser);
        setUser(profile);
        setPreviewLevel(profile.level || 1);
        const sessionKey = `mindful_cds_checked_${fbUser.uid}`;
        let alreadyChecked = false;
        try {
          alreadyChecked = sessionStorage.getItem(sessionKey) === '1';
        } catch {
          alreadyChecked = false;
        }
        if (!alreadyChecked || profile.lastCdsScore == null) {
          setOnboardingOpen(true);
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        pushToast('Không thể tải hồ sơ tài khoản Google.', 'error');
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [judgeMode, pushToast]);

  // Real-time Firestore subscriptions when signed in with Firebase
  useEffect(() => {
    if (!firebaseUid || judgeMode) return;
    const unsubs = [
      subscribeUserProfile(firebaseUid, (profile) => {
        if (profile) {
          setUser(profile);
        }
      }),
      subscribeUserTasks(firebaseUid, setTasks),
      subscribePlantQuests(firebaseUid, setQuests),
      subscribeJournals(firebaseUid, setJournals),
      subscribeCdsRecords(firebaseUid, setCdsRecords),
      subscribeAiMessages(firebaseUid, setAiMessages),
      subscribePublicGardens(setPublicGardens),
      subscribeFriendRequests(firebaseUid, (inc, out) => {
        setIncomingReqs(inc);
        setOutgoingReqs(out);
      }),
      subscribeFriendships(firebaseUid, setFriendships),
      subscribeIncomingGifts(firebaseUid, setIncomingGifts),
      subscribeForumMessages(setForumMessages),
      subscribeStudyRooms(firebaseUid, setStudyRooms),
    ];
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUid, judgeMode]);

  const activeStudyRoom = studyRooms.find((r) => r.id === activeStudyRoomId) || null;
  const incomingRoomInvites = studyRooms.filter(
    (r) =>
      r.status !== 'ended' &&
      r.id !== activeStudyRoomId &&
      r.hostUid !== user?.uid,
  );
  const activeGroupJoinedCount = activeStudyRoom
    ? studyRoomMembers.filter((m) => m.status !== 'left').length
    : 0;
  const isGroupCoStudyBonus = Boolean(activeStudyRoom && activeGroupJoinedCount >= 2);

  // Subscribe to individual member status docs for the active study room
  const activeParticipantKey = activeStudyRoom ? activeStudyRoom.participantUids.join(',') : '';
  useEffect(() => {
    if (!activeStudyRoom || judgeMode || !firebaseUid) {
      if (!activeStudyRoom) setStudyRoomMembers([]);
      return;
    }
    const uids = activeParticipantKey ? activeParticipantKey.split(',') : [];
    const unsub = subscribeStudyRoomMembers(activeStudyRoom.id, uids, setStudyRoomMembers);
    return () => unsub();
  }, [activeStudyRoom?.id, activeParticipantKey, judgeMode, firebaseUid]);

  // Detect room end or new incoming invitations
  useEffect(() => {
    if (activeStudyRoomId && !studyRooms.some((r) => r.id === activeStudyRoomId)) {
      setActiveStudyRoomId('');
      setTimerRunning(false);
      setCompletedInRoomId('');
      lastSyncedMemberRef.current = null;
      pushToast('Phiên học nhóm đã kết thúc.', 'warning');
    }

    if (user) {
      studyRooms.forEach((room) => {
        if (
          room.hostUid !== user.uid &&
          room.id !== activeStudyRoomId &&
          !seenRoomInviteIdsRef.current.has(room.id)
        ) {
          seenRoomInviteIdsRef.current.add(room.id);
          pushToast(`${room.hostName} vừa mời bạn vào Phiên học nhóm "${room.title}"!`, 'badge');
        }
      });
    }
  }, [studyRooms, activeStudyRoomId, user, pushToast]);

  // Sync progression updates (handles Judge sandbox vs Firestore)
  const applyProgressionUpdate = useCallback(
    async (next: UserProfile) => {
      setUser(next);
      if (next.role === 'judge') return;
      await updateProgressionStats(next.uid, {
        level: next.level,
        xp: next.xp,
        maxXp: next.maxXp,
        seedPoints: next.seedPoints,
        streakDays: next.streakDays,
        lastActiveDate: next.lastActiveDate,
        todayFocusMins: next.todayFocusMins,
        weeklyFocusMins: next.weeklyFocusMins,
        socialInterruptionCount: next.socialInterruptionCount,
        dragonUpgradeLevel: next.dragonUpgradeLevel,
        exploredStages: next.exploredStages,
        hasBadgeKienTri: next.hasBadgeKienTri,
      });
    },
    [],
  );

  // Core XP + Seeds + Level-up calculator
  const grantRewards = useCallback(
    async (
      xpDelta: number,
      seedDelta: number,
      extra?: {
        focusMinsAdded?: number;
        socialInterruptionDelta?: number;
        dragonUpgradeLevel?: number;
      },
    ) => {
      const current = userRef.current;
      if (!current) return;

      let level = current.level || 1;
      let xp = Math.max(0, Math.round((current.xp || 0) + xpDelta));
      let maxXp = current.maxXp || getMaxXpForLevel(level);
      let leveledUp = false;

      while (xp >= maxXp && level < 10) {
        xp -= maxXp;
        level += 1;
        maxXp = getMaxXpForLevel(level);
        leveledUp = true;
      }

      const today = getTodayDateStr();
      let streakDays = current.streakDays || 1;
      let todayFocusMins = current.todayFocusMins || 0;
      const weeklyFocusMins =
        current.weeklyFocusMins?.length === 7 ? [...current.weeklyFocusMins] : [0, 0, 0, 0, 0, 0, 0];

      if (current.lastActiveDate !== today) {
        todayFocusMins = 0;
        if (extra?.focusMinsAdded) {
          streakDays += 1;
        }
      }

      if (extra?.focusMinsAdded) {
        todayFocusMins = Math.min(1440, todayFocusMins + Math.round(extra.focusMinsAdded));
        const dayIdx = getWeekDayIndex();
        weeklyFocusMins[dayIdx] = Math.min(1440, (weeklyFocusMins[dayIdx] || 0) + Math.round(extra.focusMinsAdded));
      }

      const exploredSet = new Set(current.exploredStages || [1]);
      exploredSet.add(level);

      const nextProfile: UserProfile = {
        ...current,
        level,
        xp,
        maxXp,
        seedPoints: Math.max(0, Math.round((current.seedPoints || 0) + seedDelta)),
        streakDays,
        lastActiveDate: today,
        todayFocusMins,
        weeklyFocusMins,
        socialInterruptionCount:
          (current.socialInterruptionCount || 0) + (extra?.socialInterruptionDelta || 0),
        dragonUpgradeLevel:
          extra?.dragonUpgradeLevel !== undefined ? extra.dragonUpgradeLevel : current.dragonUpgradeLevel,
        exploredStages: Array.from(exploredSet).sort((a, b) => a - b),
        hasBadgeKienTri: current.hasBadgeKienTri || streakDays >= 7,
      };

      await applyProgressionUpdate(nextProfile);

      if (leveledUp) {
        setPreviewLevel(level);
        setFireworksKey((k) => k + 1);
        setRainTriggerKey((k) => k + 1);
        pushToast(
          `Chúc mừng! "${current.treeName}" đã thăng Cấp ${level} (${getTitleByLevel(level)})!`,
          'badge',
        );
      }
    },
    [applyProgressionUpdate, pushToast],
  );

  // Handle Deep Work timer completion
  const handleTimerComplete = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;

    const currentRoom = activeStudyRoom;
    const effectiveTotalSecs = currentRoom ? currentRoom.durationSecs : totalSeconds;

    setTimerRunning(false);
    setSecondsLeft(effectiveTotalSecs);
    audioEngine.playCompletionChime();
    setRainTriggerKey((k) => k + 1);
    setFireworksKey((k) => k + 1);
    setPendingTreeBlessing(true);

    const minsEarned =
      effectiveTotalSecs === 10 ? 25 : Math.max(1, Math.round(effectiveTotalSecs / 60));
    const dragonMult = getDragonXpMultiplier(current);
    const coStudyBonus = selectedCoStudyPairId || isGroupCoStudyBonus ? 0.15 : 0;
    const totalMult = dragonMult + coStudyBonus;
    const xpGain = Math.round(minsEarned * 4 * totalMult);
    const seedGain = Math.round(minsEarned * 2);

    await grantRewards(xpGain, seedGain, { focusMinsAdded: minsEarned });

    setTodaySessions((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem(`mindful_today_sessions_${current.uid}_${getTodayDateStr()}`, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });

    if (selectedTaskId) {
      const targetTask = tasks.find((t) => t.id === selectedTaskId);
      if (targetTask && !targetTask.completed) {
        if (current.role === 'judge') {
          setTasks((prev) =>
            prev.map((t) => (t.id === targetTask.id ? { ...t, completed: true, rewarded: true } : t)),
          );
        } else {
          await updateUserTask(current.uid, targetTask.id, { completed: true, rewarded: true });
        }
      }
    }

    if (current.role !== 'judge') {
      if (selectedCoStudyPairId) {
        const f = friendships.find((item) => item.id === selectedCoStudyPairId);
        if (f) {
          await updateCoStudyStreak(f, xpGain);
        }
      } else if (currentRoom && isGroupCoStudyBonus) {
        const joinedUids = new Set(
          studyRoomMembers.filter((m) => m.status !== 'left' && m.uid !== current.uid).map((m) => m.uid),
        );
        const matchingFriend = friendships.find(
          (f) => joinedUids.has(f.uidA) || joinedUids.has(f.uidB),
        );
        if (matchingFriend) {
          await updateCoStudyStreak(matchingFriend, xpGain);
        }
      }
    }

    if (currentRoom) {
      setCompletedInRoomId(currentRoom.id);
      if (currentRoom.hostUid === current.uid) {
        if (current.role === 'judge') {
          setStudyRooms((prev) =>
            prev.map((r) =>
              r.id === currentRoom.id
                ? { ...r, status: 'waiting', remainingSecs: r.durationSecs, timerUpdatedAtMs: Date.now() }
                : r,
            ),
          );
        } else {
          await updateStudyRoomTimer(currentRoom.id, {
            status: 'waiting',
            remainingSecs: currentRoom.durationSecs,
          });
        }
      }
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Mindful AI · Hoàn thành Deep Work!', {
          body: `Tuyệt vời! Bạn vừa nhận +${xpGain} XP và +${seedGain} mầm xanh.`,
        });
      } catch {
        // ignore browser notification error
      }
    }

    const selectedTaskObj = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : undefined;
    const now = new Date();
    const completedAtLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const summary: DeepWorkSessionSummary = {
      id: `dw_${Date.now()}`,
      durationMins: minsEarned,
      intention: sessionIntention.trim() || selectedTaskObj?.text || 'Tập trung tự học',
      taskText: selectedTaskObj?.text,
      interruptionCount: sessionLeaveCountRef.current,
      awaySecs: sessionAwaySecsRef.current,
      soundMode: rainActive ? 'rain' : binauralMode,
      isGroupSession: Boolean(currentRoom),
      groupSize: currentRoom ? Math.max(1, activeGroupJoinedCount) : undefined,
      xpEarned: xpGain,
      seedsEarned: seedGain,
      lastCdsScore: current.lastCdsScore ?? null,
      completedAtLabel,
    };
    sessionLeaveCountRef.current = 0;
    sessionAwaySecsRef.current = 0;
    setLastCompletedSession(summary);
    window.setTimeout(() => {
      setReflectionOpen(true);
    }, 450);

    pushToast(
      currentRoom
        ? `Hoàn thành phiên học nhóm! +${xpGain} XP & +${seedGain} mầm xanh.`
        : `Hoàn thành phiên Deep Work! +${xpGain} XP & +${seedGain} mầm xanh.`,
    );
  }, [
    activeGroupJoinedCount,
    activeStudyRoom,
    binauralMode,
    friendships,
    grantRewards,
    isGroupCoStudyBonus,
    pushToast,
    rainActive,
    selectedCoStudyPairId,
    selectedTaskId,
    sessionIntention,
    studyRoomMembers,
    tasks,
    totalSeconds,
  ]);

  // Synchronized Countdown Interval (Solo vs Real-Time Group Room)
  useEffect(() => {
    if (activeStudyRoom) {
      setTotalSeconds(activeStudyRoom.durationSecs);
      if (activeStudyRoom.durationSecs !== 10) {
        setSelectedPresetMins(Math.max(1, Math.round(activeStudyRoom.durationSecs / 60)));
      }

      if (activeStudyRoom.status === 'running') {
        setCompletedInRoomId('');
        setTimerRunning(true);
        const runKey = `${activeStudyRoom.id}_${activeStudyRoom.timerUpdatedAtMs}`;

        const syncTick = () => {
          const elapsed = Math.max(0, Math.floor((Date.now() - activeStudyRoom.timerUpdatedAtMs) / 1000));
          const left = Math.max(0, activeStudyRoom.remainingSecs - elapsed);
          setSecondsLeft(left);
          if (left <= 0 && completedRoomRunRef.current !== runKey) {
            completedRoomRunRef.current = runKey;
            void handleTimerComplete();
          }
        };

        syncTick();
        const id = window.setInterval(syncTick, 1000);
        return () => window.clearInterval(id);
      }

      setTimerRunning(false);
      setSecondsLeft(activeStudyRoom.remainingSecs);
      return;
    }

    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void handleTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeStudyRoom, timerRunning, handleTimerComplete]);

  // Sync Local Participant Presence & Intention into Active Study Room
  useEffect(() => {
    if (!activeStudyRoom || !user) return;
    const desiredStatus: StudyRoomMemberStatus = isTabAway
      ? 'away'
      : activeStudyRoom.status === 'running'
        ? 'focusing'
        : activeStudyRoom.status === 'paused'
          ? 'paused'
          : completedInRoomId === activeStudyRoom.id
            ? 'completed'
            : 'ready';
    const cleanIntention = sessionIntention.trim().slice(0, 140);
    const prev = lastSyncedMemberRef.current;

    if (
      prev &&
      prev.roomId === activeStudyRoom.id &&
      prev.status === desiredStatus &&
      prev.intention === cleanIntention
    ) {
      return;
    }

    const delayMs = prev && prev.roomId === activeStudyRoom.id && prev.status === desiredStatus ? 500 : 0;

    const timerId = window.setTimeout(() => {
      lastSyncedMemberRef.current = {
        roomId: activeStudyRoom.id,
        status: desiredStatus,
        intention: cleanIntention,
      };
      if (user.role === 'judge') {
        setStudyRoomMembers((members) => {
          const updated: StudyRoomMember = {
            roomId: activeStudyRoom.id,
            uid: user.uid,
            fullname: user.fullname,
            className: user.className,
            treeName: user.treeName,
            level: user.level,
            status: desiredStatus,
            intention: cleanIntention,
            updatedAtMs: Date.now(),
          };
          const exists = members.some((m) => m.uid === user.uid);
          return exists
            ? members.map((m) => (m.uid === user.uid ? updated : m))
            : [updated, ...members];
        });
      } else {
        void joinOrUpdateStudyRoomMember(activeStudyRoom.id, user, {
          status: desiredStatus,
          intention: cleanIntention,
        });
      }
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [activeStudyRoom, user, isTabAway, completedInRoomId, sessionIntention]);

  // Stop title flash helper
  const clearTitleFlash = useCallback(() => {
    if (titleFlashRef.current !== null) {
      window.clearInterval(titleFlashRef.current);
      titleFlashRef.current = null;
    }
    document.title = DEFAULT_PAGE_TITLE;
  }, []);

  // Live browser tab countdown while Deep Work is running
  useEffect(() => {
    if (!timerRunning) {
      if (titleFlashRef.current === null) {
        document.title = DEFAULT_PAGE_TITLE;
      }
      return;
    }
    if (!isTabAway && titleFlashRef.current === null) {
      document.title = `⏱ ${formatClock(secondsLeft)} · Deep Work | Mindful AI`;
    }
  }, [timerRunning, secondsLeft, isTabAway]);

  // Protect against accidental page close/refresh while timer runs
  useEffect(() => {
    if (!timerRunning || !leaveGuardEnabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [timerRunning, leaveGuardEnabled]);

  // Page Visibility Leave-Page Reminder & Socratic Awakening Filter
  useEffect(() => {
    if (!timerRunning || !leaveGuardEnabled) {
      awayStartRef.current = null;
      clearTitleFlash();
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsTabAway(true);
        awayStartRef.current = Date.now();
        if (leaveSoundEnabled) {
          audioEngine.playAwakeningBell();
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const rem = formatClock(secondsLeftRef.current);
            new Notification('⚠ Cảnh báo rời trang Deep Work!', {
              body: `Cây tâm trí đang chờ bạn quay lại (còn ${rem})${sessionIntention.trim() ? ` · Mục tiêu: ${sessionIntention.trim()}` : ''}`,
              tag: 'mindful-leave-guard',
            });
          } catch {
            // ignore notification errors
          }
        }
        if (titleFlashRef.current === null) {
          let toggle = false;
          document.title = '⚠ Đang rời phiên Deep Work!';
          titleFlashRef.current = window.setInterval(() => {
            toggle = !toggle;
            document.title = toggle
              ? '⚠ Đang rời phiên Deep Work!'
              : `⏳ Còn ${formatClock(secondsLeftRef.current)} · Quay lại ngay!`;
          }, 900);
        }
      } else if (awayStartRef.current !== null) {
        setIsTabAway(false);
        clearTitleFlash();
        const awaySecs = Math.max(1, Math.round((Date.now() - awayStartRef.current) / 1000));
        awayStartRef.current = null;
        const now = new Date();
        const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const remainingLabel = formatClock(secondsLeftRef.current);

        setLastLeaveSeconds(awaySecs);
        sessionLeaveCountRef.current += 1;
        sessionAwaySecsRef.current += awaySecs;
        setLeaveEvents((prev) => [
          {
            id: `le_${Date.now()}`,
            timeLabel,
            awaySeconds: awaySecs,
            remainingLabel,
          },
          ...prev.slice(0, 14),
        ]);

        if (leaveSoundEnabled) {
          audioEngine.playAwakeningBell();
        }
        setAwakeningOpen(true);
        void grantRewards(0, 0, { socialInterruptionDelta: 1 });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      setIsTabAway(false);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTitleFlash();
    };
  }, [timerRunning, leaveGuardEnabled, leaveSoundEnabled, sessionIntention, grantRewards, clearTitleFlash]);

  // Auth Actions
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      setJudgeMode(false);
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('mindful_cds_checked_'))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // ignore storage errors
      }
      await signInWithPopup(auth, googleProvider);
      setOnboardingOpen(true);
      pushToast('Đăng nhập Google thành công!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
      pushToast(msg, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const enterJudgeMode = (password: string): boolean => {
    if (password !== JUDGE_PASSWORD) return false;
    const judgeProfile = createJudgeAccount();
    setJudgeMode(true);
    setUser(judgeProfile);
    setPreviewLevel(10);
    setQuests(
      getDefaultPlantQuests(judgeProfile.uid).map((q, idx) => ({
        ...q,
        id: `judge_q_${idx + 1}`,
      })),
    );
    setTasks([
      {
        id: 'judge_t1',
        uid: judgeProfile.uid,
        text: 'Ôn tập chuyên đề Hàm số & Cực trị (Toán 12)',
        category: 'Toán Học',
        estimatedMins: 25,
        completed: false,
        rewarded: false,
      },
      {
        id: 'judge_t2',
        uid: judgeProfile.uid,
        text: 'Lập dàn ý Nghị luận xã hội về Chủ động số',
        category: 'Văn Học',
        estimatedMins: 25,
        completed: true,
        rewarded: true,
      },
    ]);
    setCdsRecords([
      { id: 'c1', uid: judgeProfile.uid, dateLabel: 'Tuần 1', score: 3.65, answers: Array(10).fill(4) },
      { id: 'c2', uid: judgeProfile.uid, dateLabel: 'Tuần 2', score: 3.12, answers: Array(10).fill(3) },
      { id: 'c3', uid: judgeProfile.uid, dateLabel: 'Tuần 3', score: 2.35, answers: Array(10).fill(2) },
    ]);
    setJournals([]);
    setAiMessages([]);
    setJudgeModalOpen(false);
    setOnboardingOpen(true);
    pushToast('Đã mở khóa chế độ Ban giám khảo (Cấp 1–10 & Demo 10s).', 'badge');
    return true;
  };

  const handleExitJudge = async () => {
    setJudgeMode(false);
    setTimerRunning(false);
    setStudyRooms([]);
    setActiveStudyRoomId('');
    setStudyRoomMembers([]);
    setCompletedInRoomId('');
    lastSyncedMemberRef.current = null;
    audioEngine.stopAll();
    const fbUser = auth.currentUser;
    if (fbUser) {
      setFirebaseUid(fbUser.uid);
      const profile = await ensureUserDocuments(fbUser);
      setUser(profile);
      setPreviewLevel(profile.level);
    } else {
      setUser(null);
    }
    pushToast('Đã thoát chế độ Ban giám khảo.');
  };

  const handleLogout = async () => {
    setTimerRunning(false);
    setStudyRooms([]);
    setActiveStudyRoomId('');
    setStudyRoomMembers([]);
    setCompletedInRoomId('');
    lastSyncedMemberRef.current = null;
    audioEngine.stopAll();
    setBinauralMode('none');
    setRainActive(false);
    setVisitingFriend(null);
    setOnboardingOpen(false);
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('mindful_cds_checked_'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore storage errors
    }
    if (judgeMode) {
      setJudgeMode(false);
      setUser(null);
      return;
    }
    await signOut(auth);
    pushToast('Đã đăng xuất an toàn.');
  };

  // Audio Handlers
  const handleChangeBinaural = (mode: BinauralMode) => {
    setBinauralMode(mode);
    audioEngine.startBinaural(mode);
  };

  const handleToggleRain = () => {
    if (rainActive) {
      audioEngine.stopRain();
      setRainActive(false);
    } else {
      audioEngine.startRain();
      setRainActive(true);
    }
  };

  // Feature Handlers
  const handleToggleStartTimer = async () => {
    if (!timerRunning && 'Notification' in window && Notification.permission === 'default') {
      setNotifGateOpen(true);
    }
    if (activeStudyRoom && user) {
      if (activeStudyRoom.hostUid !== user.uid) {
        pushToast('Chỉ trưởng nhóm mới điều khiển bộ đếm chung.', 'warning');
        return;
      }
      if (activeStudyRoom.status === 'running') {
        const rem = Math.max(1, secondsLeftRef.current);
        if (user.role === 'judge') {
          setStudyRooms((prev) =>
            prev.map((r) =>
              r.id === activeStudyRoom.id
                ? { ...r, status: 'paused', remainingSecs: rem, timerUpdatedAtMs: Date.now() }
                : r,
            ),
          );
        } else {
          await updateStudyRoomTimer(activeStudyRoom.id, { status: 'paused', remainingSecs: rem });
        }
      } else {
        setCompletedInRoomId('');
        const rem =
          activeStudyRoom.status === 'paused' && activeStudyRoom.remainingSecs > 0
            ? activeStudyRoom.remainingSecs
            : activeStudyRoom.durationSecs;
        if (user.role === 'judge') {
          setStudyRooms((prev) =>
            prev.map((r) =>
              r.id === activeStudyRoom.id
                ? { ...r, status: 'running', remainingSecs: rem, timerUpdatedAtMs: Date.now() }
                : r,
            ),
          );
        } else {
          await updateStudyRoomTimer(activeStudyRoom.id, { status: 'running', remainingSecs: rem });
        }
      }
      return;
    }
    setTimerRunning((v) => !v);
  };

  const handleResetTimer = async () => {
    if (activeStudyRoom && user) {
      if (activeStudyRoom.hostUid !== user.uid) {
        pushToast('Chỉ trưởng nhóm mới đặt lại bộ đếm chung.', 'warning');
        return;
      }
      setCompletedInRoomId('');
      if (user.role === 'judge') {
        setStudyRooms((prev) =>
          prev.map((r) =>
            r.id === activeStudyRoom.id
              ? { ...r, status: 'waiting', remainingSecs: r.durationSecs, timerUpdatedAtMs: Date.now() }
              : r,
          ),
        );
      } else {
        await updateStudyRoomTimer(activeStudyRoom.id, {
          status: 'waiting',
          remainingSecs: activeStudyRoom.durationSecs,
        });
      }
      return;
    }
    setTimerRunning(false);
    sessionLeaveCountRef.current = 0;
    sessionAwaySecsRef.current = 0;
    setSecondsLeft(totalSeconds);
  };

  const handleSelectPreset = async (mins: number, isDemo = false) => {
    sessionLeaveCountRef.current = 0;
    sessionAwaySecsRef.current = 0;
    if (activeStudyRoom && user) {
      if (activeStudyRoom.hostUid !== user.uid) {
        pushToast('Chỉ trưởng nhóm mới đổi thời lượng phòng học nhóm.', 'warning');
        return;
      }
      const nextSecs = isDemo ? 10 : mins * 60;
      setSelectedPresetMins(isDemo ? 25 : mins);
      setCompletedInRoomId('');
      if (user.role === 'judge') {
        setStudyRooms((prev) =>
          prev.map((r) =>
            r.id === activeStudyRoom.id
              ? {
                  ...r,
                  status: 'waiting',
                  durationSecs: nextSecs,
                  remainingSecs: nextSecs,
                  timerUpdatedAtMs: Date.now(),
                }
              : r,
          ),
        );
      } else {
        await updateStudyRoomTimer(activeStudyRoom.id, {
          status: 'waiting',
          durationSecs: nextSecs,
          remainingSecs: nextSecs,
        });
      }
      return;
    }
    setTimerRunning(false);
    if (isDemo) {
      setTotalSeconds(10);
      setSecondsLeft(10);
    } else {
      setSelectedPresetMins(mins);
      setTotalSeconds(mins * 60);
      setSecondsLeft(mins * 60);
    }
  };

  const handleFocusTaskFromTasks = useCallback(
    (task: UserTask) => {
      setSelectedTaskId(task.id);
      setSessionIntention(task.text.slice(0, 140));
      if (!timerRunning && !activeStudyRoom && task.estimatedMins) {
        const preset =
          task.estimatedMins <= 15 ? 15 : task.estimatedMins <= 30 ? 25 : task.estimatedMins <= 50 ? 45 : 60;
        setSelectedPresetMins(preset);
        setTotalSeconds(preset * 60);
        setSecondsLeft(preset * 60);
      }
      setActiveTab('timer');
      pushToast(`Đã gắn "${task.text}" vào phòng Deep Work!`);
    },
    [activeStudyRoom, pushToast, timerRunning],
  );

  // Group Study Room Handlers
  const handleCreateStudyRoom = async (title: string, invitedUids: string[]) => {
    if (!user) return;
    setCompletedInRoomId('');
    if (user.role === 'judge') {
      const roomId = `judge_room_${Date.now()}`;
      const participantUids = Array.from(new Set([user.uid, ...invitedUids])).slice(0, 8);
      const room: StudyRoom = {
        id: roomId,
        hostUid: user.uid,
        hostName: user.fullname,
        title: title.trim() || 'Phiên học nhóm Deep Work',
        durationSecs: totalSeconds,
        remainingSecs: totalSeconds,
        status: 'waiting',
        participantUids,
        timerUpdatedAtMs: Date.now(),
        createdAtMs: Date.now(),
      };
      setStudyRooms([room]);
      setStudyRoomMembers([
        {
          roomId,
          uid: user.uid,
          fullname: user.fullname,
          className: user.className,
          treeName: user.treeName,
          level: user.level,
          status: 'ready',
          intention: sessionIntention.trim(),
          updatedAtMs: Date.now(),
        },
      ]);
      setActiveStudyRoomId(roomId);
      pushToast('Đã tạo phòng học nhóm (Chế độ BGK)!', 'badge');
      return;
    }
    const roomId = await createStudyRoom(user, {
      title,
      durationSecs: totalSeconds,
      invitedUids,
      intention: sessionIntention,
    });
    setActiveStudyRoomId(roomId);
    pushToast(
      invitedUids.length > 0
        ? `Đã tạo phòng học nhóm & mời ${invitedUids.length} bạn!`
        : 'Đã mở phòng học nhóm! Bạn có thể mời thêm bạn bè.',
    );
  };

  const handleJoinStudyRoom = async (room: StudyRoom) => {
    if (!user) return;
    setCompletedInRoomId('');
    setTimerRunning(false);
    setActiveStudyRoomId(room.id);
    if (user.role !== 'judge') {
      await joinOrUpdateStudyRoomMember(room.id, user, {
        status: room.status === 'running' ? 'focusing' : room.status === 'paused' ? 'paused' : 'ready',
        intention: sessionIntention,
      });
    }
    pushToast(`Đã tham gia phòng học nhóm "${room.title}"!`);
  };

  const handleInviteMoreToRoom = async (newFriendUids: string[]) => {
    if (!activeStudyRoom || !user || activeStudyRoom.hostUid !== user.uid || newFriendUids.length === 0) return;
    if (user.role === 'judge') {
      setStudyRooms((prev) =>
        prev.map((r) =>
          r.id === activeStudyRoom.id
            ? {
                ...r,
                participantUids: Array.from(new Set([r.hostUid, ...r.participantUids, ...newFriendUids])).slice(0, 8),
              }
            : r,
        ),
      );
      pushToast(`Đã mời thêm ${newFriendUids.length} bạn vào phòng!`);
      return;
    }
    await inviteStudyRoomParticipants(
      activeStudyRoom.id,
      activeStudyRoom.hostUid,
      activeStudyRoom.participantUids,
      newFriendUids,
    );
    pushToast(`Đã gửi lời mời đến ${newFriendUids.length} bạn học!`);
  };

  const handleLeaveOrEndStudyRoom = async () => {
    if (!activeStudyRoom || !user) return;
    const isHost = activeStudyRoom.hostUid === user.uid;
    const roomId = activeStudyRoom.id;
    setTimerRunning(false);
    setSecondsLeft(activeStudyRoom.durationSecs);
    setCompletedInRoomId('');
    lastSyncedMemberRef.current = null;
    setActiveStudyRoomId('');

    if (user.role === 'judge') {
      setStudyRooms([]);
      setStudyRoomMembers([]);
      pushToast(isHost ? 'Đã kết thúc phòng học nhóm.' : 'Đã rời phòng học nhóm.');
      return;
    }

    if (isHost) {
      await updateStudyRoomTimer(roomId, { status: 'ended', remainingSecs: 0 });
      pushToast('Đã kết thúc phòng học nhóm.');
    } else {
      await joinOrUpdateStudyRoomMember(roomId, user, {
        status: 'left',
        intention: sessionIntention,
      });
      pushToast('Bạn đã rời phòng học nhóm.');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen aurora-surface flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
        Đang khởi tạo Mindful AI...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthView
          isDark={isDark}
          onToggleTheme={() => setIsDark((v) => !v)}
          onGoogleLogin={handleGoogleLogin}
          onJudgeLogin={enterJudgeMode}
          authLoading={authLoading}
        />
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
      </>
    );
  }

  return (
    <>
      <AppShell
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((v) => !v)}
        binauralMode={binauralMode}
        rainActive={rainActive}
        timerRunning={timerRunning}
        timerSecondsLeft={secondsLeft}
        timerTotalSeconds={totalSeconds}
        timerIntention={sessionIntention}
        activeGroupCount={activeStudyRoom ? activeGroupJoinedCount : 0}
        tasks={tasks}
        onToggleTimer={handleToggleStartTimer}
        onToggleRain={handleToggleRain}
        onFocusTask={handleFocusTaskFromTasks}
        pendingTasksCount={tasks.filter((t) => !t.completed).length}
        totalTasksCount={tasks.length}
        incomingGiftCount={incomingGifts.length}
        incomingReqCount={incomingReqs.filter((r) => r.status === 'pending').length}
        onOpenRenameTree={() => setRenameOpen(true)}
        onTriggerAwakeningTest={() => {
          setLastLeaveSeconds(0);
          if (leaveSoundEnabled) audioEngine.playAwakeningBell();
          setAwakeningOpen(true);
        }}
        onOpenJudgeModal={() => setJudgeModalOpen(true)}
        onExitJudge={() => void handleExitJudge()}
        onLogout={() => void handleLogout()}
      >
        {activeTab === 'home' && (
          <Garden3DView
            user={user}
            visitingFriend={visitingFriend}
            previewLevel={previewLevel}
            todaySessions={todaySessions}
            isDark={isDark}
            rainTriggerKey={rainTriggerKey}
            hasTreeBlessing={pendingTreeBlessing}
            incomingRoomInvites={incomingRoomInvites}
            onJoinRoomInvite={(room) => {
              setActiveTab('timer');
              void handleJoinStudyRoom(room);
            }}
            onConsumeTreeBlessing={() => setPendingTreeBlessing(false)}
            onSelectPreviewLevel={setPreviewLevel}
            onExitVisit={() => setVisitingFriend(null)}
            onStartFocus={() => setActiveTab('timer')}
            onRainEffect={() => pushToast('Đã gọi cơn mưa dưỡng chất 3D!')}
          />
        )}

        {activeTab === 'timer' && (
          <DeepWorkView
            user={user}
            tasks={tasks}
            friendships={friendships}
            publicGardens={publicGardens}
            secondsLeft={secondsLeft}
            totalSeconds={totalSeconds}
            isRunning={timerRunning}
            selectedPresetMins={selectedPresetMins}
            selectedTaskId={selectedTaskId}
            selectedCoStudyPairId={selectedCoStudyPairId}
            sessionIntention={sessionIntention}
            binauralMode={binauralMode}
            rainActive={rainActive}
            leaveGuardEnabled={leaveGuardEnabled}
            leaveSoundEnabled={leaveSoundEnabled}
            leaveEvents={leaveEvents}
            activeStudyRoom={activeStudyRoom}
            studyRoomMembers={studyRoomMembers}
            incomingRoomInvites={incomingRoomInvites}
            isGroupCoStudyBonus={isGroupCoStudyBonus}
            onCreateStudyRoom={handleCreateStudyRoom}
            onJoinStudyRoom={handleJoinStudyRoom}
            onInviteMoreToRoom={handleInviteMoreToRoom}
            onLeaveOrEndStudyRoom={handleLeaveOrEndStudyRoom}
            onSelectPreset={(mins, isDemo) => void handleSelectPreset(mins, isDemo)}
            onSelectTask={setSelectedTaskId}
            onSelectCoStudy={setSelectedCoStudyPairId}
            onChangeIntention={setSessionIntention}
            onToggleStart={() => void handleToggleStartTimer()}
            onReset={() => void handleResetTimer()}
            onChangeBinaural={handleChangeBinaural}
            onToggleRain={handleToggleRain}
            onToggleLeaveGuard={() => setLeaveGuardEnabled((v) => !v)}
            onToggleLeaveSound={() => setLeaveSoundEnabled((v) => !v)}
            onTestLeaveAlert={() => {
              setLastLeaveSeconds(0);
              if (leaveSoundEnabled) audioEngine.playAwakeningBell();
              setAwakeningOpen(true);
            }}
            onRequestBrowserNotif={() => {
              if ('Notification' in window) {
                void Notification.requestPermission().then((perm) => {
                  if (perm === 'granted') {
                    pushToast('Đã bật thông báo nhắc nhở khi rời trang!');
                  } else {
                    pushToast('Trình duyệt chưa cấp quyền thông báo.', 'warning');
                  }
                });
              }
            }}
            lastCompletedSession={lastCompletedSession}
            onOpenReflection={() => setReflectionOpen(true)}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            onAddTask={async (text, category, estimatedMins) => {
              if (user.role === 'judge') {
                setTasks((prev) => [
                  {
                    id: `jt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    uid: user.uid,
                    text,
                    category,
                    estimatedMins,
                    completed: false,
                    rewarded: false,
                  },
                  ...prev,
                ]);
              } else {
                await addUserTask(user.uid, { text, category, estimatedMins });
              }
              pushToast('Đã thêm nhiệm vụ mới.');
            }}
            onToggleTask={async (task) => {
              const nextCompleted = !task.completed;
              const grantNow = nextCompleted && !task.rewarded;
              if (user.role === 'judge') {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === task.id
                      ? { ...t, completed: nextCompleted, rewarded: t.rewarded || grantNow }
                      : t,
                  ),
                );
              } else {
                await updateUserTask(user.uid, task.id, {
                  completed: nextCompleted,
                  rewarded: task.rewarded || grantNow,
                });
              }
              if (grantNow) {
                await grantRewards(25, 15);
                pushToast('Hoàn thành nhiệm vụ! +25 XP & +15 mầm xanh.');
              }
            }}
            onDeleteTask={async (taskId) => {
              if (user.role === 'judge') {
                setTasks((prev) => prev.filter((t) => t.id !== taskId));
              } else {
                await removeUserTask(user.uid, taskId);
              }
            }}
            onFocusTask={handleFocusTaskFromTasks}
          />
        )}

        {activeTab === 'plant_quests' && (
          <PlantQuestsView
            user={user}
            quests={quests}
            onWaterQuest={async (quest) => {
              if (user.seedPoints < quest.seedCost) {
                pushToast('Bạn chưa đủ điểm mầm.', 'warning');
                return;
              }
              if (user.role === 'judge') {
                setQuests((prev) =>
                  prev.map((q) => (q.id === quest.id ? { ...q, count: (q.count || 0) + 1 } : q)),
                );
              } else {
                await markPlantQuestUsed(user.uid, quest);
              }
              const xpGain = quest.seedCost * 2;
              await grantRewards(xpGain, -quest.seedCost);
              setRainTriggerKey((k) => k + 1);
              pushToast(`Đã tưới dưỡng chất! +${xpGain} XP cho ${user.treeName}.`);
            }}
            onCreateQuest={async (text, seedCost) => {
              if (user.role === 'judge') {
                setQuests((prev) => [
                  ...prev,
                  {
                    id: `jq_${Date.now()}`,
                    uid: user.uid,
                    text,
                    seedCost,
                    repeatable: true,
                    completed: false,
                    count: 0,
                  },
                ]);
              } else {
                await addPlantQuest(user.uid, text, seedCost);
              }
              pushToast('Đã tạo nghi thức chăm cây mới.');
            }}
          />
        )}

        {activeTab === 'friends_pets' && (
          <FriendsAndDragonView
            user={user}
            publicGardens={publicGardens}
            friendships={friendships}
            incomingRequests={incomingReqs}
            outgoingRequests={outgoingReqs}
            incomingGifts={incomingGifts}
            onUpgradeDragon={async (level, cost, title) => {
              if (user.seedPoints < cost) return;
              await grantRewards(40, -cost, { dragonUpgradeLevel: level });
              setFireworksKey((k) => k + 1);
              pushToast(`Thiên Long đã thức tỉnh bậc ${level}: ${title}!`, 'badge');
            }}
            onSendFriendInvite={async (targetUid) => {
              await sendFriendInvite(user, targetUid);
              pushToast('Đã gửi lời mời kết bạn!');
            }}
            onRespondRequest={async (req, accept) => {
              await respondFriendRequest(req, accept);
              pushToast(accept ? `Đã trở thành bạn đồng hành với ${req.fromName}!` : 'Đã từ chối lời mời.');
            }}
            onSendGift={async (toUid, toName) => {
              if (user.seedPoints < 10) return;
              if (user.role !== 'judge') {
                await sendGardenGift(user, toUid, 30, 10);
              }
              await grantRewards(15, -10);
              pushToast(`Đã gửi tặng +30 XP cho ${toName}! Bạn nhận +15 XP.`);
            }}
            onClaimGift={async (gift) => {
              await claimGardenGift(gift.id);
              await grantRewards(gift.xpAmount, 0);
              pushToast(`Đã nhận +${gift.xpAmount} XP từ ${gift.fromName}!`);
            }}
            onVisitGarden={(garden) => {
              setVisitingFriend(garden);
              setActiveTab('home');
            }}
            onStartCoStudy={(pairId) => {
              setSelectedCoStudyPairId(pairId);
              setActiveTab('timer');
              pushToast('Đã chọn chế độ học cùng (+15% XP).');
            }}
          />
        )}

        {activeTab === 'cds' && (
          <CdsView
            user={user}
            records={cdsRecords}
            onSaveAssessment={async (score, answers) => {
              const d = new Date();
              const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (user.role === 'judge') {
                setCdsRecords((prev) => [
                  ...prev,
                  { id: `jc_${Date.now()}`, uid: user.uid, dateLabel: label, score, answers },
                ]);
                setUser((prev) => (prev ? { ...prev, lastCdsScore: score } : prev));
              } else {
                await saveCdsAssessment(user.uid, score, answers, label);
              }
              await grantRewards(20, 10);
              pushToast(`Đã lưu chỉ số CDS-HS (${score.toFixed(2)}). +20 XP & +10 mầm.`);
            }}
          />
        )}

        {activeTab === 'journal' && (
          <JournalView
            user={user}
            journals={journals}
            onSaveJournal={async (entry) => {
              if (user.role === 'judge') {
                setJournals((prev) => [{ ...entry, id: `jj_${Date.now()}`, uid: user.uid }, ...prev]);
              } else {
                await addJournalEntry(user.uid, entry);
              }
              await grantRewards(40, 25);
              pushToast('Đã lưu Sổ tay 7 mục & phân tích AI! +40 XP & +25 mầm.');
            }}
            onDeleteJournal={async (id) => {
              if (user.role === 'judge') {
                setJournals((prev) => prev.filter((j) => j.id !== id));
              } else {
                await deleteJournalEntry(user.uid, id);
              }
            }}
            onTriggerCrisis={() => setCrisisOpen(true)}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            user={user}
            aiMessages={aiMessages}
            forumMessages={forumMessages}
            friendships={friendships}
            publicGardens={publicGardens}
            onSaveAiMessage={async (role, mode: ChatMode, text) => {
              if (user.role === 'judge') {
                const now = new Date();
                setAiMessages((prev) => [
                  ...prev,
                  {
                    id: `jai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    uid: user.uid,
                    role,
                    mode,
                    text,
                    timeLabel: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                  },
                ]);
              } else {
                await saveAiMessage(user.uid, role, mode, text);
              }
            }}
            onPostForum={async (text) => {
              if (user.role === 'judge') {
                setForumMessages((prev) => [
                  ...prev,
                  {
                    id: `jf_${Date.now()}`,
                    authorUid: user.uid,
                    senderLabel: `${user.fullname} (${user.className})`,
                    treeBadge: `${user.treeName} · Lv.${user.level}`,
                    channel: 'general',
                    text,
                  },
                ]);
              } else {
                await postForumMessage(user, text);
              }
            }}
            onSendPrivateMessage={async (peerUid, text) => {
              await sendPrivatePeerMessage(user, peerUid, text);
            }}
            onTriggerCrisis={() => setCrisisOpen(true)}
          />
        )}

        {activeTab === 'research_lab' && (
          <ResearchLabView user={user} publicGardens={publicGardens} journalCount={journals.length} />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            user={user}
            publicGardens={publicGardens}
            friendships={friendships}
            incomingRequests={incomingReqs}
            outgoingRequests={outgoingReqs}
            onVisitGarden={(garden) => {
              setVisitingFriend(garden);
              setActiveTab('home');
            }}
            onSendFriendInvite={async (targetUid) => {
              await sendFriendInvite(user, targetUid);
              pushToast('Đã gửi lời mời kết bạn!');
            }}
          />
        )}

        {activeTab === 'survey' && (
          <SurveyView
            user={user}
            onSubmitSurvey={async (survey: KhktSurvey) => {
              const firstTime = !user.khktSurvey;
              if (user.role === 'judge') {
                setUser((prev) => (prev ? { ...prev, khktSurvey: survey } : prev));
              } else {
                await submitKhktSurvey(user.uid, survey);
              }
              if (firstTime) {
                await grantRewards(30, 20);
                pushToast('Cảm ơn bạn đã hoàn thành khảo sát KHKT! +30 XP & +20 mầm.');
              } else {
                pushToast('Đã cập nhật khảo sát trải nghiệm.');
              }
            }}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            journalCount={journals.length}
            onSaveProfile={async (updates) => {
              if (user.role === 'judge') {
                setUser((prev) => (prev ? { ...prev, ...updates } : prev));
              } else {
                await updateProfileInfo(user.uid, updates);
              }
              pushToast('Đã lưu thông tin hồ sơ!');
            }}
          />
        )}
      </AppShell>

      {/* Modals & Celebrations */}
      <FireworksCanvas triggerKey={fireworksKey} />
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <CdsOnboardingModal
        open={onboardingOpen}
        user={user}
        onClose={() => {
          try {
            sessionStorage.setItem(`mindful_cds_checked_${user.uid}`, '1');
          } catch {
            // ignore
          }
          setOnboardingOpen(false);
        }}
        onSaveAssessment={async (score, answers) => {
          const d = new Date();
          const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (user.role !== 'judge') {
            await saveCdsAssessment(user.uid, score, answers, label);
          } else {
            setCdsRecords((prev) => [
              ...prev,
              { id: `jc_${Date.now()}`, uid: user.uid, dateLabel: label, score, answers },
            ]);
            setUser((prev) => (prev ? { ...prev, lastCdsScore: score } : prev));
          }
          await grantRewards(20, 10);
          try {
            sessionStorage.setItem(`mindful_cds_checked_${user.uid}`, '1');
          } catch {
            // ignore
          }
          pushToast(`Đã ghi nhận CDS-HS ${score.toFixed(2)} (+20 XP & +10 mầm).`);
        }}
        onStartDeepWork={(advice) => {
          try {
            sessionStorage.setItem(`mindful_cds_checked_${user.uid}`, '1');
          } catch {
            // ignore
          }
          if (advice) {
            handleSelectPreset(advice.recommendedFocusMins, false);
            if (advice.recommendedSound === 'rain') {
              if (!rainActive) handleToggleRain();
            } else {
              handleChangeBinaural(advice.recommendedSound);
            }
          }
          setOnboardingOpen(false);
          setActiveTab('timer');
        }}
      />

      <NotificationGateModal
        open={notifGateOpen}
        onLater={() => setNotifGateOpen(false)}
        onAllow={async () => {
          setNotifGateOpen(false);
          if ('Notification' in window) {
            try {
              await Notification.requestPermission();
            } catch {
              // ignore
            }
          }
        }}
      />

      <AwakeningModal
        open={awakeningOpen}
        awaySeconds={lastLeaveSeconds}
        remainingLabel={formatClock(secondsLeft)}
        sessionIntention={sessionIntention.trim() || undefined}
        interruptionCount={user.socialInterruptionCount || 0}
        onReturnToStudy={(reason) => {
          setAwakeningOpen(false);
          if (reason) {
            setLeaveEvents((prev) =>
              prev.length > 0 ? [{ ...prev[0], reason }, ...prev.slice(1)] : prev,
            );
          }
          void grantRewards(5, 0);
          pushToast('Quay lại tâm thế tỉnh thức! +5 XP.');
        }}
        onTakeBreak={(reason) => {
          setAwakeningOpen(false);
          setTimerRunning(false);
          if (reason) {
            setLeaveEvents((prev) =>
              prev.length > 0 ? [{ ...prev[0], reason }, ...prev.slice(1)] : prev,
            );
          }
          pushToast('Đã tạm dừng phiên Deep Work để bạn nghỉ ngơi.');
        }}
      />

      <CrisisModal
        open={crisisOpen}
        onClose={() => setCrisisOpen(false)}
        onOpenCounselor={() => setActiveTab('chat')}
      />

      <RenameTreeModal
        open={renameOpen}
        currentName={user.treeName}
        onClose={() => setRenameOpen(false)}
        onSave={async (newName) => {
          const updates = {
            fullname: user.fullname,
            className: user.className,
            schoolName: user.schoolName,
            treeName: newName,
            hasNamedTree: true,
          };
          if (user.role === 'judge') {
            setUser((prev) => (prev ? { ...prev, ...updates } : prev));
          } else {
            await updateProfileInfo(user.uid, updates);
          }
          pushToast(`Đã đổi tên cây thành "${newName}".`);
        }}
      />

      <JudgeAccessModal
        open={judgeModalOpen}
        onClose={() => setJudgeModalOpen(false)}
        onUnlock={enterJudgeMode}
      />

      <DeepWorkReflectionModal
        open={reflectionOpen}
        user={user}
        session={lastCompletedSession}
        onClose={() => setReflectionOpen(false)}
        onTriggerCrisis={() => setCrisisOpen(true)}
        onOpenJournal={() => setActiveTab('journal')}
        onSaveReflection={async (_sessionId, journalEntry) => {
          if (user.role === 'judge') {
            setJournals((prev) => [{ ...journalEntry, id: `jr_${Date.now()}`, uid: user.uid }, ...prev]);
          } else {
            await addJournalEntry(user.uid, journalEntry);
          }
          await grantRewards(15, 10);
          pushToast('Đã lưu Tự phản chiếu vào Sổ tay 7 mục! +15 XP & +10 mầm xanh.');
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <MindfulAppInner />
      </MotionConfig>
    </ErrorBoundary>
  );
}
