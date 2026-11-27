import type { PlantQuest, UserProfile, WeatherEffect } from './types';

export const JUDGE_PASSWORD = '101010';
export const JUDGE_UID = 'judge_sandbox';

export interface StageInfo {
  level: number;
  tree: string;
  dragon: string;
}

export interface WeatherOption {
  id: WeatherEffect;
  label: string;
  minLevel: number;
  description: string;
}

export const WEATHER_OPTIONS: WeatherOption[] = [
  {
    id: 'clear',
    label: 'Tự nhiên',
    minLevel: 1,
    description: 'Khí quyển nguyên bản theo giai đoạn phát triển của cây',
  },
  {
    id: 'sunlight',
    label: 'Nắng vàng',
    minLevel: 1,
    description: 'Tia nắng ấm áp và bụi ánh sáng quang hợp quanh tán cây',
  },
  {
    id: 'rain',
    label: 'Mưa nhẹ',
    minLevel: 2,
    description: 'Cơn mưa dưỡng chất dịu mát nuôi dưỡng mầm non bén rễ',
  },
  {
    id: 'autumn',
    label: 'Lá vàng',
    minLevel: 4,
    description: 'Lá thu vàng óng xoay bay nhẹ nhàng quanh tán cây trưởng thành',
  },
  {
    id: 'snow',
    label: 'Tuyết rơi',
    minLevel: 6,
    description: 'Bông tuyết bồng bềnh và làn sương lạnh quanh Cổ Thụ Linh Khí',
  },
];

export const STAGE_INFO: StageInfo[] = [
  { level: 1, tree: 'Hạt Mầm Tỉnh Thức', dragon: 'Rồng Chibi Ngọc Lục Bảo' },
  { level: 2, tree: 'Mầm Non Vươn Mình', dragon: 'Rồng Chibi Lá Non' },
  { level: 3, tree: 'Cây Non Bén Rễ', dragon: 'Rồng Chibi Thanh Ngọc' },
  { level: 4, tree: 'Cây Xanh Tỏa Bóng', dragon: 'Rồng Chibi Lam Ngọc' },
  { level: 5, tree: 'Cây Trưởng Thành Sum Suê', dragon: 'Rồng Chibi Thiên Thanh' },
  { level: 6, tree: 'Cổ Thụ Linh Khí', dragon: 'Rồng Chibi Tử Tinh' },
  { level: 7, tree: 'Cổ Thụ Anh Đào Nở Hoa', dragon: 'Rồng Chibi Anh Đào' },
  { level: 8, tree: 'Thần Thụ Tinh Vân (Sơ Khai)', dragon: 'Thần Long Tinh Vân Cực Quang' },
  { level: 9, tree: 'Thần Thụ Huyền Không (Đại Thành)', dragon: 'Thần Long Huyền Vũ Tinh Tú' },
  { level: 10, tree: 'Thần Thụ Kim Quang Thiên Giới', dragon: 'Bạch Kim Ngọc Long Viền Vàng Đồng' },
];

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Hạt Mầm Khởi Nguyên',
  2: 'Cây Non Bén Rễ',
  3: 'Cây Tơ Vươn Cành',
  4: 'Cây Trưởng Thành Đơm Hoa',
  5: 'Đại Thụ Kết Trái & Hồ Tĩnh Tâm',
  6: 'Cổ Thụ Linh Khí & Đèn Lồng',
  7: 'Cổ Thụ Bách Hoa Rực Rỡ',
  8: 'Cổ Thụ Pha Lê Long Mạch',
  9: 'Thần Thụ Hoàng Kim Nhật Nguyệt',
  10: 'Đại Cổ Thụ Yggdrasil • Long Vương Tối Thượng',
};

export const TREE_STAGE_QUOTES: Record<number, string> = {
  1: 'Cấp 1 · Hạt Mầm Khởi Nguyên (150 XP): Mầm Linh Mộc đầu tiên nảy nở, bắt đầu hành trình tỉnh thức...',
  2: 'Cấp 2 · Cây Non Bén Rễ (300 XP): Rời hạt mầm bén rễ vào đảo nổi, thân gỗ non vươn cao cùng tán lá xanh mướt.',
  3: 'Cấp 3 · Cây Tơ Vươn Cành (600 XP): Bộ rễ bám chắc, cành nhánh xòe rộng đón ánh sáng tập trung sâu.',
  4: 'Cấp 4 · Cây Trưởng Thành Đơm Hoa (1.200 XP): Tán Linh Mộc vươn cao vững vàng, thu hút năng lượng tỉnh thức.',
  5: 'Cấp 5 · Đại Thụ Tỏa Bóng (2.400 XP): Tán lá sum suê che chở tâm trí trước mọi xao nhãng số.',
  6: 'Cấp 6 · Cổ Thụ Linh Khí (4.800 XP): Thân cổ thụ vững chãi cùng Rồng Chibi Tử Tinh đồng hành.',
  7: 'Cấp 7 · Cổ Thụ Anh Đào Nở Hoa (9.600 XP): Cánh hoa anh đào rơi nhẹ quanh tán lá ngọc, tỏa hương trí tuệ!',
  8: 'Cấp 8 · Thần Thụ Tinh Vân (19.200 XP): Long mạch phát sáng xuyên thân cổ thụ, Thần Long thức tỉnh trên đảo bay!',
  9: 'Cấp 9 · Thần Thụ Huyền Không (38.400 XP): Tán lá tinh vân hòa nhịp cùng 3 vòng thiên văn xoay đa trục!',
  10: 'Cấp 10 · Thần Thụ Kim Quang Thiên Giới (76.800 XP): Đỉnh cao viên mãn! Vương miện Thiên Giới & Bạch Kim Ngọc Long!',
};

export const DRAGON_UPGRADES = [
  { level: 1, cost: 50, bonus: 0.05, title: 'Vảy Ngọc' },
  { level: 2, cost: 100, bonus: 0.05, title: 'Hơi Thở Tinh Tú' },
  { level: 3, cost: 180, bonus: 0.05, title: 'Cánh Ngân Hà' },
  { level: 4, cost: 280, bonus: 0.05, title: 'Long Uy Thức Tỉnh' },
  { level: 5, cost: 400, bonus: 0.10, title: 'Thiên Long Tối Thượng' },
] as const;

export const CDS_QUESTIONS_10: string[] = [
  '1. Tôi cảm thấy bồn chồn hoặc bứt rứt khi không kiểm tra điện thoại/mạng xã hội trong lúc học.',
  '2. Tôi thường tự nhủ chỉ lướt mạng vài phút nhưng cuối cùng lại tốn nhiều thời gian hơn dự định.',
  '3. Tôi cảm thấy dằn vặt hoặc tiếc nuối vào cuối buổi tối vì đã dành thời gian lướt mạng thay vì ôn bài.',
  '4. Thông báo từ mạng xã hội dễ làm đứt mạch suy nghĩ khi tôi đang giải bài tập khó.',
  '5. Tôi có xu hướng mở ứng dụng giải trí để né tránh cảm giác áp lực hoặc chán nản khi học.',
  '6. Việc tiếp xúc liên tục với video ngắn khiến tôi khó tập trung đọc sâu một nội dung dài.',
  '7. Tôi nhận thấy chất lượng giấc ngủ bị ảnh hưởng khi sử dụng điện thoại trước giờ đi ngủ.',
  '8. Tôi cảm thấy khó duy trì trọn vẹn một phiên tự học tập trung liên tục mà không bị phân tâm.',
  '9. Tôi thường so sánh bản thân với người khác trên mạng xã hội và thấy áp lực tinh thần.',
  '10. Tôi nhận ra sự mâu thuẫn giữa mục tiêu học tập của bản thân và thói quen sử dụng thiết bị số.',
];

export const CRISIS_KEYWORDS = [
  'tự tử',
  'tự hại',
  'muốn chết',
  'bế tắc',
  'tuyệt vọng',
  'không muốn sống',
  'trầm cảm nặng',
  'kết thúc tất cả',
];

export const TREE_NAME_SUGGESTIONS = [
  'Cổ Thụ Bạch Dương',
  'Tùng Bách Định Tâm',
  'Anh Đào Tỉnh Thức',
  'Mầm Xanh Tri Thức',
];

export function getMaxXpForLevel(level: number): number {
  const lvl = Math.max(1, Math.min(10, Math.round(level) || 1));
  return Math.round(150 * Math.pow(2, lvl - 1));
}

export function getTitleByLevel(level: number): string {
  return LEVEL_TITLES[level] || 'Hạt Mầm Khởi Nguyên';
}

export function getDragonUpgradeLevel(user?: Pick<UserProfile, 'dragonUpgradeLevel'> | null): number {
  return Math.max(0, Math.min(DRAGON_UPGRADES.length, Number(user?.dragonUpgradeLevel) || 0));
}

export function getDragonXpMultiplier(user?: Pick<UserProfile, 'dragonUpgradeLevel'> | null): number {
  const level = getDragonUpgradeLevel(user);
  const bonus = DRAGON_UPGRADES.slice(0, level).reduce((sum, item) => sum + item.bonus, 0);
  return 1.4 + bonus;
}

export function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDefaultPlantQuests(uid: string): Omit<PlantQuest, 'id'>[] {
  return [
    {
      uid,
      text: 'Tưới nước dưỡng chất cơ bản (Hoàn thành 1 phiên tập trung)',
      seedCost: 30,
      repeatable: true,
      completed: false,
      count: 0,
    },
    {
      uid,
      text: 'Bón phân hữu cơ Tri Thức (Tích lũy điểm mầm)',
      seedCost: 60,
      repeatable: true,
      completed: false,
      count: 0,
    },
    {
      uid,
      text: 'Khai mở Quang hợp Ánh sáng (Thúc đẩy cây thăng cấp)',
      seedCost: 120,
      repeatable: true,
      completed: false,
      count: 0,
    },
  ];
}

export function createJudgeAccount(): UserProfile {
  return {
    uid: JUDGE_UID,
    email: 'judge@mindful-ai.local',
    fullname: 'Tài khoản Ban giám khảo',
    className: 'Ban giám khảo',
    schoolName: 'THPT Hương Khê · KHKT 2026',
    treeName: 'Vườn Trải Nghiệm',
    hasNamedTree: true,
    role: 'judge',
    level: 10,
    xp: 0,
    maxXp: getMaxXpForLevel(10),
    seedPoints: 999999,
    streakDays: 7,
    lastActiveDate: getTodayDateStr(),
    todayFocusMins: 65,
    weeklyFocusMins: [35, 45, 50, 60, 55, 70, 65],
    socialInterruptionCount: 0,
    dragonUpgradeLevel: 5,
    lastCdsScore: 2.35,
    exploredStages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    hasBadgeKienTri: true,
  };
}

export function hasCrisisSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function getAiRecommendation(user: UserProfile): string {
  const cds = Number(user.lastCdsScore || 0);
  const mins = user.todayFocusMins || 0;
  const tName = user.treeName || 'Cây Tri Thức';
  if (cds > 3.4) {
    return `Chỉ số CDS-HS đang cao (${cds.toFixed(2)}/5.0): Hãy thử 1 vòng thở 4-7-8, bật tiếng Mưa Rừng để chăm sóc "${tName}".`;
  }
  if (mins === 0) {
    return `Gợi ý khởi động: Thử 1 phiên Deep Work 25 phút để "${tName}" hấp thụ ánh sáng tri thức nhé.`;
  }
  if (mins >= 45) {
    return `Trạng thái Tỉnh Thức xuất sắc (${mins} phút Deep Work · "${tName}" đang tỏa sáng). Hãy ghi lại Sổ tay 7 mục.`;
  }
  return `"${tName}" đang phát triển ổn định (${mins} phút tập trung). Giữ vững nguyên tắc "Điện thoại ngủ ngoài bàn học".`;
}
