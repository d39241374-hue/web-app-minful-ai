import type { ChatMode, DeepWorkSessionSummary } from '../types';

export interface JournalAnalysisResult {
  cognitiveTrap: string;
  insight: string;
  nextStep: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

export interface BreakdownTaskItem {
  text: string;
  category: string;
  estimatedMins: number;
}

export interface ReflectionQuestionItem {
  id: string;
  focusArea: string;
  question: string;
  quickChips: string[];
}

export interface DeepWorkReflectionPrompt {
  sessionAssessment: string;
  questions: ReflectionQuestionItem[];
}

export interface DeepWorkReflectionFeedback {
  cognitiveTrap: string;
  cdsInsight: string;
  nextMicroHabit: string;
}

export async function askGeminiCounselor(params: {
  mode: ChatMode;
  message: string;
  history: Array<{ role: string; text: string }>;
  context: {
    treeName?: string;
    level?: number;
    lastCdsScore?: number | null;
    todayFocusMins?: number;
    streakDays?: number;
  };
}): Promise<string> {
  const res = await fetch('/api/ai/counselor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!res.ok || !data.reply) {
    throw new Error(data.error || 'Không thể kết nối Cố vấn Gemini AI.');
  }
  return data.reply;
}

export async function analyzeJournalWithAi(params: {
  mood: string;
  screenTime: string;
  deepWorkNote: string;
  distractionLesson: string;
  gratitude: string;
  tomorrowPlan: string;
  cdsScore?: number | null;
}): Promise<JournalAnalysisResult> {
  const res = await fetch('/api/ai/analyze-journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<JournalAnalysisResult> & { error?: string };
  if (!res.ok || !data.insight) {
    throw new Error(data.error || 'Không thể phân tích Sổ tay với Gemini AI.');
  }
  return {
    cognitiveTrap: data.cognitiveTrap || 'Nhận diện thói quen số',
    insight: data.insight,
    nextStep: data.nextStep || '',
    riskLevel: data.riskLevel || 'low',
  };
}

export interface CdsStudyAdvice {
  statusLabel: string;
  studyAdvice: string;
  recommendedFocusMins: number;
  recommendedSound: 'alpha' | 'beta' | 'theta' | 'rain';
  warmWish: string;
}

export async function breakdownGoalWithAi(params: {
  goal: string;
  subjectHint?: string;
}): Promise<BreakdownTaskItem[]> {
  const res = await fetch('/api/ai/breakdown-goal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { tasks?: BreakdownTaskItem[]; error?: string };
  if (!res.ok || !Array.isArray(data.tasks)) {
    throw new Error(data.error || 'Không thể chia nhỏ mục tiêu bằng Gemini AI.');
  }
  return data.tasks;
}

export async function fetchCdsStudyAdvice(params: {
  answers: number[];
  score: number;
  treeName?: string;
  fullname?: string;
  todayFocusMins?: number;
  streakDays?: number;
}): Promise<CdsStudyAdvice> {
  const res = await fetch('/api/ai/cds-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CdsStudyAdvice> & { error?: string };
  if (!res.ok || !data.studyAdvice || !data.warmWish) {
    throw new Error(data.error || 'Không thể lấy lời khuyên từ Gemini AI.');
  }
  return {
    statusLabel: data.statusLabel || 'Sẵn sàng tập trung',
    studyAdvice: data.studyAdvice,
    recommendedFocusMins: data.recommendedFocusMins || 25,
    recommendedSound:
      data.recommendedSound === 'alpha' ||
      data.recommendedSound === 'beta' ||
      data.recommendedSound === 'theta' ||
      data.recommendedSound === 'rain'
        ? data.recommendedSound
        : 'rain',
    warmWish: data.warmWish,
  };
}

export async function fetchDeepWorkReflectionQuestions(params: {
  session: DeepWorkSessionSummary;
  fullname?: string;
  treeName?: string;
}): Promise<DeepWorkReflectionPrompt> {
  const res = await fetch('/api/ai/deepwork-reflection-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationMins: params.session.durationMins,
      intention: params.session.intention,
      taskText: params.session.taskText,
      interruptionCount: params.session.interruptionCount,
      awaySecs: params.session.awaySecs,
      soundMode: params.session.soundMode,
      isGroupSession: params.session.isGroupSession,
      groupSize: params.session.groupSize,
      lastCdsScore: params.session.lastCdsScore,
      fullname: params.fullname,
      treeName: params.treeName,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<DeepWorkReflectionPrompt> & { error?: string };
  if (!res.ok || !data.sessionAssessment || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error(data.error || 'Không thể tạo câu hỏi tự phản chiếu từ Gemini AI.');
  }
  return {
    sessionAssessment: data.sessionAssessment,
    questions: data.questions.slice(0, 3),
  };
}

export async function submitDeepWorkReflectionFeedback(params: {
  session: DeepWorkSessionSummary;
  focusScore: number;
  answers: Array<{ question: string; answer: string }>;
}): Promise<DeepWorkReflectionFeedback> {
  const res = await fetch('/api/ai/deepwork-reflection-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationMins: params.session.durationMins,
      intention: params.session.intention,
      interruptionCount: params.session.interruptionCount,
      awaySecs: params.session.awaySecs,
      focusScore: params.focusScore,
      lastCdsScore: params.session.lastCdsScore,
      answers: params.answers,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<DeepWorkReflectionFeedback> & { error?: string };
  if (!res.ok || !data.cdsInsight) {
    throw new Error(data.error || 'Không thể phân tích tự phản chiếu với Gemini AI.');
  }
  return {
    cognitiveTrap: data.cognitiveTrap || 'Nhận thức chủ động số',
    cdsInsight: data.cdsInsight,
    nextMicroHabit: data.nextMicroHabit || 'Giữ điện thoại ngoài tầm tay ở phiên tiếp theo.',
  };
}

