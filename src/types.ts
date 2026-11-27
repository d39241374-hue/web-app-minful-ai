export type TabId =
  | 'home'
  | 'timer'
  | 'tasks'
  | 'plant_quests'
  | 'friends_pets'
  | 'cds'
  | 'journal'
  | 'chat'
  | 'research_lab'
  | 'leaderboard'
  | 'survey'
  | 'profile';

export type ChatMode = 'counselor' | 'math' | 'literature' | 'english';
export type BinauralMode = 'none' | 'alpha' | 'beta' | 'theta';
export type WeatherEffect = 'clear' | 'sunlight' | 'rain' | 'autumn' | 'snow';

export interface KhktSurvey {
  s1: number;
  s2: number;
  s3: number;
  date: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullname: string;
  className: string;
  schoolName: string;
  treeName: string;
  hasNamedTree: boolean;
  level: number;
  xp: number;
  maxXp: number;
  seedPoints: number;
  streakDays: number;
  lastActiveDate: string;
  todayFocusMins: number;
  weeklyFocusMins: number[];
  socialInterruptionCount: number;
  dragonUpgradeLevel: number;
  lastCdsScore?: number;
  exploredStages: number[];
  hasBadgeKienTri: boolean;
  khktSurvey?: KhktSurvey;
  role?: 'student' | 'judge';
}

export interface PublicGarden {
  uid: string;
  fullname: string;
  className: string;
  schoolName: string;
  treeName: string;
  level: number;
  xp: number;
  streakDays: number;
  todayFocusMins: number;
  dragonUpgradeLevel: number;
  isPublic: boolean;
}

export interface UserTask {
  id: string;
  uid: string;
  text: string;
  category: string;
  estimatedMins?: number;
  completed: boolean;
  rewarded: boolean;
}

export interface PlantQuest {
  id: string;
  uid: string;
  text: string;
  seedCost: number;
  repeatable: boolean;
  completed: boolean;
  count: number;
}

export interface JournalEntry {
  id: string;
  uid: string;
  dateLabel: string;
  mood: string;
  screenTime: string;
  deepWorkNote: string;
  distractionLesson: string;
  gratitude: string;
  tomorrowPlan: string;
  cdsNote: string;
  aiCognitiveTrap?: string;
  aiInsight?: string;
  aiNextStep?: string;
}

export interface CdsRecord {
  id: string;
  uid: string;
  dateLabel: string;
  score: number;
  answers: number[];
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromClass: string;
  fromTreeName: string;
  fromLevel: number;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface Friendship {
  id: string;
  uidA: string;
  uidB: string;
  days: number;
  lastCoStudyDate: string;
  coTreeXp: number;
}

export interface GardenGift {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  xpAmount: number;
  seedCost: number;
  status: 'pending' | 'claimed';
}

export interface ForumMessage {
  id: string;
  authorUid: string;
  senderLabel: string;
  treeBadge: string;
  channel: 'general';
  text: string;
  timeLabel?: string;
}

export interface PrivateMessage {
  id: string;
  uidA: string;
  uidB: string;
  senderUid: string;
  senderName: string;
  text: string;
  timeLabel?: string;
}

export interface AiChatMessage {
  id: string;
  uid: string;
  role: 'user' | 'assistant';
  mode: ChatMode;
  text: string;
  timeLabel?: string;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'badge';
}

export interface LeaveEventLog {
  id: string;
  timeLabel: string;
  awaySeconds: number;
  remainingLabel: string;
  reason?: string;
}

export type StudyRoomStatus = 'waiting' | 'running' | 'paused' | 'ended';
export type StudyRoomMemberStatus = 'ready' | 'focusing' | 'paused' | 'away' | 'completed' | 'left';

export interface StudyRoom {
  id: string;
  hostUid: string;
  hostName: string;
  title: string;
  durationSecs: number;
  remainingSecs: number;
  status: StudyRoomStatus;
  participantUids: string[];
  timerUpdatedAtMs: number;
  createdAtMs: number;
}

export interface StudyRoomMember {
  roomId: string;
  uid: string;
  fullname: string;
  className: string;
  treeName: string;
  level: number;
  status: StudyRoomMemberStatus;
  intention: string;
  updatedAtMs: number;
}

export interface DeepWorkSessionSummary {
  id: string;
  durationMins: number;
  intention: string;
  taskText?: string;
  interruptionCount: number;
  awaySecs: number;
  soundMode: BinauralMode | 'rain';
  isGroupSession: boolean;
  groupSize?: number;
  xpEarned: number;
  seedsEarned: number;
  lastCdsScore?: number | null;
  completedAtLabel: string;
}


