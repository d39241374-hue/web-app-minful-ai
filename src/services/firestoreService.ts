import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  getDefaultPlantQuests,
  getMaxXpForLevel,
  getTodayDateStr,
} from '../constants';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AiChatMessage,
  CdsRecord,
  ChatMode,
  ForumMessage,
  FriendRequest,
  Friendship,
  GardenGift,
  JournalEntry,
  KhktSurvey,
  PlantQuest,
  PrivateMessage,
  PublicGarden,
  StudyRoom,
  StudyRoomMember,
  StudyRoomMemberStatus,
  StudyRoomStatus,
  UserProfile,
  UserTask,
} from '../types';

export function getPairId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('__');
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function ensureUserDocuments(firebaseUser: User): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;
  const publicPath = `publicGardens/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // Ensure public garden exists in case of partial creation
      const pubSnap = await getDoc(doc(db, 'publicGardens', uid));
      if (!pubSnap.exists()) {
        await setDoc(doc(db, 'publicGardens', uid), {
          uid,
          fullname: data.fullname,
          className: data.className,
          schoolName: data.schoolName,
          treeName: data.treeName,
          level: data.level,
          xp: data.xp,
          streakDays: data.streakDays,
          todayFocusMins: data.todayFocusMins,
          dragonUpgradeLevel: data.dragonUpgradeLevel,
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
      }
      return data;
    }

    const displayName = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Học sinh Mindful').slice(0, 80);
    const today = getTodayDateStr();
    const initialProfile: UserProfile = {
      uid,
      email: firebaseUser.email || `${uid}@mindful.local`,
      fullname: displayName,
      className: '11A1',
      schoolName: 'THPT Hương Khê',
      treeName: 'Cây Tri Thức',
      hasNamedTree: false,
      level: 1,
      xp: 0,
      maxXp: getMaxXpForLevel(1),
      seedPoints: 20,
      streakDays: 1,
      lastActiveDate: today,
      todayFocusMins: 0,
      weeklyFocusMins: [0, 0, 0, 0, 0, 0, 0],
      socialInterruptionCount: 0,
      dragonUpgradeLevel: 0,
      exploredStages: [1],
      hasBadgeKienTri: false,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'publicGardens', uid), {
      uid,
      fullname: initialProfile.fullname,
      className: initialProfile.className,
      schoolName: initialProfile.schoolName,
      treeName: initialProfile.treeName,
      level: 1,
      xp: 0,
      streakDays: 1,
      todayFocusMins: 0,
      dragonUpgradeLevel: 0,
      isPublic: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const defaultQuests = getDefaultPlantQuests(uid);
    for (let i = 0; i < defaultQuests.length; i++) {
      const qId = `quest_default_${i + 1}`;
      await setDoc(doc(db, 'users', uid, 'plantQuests', qId), {
        ...defaultQuests[i],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return initialProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath || publicPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path),
  );
}

function tsMillis(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function subscribeUserTasks(uid: string, onData: (tasks: UserTask[]) => void): Unsubscribe {
  const path = `users/${uid}/tasks`;
  const q = query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<UserTask, 'id'> & { createdAt?: unknown };
          return { ...data, id: d.id, _ts: tsMillis(data.createdAt) };
        })
        .sort((a, b) => b._ts - a._ts)
        .map(({ _ts: _ignored, ...rest }) => rest as UserTask);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribePlantQuests(uid: string, onData: (quests: PlantQuest[]) => void): Unsubscribe {
  const path = `users/${uid}/plantQuests`;
  const q = query(collection(db, 'users', uid, 'plantQuests'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<PlantQuest, 'id'>) }))
        .sort((a, b) => (a.seedCost || 0) - (b.seedCost || 0));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeJournals(uid: string, onData: (entries: JournalEntry[]) => void): Unsubscribe {
  const path = `users/${uid}/journals`;
  const q = query(collection(db, 'users', uid, 'journals'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<JournalEntry, 'id'> & { createdAt?: unknown };
          return { ...data, id: d.id, _ts: tsMillis(data.createdAt) };
        })
        .sort((a, b) => b._ts - a._ts)
        .map(({ _ts: _ignored, ...rest }) => rest as JournalEntry);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeCdsRecords(uid: string, onData: (records: CdsRecord[]) => void): Unsubscribe {
  const path = `users/${uid}/cdsRecords`;
  const q = query(collection(db, 'users', uid, 'cdsRecords'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<CdsRecord, 'id'> & { createdAt?: unknown };
          return { ...data, id: d.id, _ts: tsMillis(data.createdAt) };
        })
        .sort((a, b) => a._ts - b._ts)
        .map(({ _ts: _ignored, ...rest }) => rest as CdsRecord);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeAiMessages(uid: string, onData: (msgs: AiChatMessage[]) => void): Unsubscribe {
  const path = `users/${uid}/aiMessages`;
  const q = query(collection(db, 'users', uid, 'aiMessages'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<AiChatMessage, 'id'> & { createdAt?: { toDate?: () => Date; toMillis?: () => number } };
          const date = raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date();
          return {
            id: d.id,
            uid: raw.uid,
            role: raw.role,
            mode: raw.mode,
            text: raw.text,
            timeLabel: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            _ts: tsMillis(raw.createdAt),
          };
        })
        .sort((a, b) => a._ts - b._ts)
        .map(({ _ts: _ignored, ...rest }) => rest);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribePublicGardens(onData: (gardens: PublicGarden[]) => void): Unsubscribe {
  const path = 'publicGardens';
  const q = query(collection(db, 'publicGardens'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PublicGarden));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeFriendRequests(
  uid: string,
  onData: (incoming: FriendRequest[], outgoing: FriendRequest[]) => void,
): Unsubscribe {
  const path = 'friendRequests';
  const qIn = query(collection(db, 'friendRequests'), where('toUid', '==', uid));
  const qOut = query(collection(db, 'friendRequests'), where('fromUid', '==', uid));
  let latestIn: FriendRequest[] = [];
  let latestOut: FriendRequest[] = [];

  const u1 = onSnapshot(
    qIn,
    (snap) => {
      latestIn = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
      onData(latestIn, latestOut);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
  const u2 = onSnapshot(
    qOut,
    (snap) => {
      latestOut = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
      onData(latestIn, latestOut);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
  return () => {
    u1();
    u2();
  };
}

export function subscribeFriendships(uid: string, onData: (friendships: Friendship[]) => void): Unsubscribe {
  const path = 'friendships';
  const qA = query(collection(db, 'friendships'), where('uidA', '==', uid));
  const qB = query(collection(db, 'friendships'), where('uidB', '==', uid));
  let listA: Friendship[] = [];
  let listB: Friendship[] = [];

  const emit = () => {
    const map = new Map<string, Friendship>();
    [...listA, ...listB].forEach((f) => map.set(f.id, f));
    onData(Array.from(map.values()));
  };

  const u1 = onSnapshot(
    qA,
    (snap) => {
      listA = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
  const u2 = onSnapshot(
    qB,
    (snap) => {
      listB = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
  return () => {
    u1();
    u2();
  };
}

export function subscribeIncomingGifts(uid: string, onData: (gifts: GardenGift[]) => void): Unsubscribe {
  const path = 'gardenGifts';
  const q = query(collection(db, 'gardenGifts'), where('toUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GardenGift, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeForumMessages(onData: (msgs: ForumMessage[]) => void): Unsubscribe {
  const path = 'forumMessages';
  const q = query(collection(db, 'forumMessages'), where('channel', '==', 'general'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<ForumMessage, 'id'> & { createdAt?: { toDate?: () => Date; toMillis?: () => number } };
          const date = raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date();
          return {
            id: d.id,
            authorUid: raw.authorUid,
            senderLabel: raw.senderLabel,
            treeBadge: raw.treeBadge,
            channel: 'general' as const,
            text: raw.text,
            timeLabel: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            _ts: tsMillis(raw.createdAt),
          };
        })
        .sort((a, b) => a._ts - b._ts)
        .map(({ _ts: _ignored, ...rest }) => rest);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribePrivateMessages(
  meUid: string,
  peerUid: string,
  onData: (msgs: PrivateMessage[]) => void,
): Unsubscribe {
  const [uidA, uidB] = [meUid, peerUid].sort();
  const pairId = `${uidA}__${uidB}`;
  const path = `privateChats/${pairId}/messages`;
  const fieldKey = meUid === uidA ? 'uidA' : 'uidB';
  const q = query(collection(db, 'privateChats', pairId, 'messages'), where(fieldKey, '==', meUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<PrivateMessage, 'id'> & { createdAt?: { toDate?: () => Date; toMillis?: () => number } };
          const date = raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date();
          return {
            id: d.id,
            uidA: raw.uidA,
            uidB: raw.uidB,
            senderUid: raw.senderUid,
            senderName: raw.senderName,
            text: raw.text,
            timeLabel: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            _ts: tsMillis(raw.createdAt),
          };
        })
        .sort((a, b) => a._ts - b._ts)
        .map(({ _ts: _ignored, ...rest }) => rest);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function updateProfileInfo(
  uid: string,
  updates: Pick<UserProfile, 'fullname' | 'className' | 'schoolName' | 'treeName' | 'hasNamedTree'>,
) {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'publicGardens', uid), {
      fullname: updates.fullname,
      className: updates.className,
      schoolName: updates.schoolName,
      treeName: updates.treeName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateProgressionStats(
  uid: string,
  updates: Pick<
    UserProfile,
    | 'level'
    | 'xp'
    | 'maxXp'
    | 'seedPoints'
    | 'streakDays'
    | 'lastActiveDate'
    | 'todayFocusMins'
    | 'weeklyFocusMins'
    | 'socialInterruptionCount'
    | 'dragonUpgradeLevel'
    | 'exploredStages'
    | 'hasBadgeKienTri'
  >,
) {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'publicGardens', uid), {
      level: updates.level,
      xp: updates.xp,
      streakDays: updates.streakDays,
      todayFocusMins: updates.todayFocusMins,
      dragonUpgradeLevel: updates.dragonUpgradeLevel,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function addUserTask(
  uid: string,
  task: { text: string; category: string; estimatedMins?: number },
): Promise<string> {
  const id = makeSafeId('task');
  const path = `users/${uid}/tasks/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'tasks', id), {
      uid,
      text: task.text.slice(0, 240),
      category: task.category.slice(0, 40),
      ...(task.estimatedMins ? { estimatedMins: Math.max(5, Math.min(180, Math.round(task.estimatedMins))) } : {}),
      completed: false,
      rewarded: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateUserTask(
  uid: string,
  taskId: string,
  updates: { completed: boolean; rewarded: boolean },
) {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function removeUserTask(uid: string, taskId: string) {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function addPlantQuest(uid: string, text: string, seedCost: number) {
  const id = makeSafeId('quest');
  const path = `users/${uid}/plantQuests/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'plantQuests', id), {
      uid,
      text: text.slice(0, 200),
      seedCost: Math.max(10, Math.min(1000, Math.round(seedCost))),
      repeatable: true,
      completed: false,
      count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markPlantQuestUsed(uid: string, quest: PlantQuest) {
  const path = `users/${uid}/plantQuests/${quest.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'plantQuests', quest.id), {
      count: (quest.count || 0) + 1,
      completed: quest.repeatable ? false : true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveCdsAssessment(uid: string, score: number, answers: number[], dateLabel: string) {
  const id = makeSafeId('cds');
  const path = `users/${uid}/cdsRecords/${id}`;
  try {
    const rounded = Number(score.toFixed(2));
    await setDoc(doc(db, 'users', uid, 'cdsRecords', id), {
      uid,
      dateLabel,
      score: rounded,
      answers,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', uid), {
      lastCdsScore: rounded,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function addJournalEntry(
  uid: string,
  entry: Omit<JournalEntry, 'id' | 'uid'>,
): Promise<string> {
  const id = makeSafeId('journal');
  const path = `users/${uid}/journals/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'journals', id), {
      uid,
      dateLabel: entry.dateLabel,
      mood: entry.mood,
      screenTime: entry.screenTime,
      deepWorkNote: entry.deepWorkNote,
      distractionLesson: entry.distractionLesson,
      gratitude: entry.gratitude,
      tomorrowPlan: entry.tomorrowPlan,
      cdsNote: entry.cdsNote,
      ...(entry.aiCognitiveTrap ? { aiCognitiveTrap: entry.aiCognitiveTrap } : {}),
      ...(entry.aiInsight ? { aiInsight: entry.aiInsight } : {}),
      ...(entry.aiNextStep ? { aiNextStep: entry.aiNextStep } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateJournalAiAnalysis(
  uid: string,
  journalId: string,
  analysis: { aiCognitiveTrap: string; aiInsight: string; aiNextStep: string },
) {
  const path = `users/${uid}/journals/${journalId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'journals', journalId), {
      aiCognitiveTrap: analysis.aiCognitiveTrap.slice(0, 160),
      aiInsight: analysis.aiInsight.slice(0, 800),
      aiNextStep: analysis.aiNextStep.slice(0, 400),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteJournalEntry(uid: string, journalId: string) {
  const path = `users/${uid}/journals/${journalId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'journals', journalId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function submitKhktSurvey(uid: string, survey: KhktSurvey) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      khktSurvey: survey,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function sendFriendInvite(me: UserProfile, targetUid: string) {
  const id = getPairId(me.uid, targetUid);
  const path = `friendRequests/${id}`;
  try {
    await setDoc(doc(db, 'friendRequests', id), {
      fromUid: me.uid,
      fromName: me.fullname,
      fromClass: me.className,
      fromTreeName: me.treeName || 'Cây Tri Thức',
      fromLevel: me.level || 1,
      toUid: targetUid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function respondFriendRequest(
  req: FriendRequest,
  accept: boolean,
) {
  const reqPath = `friendRequests/${req.id}`;
  try {
    await updateDoc(doc(db, 'friendRequests', req.id), {
      status: accept ? 'accepted' : 'declined',
      updatedAt: serverTimestamp(),
    });

    if (accept) {
      const [uidA, uidB] = [req.fromUid, req.toUid].sort();
      const pairId = `${uidA}__${uidB}`;
      await setDoc(doc(db, 'friendships', pairId), {
        uidA,
        uidB,
        days: 1,
        lastCoStudyDate: getTodayDateStr(),
        coTreeXp: 50,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, reqPath);
  }
}

export async function updateCoStudyStreak(friendship: Friendship, xpAdded: number) {
  const path = `friendships/${friendship.id}`;
  const today = getTodayDateStr();
  try {
    const nextDays = friendship.lastCoStudyDate !== today ? friendship.days + 1 : friendship.days;
    await updateDoc(doc(db, 'friendships', friendship.id), {
      days: nextDays,
      lastCoStudyDate: today,
      coTreeXp: (friendship.coTreeXp || 0) + xpAdded,
      updatedAt: serverTimestamp(),
    });
    return nextDays;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function sendGardenGift(me: UserProfile, toUid: string, xpAmount: number, seedCost: number) {
  const id = makeSafeId('gift');
  const path = `gardenGifts/${id}`;
  try {
    await setDoc(doc(db, 'gardenGifts', id), {
      fromUid: me.uid,
      fromName: me.fullname,
      toUid,
      xpAmount,
      seedCost,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function claimGardenGift(giftId: string) {
  const path = `gardenGifts/${giftId}`;
  try {
    await updateDoc(doc(db, 'gardenGifts', giftId), {
      status: 'claimed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function postForumMessage(me: UserProfile, text: string) {
  const id = makeSafeId('forum');
  const path = `forumMessages/${id}`;
  try {
    await setDoc(doc(db, 'forumMessages', id), {
      authorUid: me.uid,
      senderLabel: `${me.fullname} (${me.className})`,
      treeBadge: `${me.treeName || 'Cây Tri Thức'} · Lv.${me.level || 1}`,
      channel: 'general',
      text: text.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function sendPrivatePeerMessage(me: UserProfile, peerUid: string, text: string) {
  const [uidA, uidB] = [me.uid, peerUid].sort();
  const pairId = `${uidA}__${uidB}`;
  const roomPath = `privateChats/${pairId}`;
  try {
    const roomSnap = await getDoc(doc(db, 'privateChats', pairId));
    if (!roomSnap.exists()) {
      await setDoc(doc(db, 'privateChats', pairId), {
        uidA,
        uidB,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'privateChats', pairId), {
        updatedAt: serverTimestamp(),
      });
    }
    const msgId = makeSafeId('pm');
    await setDoc(doc(db, 'privateChats', pairId, 'messages', msgId), {
      uidA,
      uidB,
      senderUid: me.uid,
      senderName: me.fullname,
      text: text.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, roomPath);
  }
}

export async function saveAiMessage(uid: string, role: 'user' | 'assistant', mode: ChatMode, text: string) {
  const id = makeSafeId('ai');
  const path = `users/${uid}/aiMessages/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'aiMessages', id), {
      uid,
      role,
      mode,
      text: text.slice(0, 4000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeStudyRooms(
  uid: string,
  onData: (rooms: StudyRoom[]) => void,
): Unsubscribe {
  const path = 'studyRooms';
  const q = query(collection(db, 'studyRooms'), where('participantUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const nowMs = Date.now();
      const items = snap.docs
        .map((d) => {
          const raw = d.data() as {
            id?: string;
            hostUid: string;
            hostName: string;
            title: string;
            durationSecs: number;
            remainingSecs: number;
            status: StudyRoomStatus;
            participantUids: string[];
            timerUpdatedAt?: unknown;
            createdAt?: unknown;
          };
          const timerMs = tsMillis(raw.timerUpdatedAt) || nowMs;
          const createdMs = tsMillis(raw.createdAt) || nowMs;
          return {
            id: raw.id || d.id,
            hostUid: raw.hostUid,
            hostName: raw.hostName,
            title: raw.title,
            durationSecs: raw.durationSecs,
            remainingSecs: raw.remainingSecs,
            status: raw.status,
            participantUids: Array.isArray(raw.participantUids) ? raw.participantUids : [raw.hostUid],
            timerUpdatedAtMs: timerMs,
            createdAtMs: createdMs,
          } satisfies StudyRoom;
        })
        .filter((r) => r.status !== 'ended')
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export function subscribeStudyRoomMembers(
  roomId: string,
  participantUids: string[],
  onData: (members: StudyRoomMember[]) => void,
): Unsubscribe {
  const uniqueUids = Array.from(new Set(participantUids)).slice(0, 8);
  const memberMap = new Map<string, StudyRoomMember>();

  const emit = () => {
    const ordered = uniqueUids
      .map((uid) => memberMap.get(uid))
      .filter((m): m is StudyRoomMember => Boolean(m));
    onData(ordered);
  };

  if (uniqueUids.length === 0) {
    onData([]);
    return () => {};
  }

  const unsubs = uniqueUids.map((memberUid) => {
    const path = `studyRooms/${roomId}/members/${memberUid}`;
    return onSnapshot(
      doc(db, 'studyRooms', roomId, 'members', memberUid),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as Omit<StudyRoomMember, 'updatedAtMs'> & { updatedAt?: unknown };
          memberMap.set(memberUid, {
            roomId: raw.roomId,
            uid: raw.uid,
            fullname: raw.fullname,
            className: raw.className,
            treeName: raw.treeName,
            level: raw.level,
            status: raw.status,
            intention: raw.intention || '',
            updatedAtMs: tsMillis(raw.updatedAt) || Date.now(),
          });
        } else {
          memberMap.delete(memberUid);
        }
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.GET, path),
    );
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function createStudyRoom(
  me: UserProfile,
  input: {
    title: string;
    durationSecs: number;
    invitedUids: string[];
    intention?: string;
  },
): Promise<string> {
  const roomId = makeSafeId('room');
  const roomPath = `studyRooms/${roomId}`;
  const memberPath = `studyRooms/${roomId}/members/${me.uid}`;
  const safeDuration = Math.max(10, Math.min(10800, Math.round(input.durationSecs)));
  const safeTitle = (input.title.trim() || 'Phiên học nhóm Deep Work').slice(0, 100);
  const participantUids = Array.from(
    new Set([me.uid, ...input.invitedUids.filter((u) => Boolean(u) && u !== me.uid)]),
  ).slice(0, 8);

  try {
    await setDoc(doc(db, 'studyRooms', roomId), {
      id: roomId,
      hostUid: me.uid,
      hostName: (me.fullname || 'Học sinh').slice(0, 80),
      title: safeTitle,
      durationSecs: safeDuration,
      remainingSecs: safeDuration,
      status: 'waiting',
      participantUids,
      timerUpdatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, roomPath);
  }

  try {
    await setDoc(doc(db, 'studyRooms', roomId, 'members', me.uid), {
      roomId,
      uid: me.uid,
      fullname: (me.fullname || 'Học sinh').slice(0, 80),
      className: (me.className || '11A1').slice(0, 40),
      treeName: (me.treeName || 'Cây Tri Thức').slice(0, 32),
      level: Math.max(1, Math.min(10, Math.round(me.level || 1))),
      status: 'ready',
      intention: (input.intention || '').trim().slice(0, 140),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, memberPath);
  }

  return roomId;
}

export async function inviteStudyRoomParticipants(
  roomId: string,
  hostUid: string,
  currentUids: string[],
  newFriendUids: string[],
) {
  const path = `studyRooms/${roomId}`;
  const merged = Array.from(new Set([hostUid, ...currentUids, ...newFriendUids])).slice(0, 8);
  try {
    await updateDoc(doc(db, 'studyRooms', roomId), {
      participantUids: merged,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateStudyRoomTimer(
  roomId: string,
  updates: {
    status?: StudyRoomStatus;
    durationSecs?: number;
    remainingSecs?: number;
    title?: string;
  },
) {
  const path = `studyRooms/${roomId}`;
  const payload: Record<string, unknown> = {
    timerUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.durationSecs !== undefined) {
    payload.durationSecs = Math.max(10, Math.min(10800, Math.round(updates.durationSecs)));
  }
  if (updates.remainingSecs !== undefined) {
    payload.remainingSecs = Math.max(0, Math.min(10800, Math.round(updates.remainingSecs)));
  }
  if (updates.title !== undefined) {
    payload.title = (updates.title.trim() || 'Phiên học nhóm Deep Work').slice(0, 100);
  }
  try {
    await updateDoc(doc(db, 'studyRooms', roomId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function joinOrUpdateStudyRoomMember(
  roomId: string,
  me: UserProfile,
  updates: {
    status: StudyRoomMemberStatus;
    intention: string;
  },
) {
  const path = `studyRooms/${roomId}/members/${me.uid}`;
  const ref = doc(db, 'studyRooms', roomId, 'members', me.uid);
  const profileFields = {
    fullname: (me.fullname || 'Học sinh').slice(0, 80),
    className: (me.className || '11A1').slice(0, 40),
    treeName: (me.treeName || 'Cây Tri Thức').slice(0, 32),
    level: Math.max(1, Math.min(10, Math.round(me.level || 1))),
    status: updates.status,
    intention: updates.intention.trim().slice(0, 140),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        roomId,
        uid: me.uid,
        ...profileFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...profileFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

