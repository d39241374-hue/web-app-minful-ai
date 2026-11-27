import { useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Flame,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { getTitleByLevel, getTodayDateStr } from '../constants';
import { exportResearchDataCSV } from '../utils/csvExport';
import { FocusWaveChart } from './FocusWaveChart';
import type { FriendRequest, Friendship, KhktSurvey, PublicGarden, UserProfile } from '../types';

/* -------------------------------------------------------------------------- */
/* ResearchLabView                                                            */
/* -------------------------------------------------------------------------- */
interface ResearchLabViewProps {
  user: UserProfile;
  publicGardens: PublicGarden[];
  journalCount: number;
}

export function ResearchLabView({ user, publicGardens, journalCount }: ResearchLabViewProps) {
  const weekly = user.weeklyFocusMins?.length === 7 ? user.weeklyFocusMins : [0, 0, 0, 0, 0, 0, 0];
  const totalWeekMins = weekly.reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            Trung tâm Số liệu Thực nghiệm KHKT 2026
          </h1>
        </div>

        <button
          type="button"
          onClick={() => exportResearchDataCSV(user, publicGardens, journalCount)}
          className="aurora-accent-btn min-h-[42px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Xuất CSV SPSS (UTF-8)
        </button>
      </div>

      {/* KPI Strip — 2x2 on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="scroll-fade-item glass-panel rounded-2xl p-3.5 sm:p-4 space-y-0.5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Deep Work tuần</div>
          <div className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {totalWeekMins} phút
          </div>
        </div>
        <div className="scroll-fade-item glass-panel rounded-2xl p-3.5 sm:p-4 space-y-0.5">
          <div className="text-xs text-slate-600 dark:text-slate-300">CDS-HS gần nhất</div>
          <div className="font-mono-num text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400">
            {user.lastCdsScore ? user.lastCdsScore.toFixed(2) : 'N/A'}
          </div>
        </div>
        <div className="scroll-fade-item glass-panel rounded-2xl p-3.5 sm:p-4 space-y-0.5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Màng lọc Thức tỉnh</div>
          <div className="font-mono-num text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {user.socialInterruptionCount} lần
          </div>
        </div>
        <div className="scroll-fade-item glass-panel rounded-2xl p-3.5 sm:p-4 space-y-0.5">
          <div className="text-xs text-slate-600 dark:text-slate-300">Sổ tay 7 mục</div>
          <div className="font-mono-num text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {journalCount}
          </div>
        </div>
      </div>

      {/* 2-Column Bottom Analytics */}
      <div className="grid lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
        {/* Focus Wave ("Sóng Tập trung") Interactive Chart */}
        <section className="scroll-fade-item led-frame lg:col-span-6 glass-panel relative rounded-3xl p-4 sm:p-5 flex flex-col justify-between min-h-0 lg:overflow-y-auto">
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
          <FocusWaveChart
            weeklyFocusMins={user.weeklyFocusMins}
            todayFocusMins={user.todayFocusMins}
            showModeToggle
          />
        </section>

        {/* KHKT Experimental Reference Table */}
        <section className="scroll-fade-item lg:col-span-6 glass-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3 min-h-0 lg:overflow-y-auto">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Mô hình đối chứng thực nghiệm (N = 120 học sinh)
            </h2>
          </div>
          <div className="overflow-x-auto flex-1 flex items-center">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-300">
                  <th className="py-2.5 pr-3">Chỉ tiêu đánh giá</th>
                  <th className="py-2.5 px-3">Đối chứng</th>
                  <th className="py-2.5 px-3">Mindful AI</th>
                  <th className="py-2.5 pl-3">Cải thiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 font-mono-num">
                <tr>
                  <td className="py-3 pr-3 font-sans font-semibold">Chỉ số CDS-HS TB</td>
                  <td className="py-3 px-3">3.48</td>
                  <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">2.34</td>
                  <td className="py-3 pl-3 font-semibold">-32.8%</td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-sans font-semibold">Deep Work / ngày</td>
                  <td className="py-3 px-3">28 phút</td>
                  <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">56 phút</td>
                  <td className="py-3 pl-3 font-semibold">+100%</td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-sans font-semibold">Gián đoạn MXH</td>
                  <td className="py-3 px-3">4.7 lần/h</td>
                  <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">1.2 lần/h</td>
                  <td className="py-3 pl-3 font-semibold">-74.5%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LeaderboardView                                                            */
/* -------------------------------------------------------------------------- */
interface LeaderboardViewProps {
  user: UserProfile;
  publicGardens: PublicGarden[];
  friendships?: Friendship[];
  incomingRequests?: FriendRequest[];
  outgoingRequests?: FriendRequest[];
  onVisitGarden: (garden: PublicGarden) => void;
  onSendFriendInvite?: (targetUid: string) => Promise<void>;
}

export function LeaderboardView({
  user,
  publicGardens,
  friendships = [],
  incomingRequests = [],
  outgoingRequests = [],
  onVisitGarden,
  onSendFriendInvite,
}: LeaderboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingUid, setSendingUid] = useState('');

  const sorted = [...publicGardens].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.xp - a.xp;
  });

  const myRankIdx = sorted.findIndex((g) => g.uid === user.uid);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? sorted.filter(
        (g) =>
          g.fullname.toLowerCase().includes(q) ||
          g.className.toLowerCase().includes(q) ||
          g.treeName.toLowerCase().includes(q),
      )
    : sorted;

  const friendUids = new Set(
    friendships.map((f) => (f.uidA === user.uid ? f.uidB : f.uidA)),
  );
  const outgoingUids = new Set(
    outgoingRequests.filter((r) => r.status === 'pending').map((r) => r.toUid),
  );
  const incomingUids = new Set(
    incomingRequests.filter((r) => r.status === 'pending').map((r) => r.fromUid),
  );

  const handleInvite = async (targetUid: string) => {
    if (!onSendFriendInvite || sendingUid) return;
    setSendingUid(targetUid);
    try {
      await onSendFriendInvite(targetUid);
    } finally {
      setSendingUid('');
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto h-full flex-1 min-h-0 flex flex-col gap-3">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white leading-tight">
            Bảng Xếp Hạng Vườn Tâm Trí 3D
          </h1>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-mono-num mt-0.5">
            {myRank ? (
              <span>
                Hạng của bạn:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  #{myRank} / {sorted.length}
                </strong>{' '}
                · Cấp {user.level} · {user.xp.toLocaleString('vi-VN')} XP
              </span>
            ) : (
              <span>Tổng cộng {sorted.length} khu vườn công khai</span>
            )}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm bạn học, lớp, tên cây..."
            aria-label="Tìm kiếm trên bảng xếp hạng"
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
      </div>

      <section className="led-frame glass-panel relative rounded-3xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="led-strip absolute top-0 inset-x-6 h-[3px] z-10" />
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-[15px] text-slate-500 dark:text-slate-400 m-auto">
            {sorted.length === 0
              ? 'Chưa có khu vườn công khai nào trên bảng xếp hạng.'
              : 'Không tìm thấy khu vườn phù hợp với từ khóa.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 smooth-scroll overflow-y-auto flex-1 min-h-0">
            {filtered.map((g) => {
              const actualIdx = sorted.findIndex((s) => s.uid === g.uid);
              const isMe = g.uid === user.uid;
              const isFriend = friendUids.has(g.uid);
              const hasOutgoing = outgoingUids.has(g.uid);
              const hasIncoming = incomingUids.has(g.uid);

              const rankBoxClass =
                actualIdx === 0
                  ? 'bg-amber-500/18 text-amber-600 dark:text-amber-300 border border-amber-500/35'
                  : actualIdx === 1
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                    : actualIdx === 2
                      ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';

              return (
                <div
                  key={g.uid}
                  className={`scroll-fade-item px-4 sm:px-6 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 ${
                    isMe ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono-num text-sm font-bold shrink-0 ${rankBoxClass}`}
                    >
                      {actualIdx === 0 ? <Award className="w-5 h-5" /> : `#${actualIdx + 1}`}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
                        {g.fullname} {isMe ? '(Bạn)' : ''}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 truncate">
                        {g.className} · {g.treeName} · {getTitleByLevel(g.level)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <div className="sm:text-right font-mono-num mr-1">
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Cấp {g.level}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-300">
                        {g.xp.toLocaleString('vi-VN')} XP · {g.streakDays} ngày
                      </div>
                    </div>

                    {!isMe && onSendFriendInvite && user.role !== 'judge' && (
                      <>
                        {isFriend ? (
                          <span className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            <Users className="w-3.5 h-3.5" />
                            Bạn bè
                          </span>
                        ) : hasOutgoing ? (
                          <span className="min-h-[40px] inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Đã mời
                          </span>
                        ) : hasIncoming ? (
                          <span className="min-h-[40px] inline-flex items-center px-3 py-2 rounded-xl bg-sky-500/12 border border-sky-500/30 text-xs font-semibold text-sky-700 dark:text-sky-300 whitespace-nowrap">
                            Chờ duyệt
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={sendingUid === g.uid}
                            onClick={() => void handleInvite(g.uid)}
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sky-500/40 bg-sky-500/10 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 whitespace-nowrap transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            {sendingUid === g.uid ? 'Đang gửi...' : 'Kết bạn'}
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onVisitGarden(g)}
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      Thăm vườn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SurveyView                                                                 */
/* -------------------------------------------------------------------------- */
interface SurveyViewProps {
  user: UserProfile;
  onSubmitSurvey: (survey: KhktSurvey) => Promise<void>;
}

export function SurveyView({ user, onSubmitSurvey }: SurveyViewProps) {
  const [s1, setS1] = useState(user.khktSurvey?.s1 || 5);
  const [s2, setS2] = useState(user.khktSurvey?.s2 || 5);
  const [s3, setS3] = useState(user.khktSurvey?.s3 || 5);
  const [saving, setSaving] = useState(false);

  const questions = [
    {
      key: 's1',
      label: '1. Vườn 3D & Rồng đồng hành có tạo động lực giúp bạn tập trung học lâu hơn không?',
      val: s1,
      set: setS1,
    },
    {
      key: 's2',
      label: '2. Cố vấn Gemini AI & Sổ tay 7 mục có giúp bạn nhận diện thói quen lướt mạng vô thức?',
      val: s2,
      set: setS2,
    },
    {
      key: 's3',
      label: '3. Mức độ sẵn sàng tiếp tục sử dụng Mindful AI trong kỳ ôn thi sắp tới?',
      val: s3,
      set: setS3,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmitSurvey({ s1, s2, s3, date: getTodayDateStr() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col justify-center gap-4">
      <div className="shrink-0">
        <h1 className="font-display text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white leading-tight">
          Khảo sát trải nghiệm KHKT 2026
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="scroll-fade-item led-frame glass-panel relative rounded-3xl p-5 sm:p-6 space-y-4 overflow-y-auto min-h-0">
        <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
        {questions.map((q) => (
          <div key={q.key} className="space-y-2.5">
            <div className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{q.label}</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => q.set(score)}
                  className={`min-h-[44px] py-2.5 rounded-xl text-sm font-bold tabular-nums whitespace-nowrap transition-colors ${
                    q.val === score
                      ? 'aurora-accent-btn shadow-sm'
                      : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
                  }`}
                >
                  {score}
                  <span className="hidden sm:inline"> điểm</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
          {user.khktSurvey ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Đã khảo sát ngày {user.khktSurvey.date}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-300">Thang điểm 1–5</span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="aurora-accent-btn min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60 whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            {saving ? 'Đang gửi...' : user.khktSurvey ? 'Cập nhật khảo sát' : 'Gửi khảo sát (+30 XP)'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ProfileView                                                                */
/* -------------------------------------------------------------------------- */
interface ProfileViewProps {
  user: UserProfile;
  journalCount?: number;
  onSaveProfile: (
    updates: Pick<UserProfile, 'fullname' | 'className' | 'schoolName' | 'treeName' | 'hasNamedTree'>,
  ) => Promise<void>;
}

export function ProfileView({ user, journalCount = 0, onSaveProfile }: ProfileViewProps) {
  const [fullname, setFullname] = useState(user.fullname);
  const [className, setClassName] = useState(user.className);
  const [schoolName, setSchoolName] = useState(user.schoolName);
  const [treeName, setTreeName] = useState(user.treeName);
  const [saving, setSaving] = useState(false);

  const milestones = [
    {
      id: 'first-focus',
      title: 'Khởi hành Deep Work',
      progress: user.todayFocusMins > 0 ? `${user.todayFocusMins}p hôm nay` : 'Chờ phiên đầu',
      unlocked: (user.todayFocusMins || 0) > 0 || (user.xp || 0) > 0 || user.level > 1,
      icon: Sparkles,
    },
    {
      id: 'streak-7',
      title: 'Chuỗi Kiên trì 7 ngày',
      progress: `${Math.min(user.streakDays || 0, 7)}/7 ngày`,
      unlocked: user.hasBadgeKienTri || (user.streakDays || 0) >= 7,
      icon: Flame,
    },
    {
      id: 'dragon-awaken',
      title: 'Thiên Long Thức Tỉnh',
      progress: `Bậc ${user.dragonUpgradeLevel || 0}/3`,
      unlocked: (user.dragonUpgradeLevel || 0) >= 1,
      icon: Award,
    },
    {
      id: 'tree-growth',
      title: 'Linh Mộc Trưởng Thành',
      progress: `Cấp ${Math.min(user.level || 1, 5)}/5`,
      unlocked: (user.level || 1) >= 5,
      icon: Sprout,
    },
    {
      id: 'cds-proactive',
      title: 'Chủ Động Số (< 2.6)',
      progress: user.lastCdsScore != null ? `${user.lastCdsScore.toFixed(2)} điểm` : 'Chưa đo',
      unlocked: user.lastCdsScore != null && user.lastCdsScore < 2.6,
      icon: ShieldCheck,
    },
    {
      id: 'journal-reflect',
      title: 'Nhà Phản Chiếu 7 mục',
      progress: `${journalCount} bài`,
      unlocked: journalCount >= 1,
      icon: BookOpen,
    },
  ];
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim() || !treeName.trim()) return;
    setSaving(true);
    try {
      await onSaveProfile({
        fullname: fullname.trim().slice(0, 80),
        className: className.trim().slice(0, 40) || '11A1',
        schoolName: schoolName.trim().slice(0, 100) || 'THPT Hương Khê',
        treeName: treeName.trim().slice(0, 32),
        hasNamedTree: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col justify-center gap-3">
      <div className="shrink-0 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white leading-tight">
          Hồ sơ học sinh &amp; Thành tựu
        </h1>
        <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
          {user.email} · {getTitleByLevel(user.level)}
        </span>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 min-h-0 items-stretch">
        <form
          onSubmit={handleSubmit}
          className="scroll-fade-item led-frame glass-panel lg:col-span-7 relative rounded-3xl p-5 sm:p-6 space-y-4 overflow-y-auto min-h-0 flex flex-col justify-between"
        >
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">Họ và tên</label>
                <input
                  type="text"
                  maxLength={80}
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-[15px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">Lớp</label>
                <input
                  type="text"
                  maxLength={40}
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-[15px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">Trường</label>
                <input
                  type="text"
                  maxLength={100}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-[15px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                  Tên Cây Linh Mộc 3D
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={treeName}
                  onChange={(e) => setTreeName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-[15px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 font-mono-num">
              <div className="rounded-xl bg-slate-100/75 dark:bg-slate-900/60 px-3 py-2">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Cấp độ cây</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">Cấp {user.level}</div>
              </div>
              <div className="rounded-xl bg-slate-100/75 dark:bg-slate-900/60 px-3 py-2">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Điểm mầm xanh</div>
                <div className="text-base font-bold text-sky-600 dark:text-sky-400">
                  {user.seedPoints.toLocaleString('vi-VN')}
                </div>
              </div>
              <div className="rounded-xl bg-slate-100/75 dark:bg-slate-900/60 px-3 py-2">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Chuỗi tập trung</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">{user.streakDays} ngày</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="aurora-accent-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>

        <section className="scroll-fade-item glass-panel lg:col-span-5 rounded-3xl p-5 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Huy hiệu &amp; Cột mốc
            </h2>
            <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {unlockedCount}/6 mở khóa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 flex-1 content-start">
            {milestones.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-3 flex items-start gap-2.5 transition-colors ${
                    m.unlocked
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 opacity-75'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      m.unlocked
                        ? 'aurora-accent-btn text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                      {m.title}
                    </div>
                    <div
                      className={`text-[11px] font-mono-num mt-0.5 ${
                        m.unlocked
                          ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {m.unlocked ? `Đạt · ${m.progress}` : m.progress}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
