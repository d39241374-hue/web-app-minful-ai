import { useState } from 'react';
import { Check, Compass, Gift, Play, Search, Sparkles, UserPlus, X } from 'lucide-react';
import { DRAGON_UPGRADES, STAGE_INFO, getDragonUpgradeLevel, getDragonXpMultiplier } from '../constants';
import type { FriendRequest, Friendship, GardenGift, PublicGarden, UserProfile } from '../types';

interface FriendsAndDragonViewProps {
  user: UserProfile;
  publicGardens: PublicGarden[];
  friendships: Friendship[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  incomingGifts: GardenGift[];
  onUpgradeDragon: (level: number, cost: number, title: string) => Promise<void>;
  onSendFriendInvite: (targetUid: string) => Promise<void>;
  onRespondRequest: (req: FriendRequest, accept: boolean) => Promise<void>;
  onSendGift: (toUid: string, toName: string) => Promise<void>;
  onClaimGift: (gift: GardenGift) => Promise<void>;
  onVisitGarden: (garden: PublicGarden) => void;
  onStartCoStudy: (pairId: string) => void;
}

export function FriendsAndDragonView({
  user,
  publicGardens,
  friendships,
  incomingRequests,
  outgoingRequests,
  incomingGifts,
  onUpgradeDragon,
  onSendFriendInvite,
  onRespondRequest,
  onSendGift,
  onClaimGift,
  onVisitGarden,
  onStartCoStudy,
}: FriendsAndDragonViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [socialTab, setSocialTab] = useState<'friends' | 'discover'>('friends');
  const dragonLevel = getDragonUpgradeLevel(user);
  const mult = getDragonXpMultiplier(user);
  const stageMeta = STAGE_INFO[user.level - 1] || STAGE_INFO[0];

  const friendUidMap = new Map<string, Friendship>();
  friendships.forEach((f) => {
    const peerUid = f.uidA === user.uid ? f.uidB : f.uidA;
    friendUidMap.set(peerUid, f);
  });

  const pendingOutSet = new Set(outgoingRequests.filter((r) => r.status === 'pending').map((r) => r.toUid));
  const pendingInSet = new Set(incomingRequests.filter((r) => r.status === 'pending').map((r) => r.fromUid));
  const pendingIncomingReqs = incomingRequests.filter((r) => r.status === 'pending');

  const friendsList = friendships.map((f) => {
    const peerUid = f.uidA === user.uid ? f.uidB : f.uidA;
    const garden = publicGardens.find((g) => g.uid === peerUid);
    return { friendship: f, peerUid, garden };
  });

  const discoverList = publicGardens
    .filter((g) => g.uid !== user.uid && !friendUidMap.has(g.uid))
    .filter((g) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.fullname.toLowerCase().includes(q) ||
        g.className.toLowerCase().includes(q) ||
        g.treeName.toLowerCase().includes(q)
      );
    });

  return (
    <div className="max-w-6xl w-full mx-auto lg:h-full lg:flex-1 min-h-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white leading-tight">
            Bạn bè Đồng hành &amp; Thiên Long Ngân Hà
          </h1>
        </div>
        <div className="text-sm font-mono-num font-bold text-emerald-700 dark:text-emerald-400">
          {user.seedPoints.toLocaleString('vi-VN')} mầm · Hệ số {mult.toFixed(2)}x XP
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
        {/* Left: Dragon Upgrade Sanctuary + Incoming Alerts */}
        <section className="scroll-fade-item led-frame lg:col-span-5 glass-panel relative rounded-3xl p-4 sm:p-5 flex flex-col gap-3.5 min-h-0 lg:overflow-y-auto">
          <div className="led-strip absolute top-0 inset-x-6 h-[3px]" />
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
                {stageMeta.dragon}
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Thiên Long · Bậc {dragonLevel}/5
              </h2>
            </div>
            <div className="text-right font-mono-num">
              <div className="text-xs text-slate-500 dark:text-slate-400">Cộng hưởng</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{mult.toFixed(2)}x XP</div>
            </div>
          </div>

          <div className="space-y-2.5 smooth-scroll overflow-y-auto flex-1 pr-1 min-h-0">
            {DRAGON_UPGRADES.map((up) => {
              const unlocked = dragonLevel >= up.level;
              const isNext = dragonLevel + 1 === up.level;
              const canBuy = isNext && user.seedPoints >= up.cost;
              return (
                <div
                  key={up.level}
                  className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 ${
                    unlocked
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : isNext
                        ? 'border-indigo-500/45 bg-white/75 dark:bg-slate-900/75'
                        : 'border-slate-200/80 dark:border-slate-800/80 opacity-65'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      Bậc {up.level} · {up.title}
                    </div>
                    <div className="text-xs font-mono-num text-emerald-700 dark:text-emerald-400 mt-0.5">
                      +{Math.round(up.bonus * 100)}% XP mỗi phiên Deep Work
                    </div>
                  </div>

                  {unlocked ? (
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                      Đã thức tỉnh
                    </span>
                  ) : isNext ? (
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() => void onUpgradeDragon(up.level, up.cost, up.title)}
                      className="aurora-accent-btn py-2 px-3.5 rounded-xl text-sm font-bold disabled:opacity-45 whitespace-nowrap shrink-0 font-mono-num"
                    >
                      Nâng ({up.cost} mầm)
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num whitespace-nowrap shrink-0">
                      Cần {up.cost} mầm
                    </span>
                  )}
                </div>
              );
            })}

            {/* Incoming Gifts & Friend Requests inside left pane if any */}
            {(incomingGifts.length > 0 || pendingIncomingReqs.length > 0) && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2">
                {incomingGifts.map((gift) => (
                  <div
                    key={gift.id}
                    className="rounded-2xl p-3.5 border border-emerald-500/35 bg-emerald-500/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Quà tưới cây
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {gift.fromName} tặng +{gift.xpAmount} XP
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onClaimGift(gift)}
                      className="aurora-accent-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      <Gift className="w-4 h-4" />
                      Nhận
                    </button>
                  </div>
                ))}

                {pendingIncomingReqs.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-2xl p-3.5 border border-sky-500/35 bg-sky-500/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-sky-700 dark:text-sky-400">Lời mời kết bạn</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {req.fromName} ({req.fromClass}) · Lv.{req.fromLevel}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onRespondRequest(req, true)}
                        className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        aria-label="Chấp nhận lời mời"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRespondRequest(req, false)}
                        className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-500 transition-colors"
                        aria-label="Từ chối lời mời"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Tabbed Friends / Discover with Internal Scroll */}
        <section className="scroll-fade-item lg:col-span-7 glass-panel rounded-3xl p-5 sm:p-6 flex flex-col gap-4 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSocialTab('friends')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                  socialTab === 'friends'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Bạn đồng hành ({friendsList.length})
              </button>
              <button
                type="button"
                onClick={() => setSocialTab('discover')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                  socialTab === 'discover'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Khám phá ({discoverList.length})
              </button>
            </div>

            {socialTab === 'discover' ? (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên bạn, lớp, tên cây..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm outline-none"
                />
              </div>
            ) : (
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-mono-num">
                Tặng +30 XP tốn 10 mầm (bạn +15 XP)
              </span>
            )}
          </div>

          <div className="smooth-scroll overflow-y-auto flex-1 pr-1 min-h-0">
            {socialTab === 'friends' ? (
              friendsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-10">
                  <p className="text-[15px] text-slate-500 dark:text-slate-400 max-w-md">
                    Bạn chưa kết nối bạn học nào. Hãy chuyển sang tab “Khám phá trường” để gửi lời mời và học cùng Co-Study!
                  </p>
                  <button
                    type="button"
                    onClick={() => setSocialTab('discover')}
                    className="aurora-accent-btn px-4 py-2 rounded-xl text-sm font-semibold"
                  >
                    Tìm bạn cùng lớp ngay
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {friendsList.map(({ friendship, peerUid, garden }) => (
                    <div
                      key={friendship.id}
                      className="scroll-fade-item p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
                            {garden?.fullname || `Học sinh ${peerUid.slice(0, 6)}`}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-300 truncate">
                            {garden?.className || 'THPT Hương Khê'} · {garden?.treeName || 'Cây Tri Thức'} · Lv.
                            {garden?.level || 1}
                          </div>
                        </div>
                        <div className="text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {friendship.days} ngày
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {garden && (
                          <button
                            type="button"
                            onClick={() => onVisitGarden(garden)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            Ghé vườn
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={user.seedPoints < 10}
                          onClick={() => void onSendGift(peerUid, garden?.fullname || 'bạn học')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:border-emerald-500 disabled:opacity-45 whitespace-nowrap"
                        >
                          <Gift className="w-3.5 h-3.5 text-emerald-500" />
                          Tặng 30 XP
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartCoStudy(friendship.id)}
                          className="aurora-accent-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ml-auto"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Học cùng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : discoverList.length === 0 ? (
              <div className="h-full flex items-center justify-center py-10 text-[15px] text-slate-500 dark:text-slate-400">
                Chưa tìm thấy khu vườn công khai phù hợp.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {discoverList.slice(0, 18).map((g) => {
                  const invited = pendingOutSet.has(g.uid);
                  const received = pendingInSet.has(g.uid);
                  return (
                    <div
                      key={g.uid}
                      className="scroll-fade-item p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 space-y-3"
                    >
                      <div>
                        <div className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
                          {g.fullname}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-300 truncate">
                          {g.className} · {g.treeName} · Cấp {g.level}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onVisitGarden(g)}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Xem vườn 3D
                        </button>
                        <button
                          type="button"
                          disabled={invited || received || user.role === 'judge'}
                          onClick={() => void onSendFriendInvite(g.uid)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-45 whitespace-nowrap ml-auto"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {invited ? 'Đã mời' : received ? 'Chờ duyệt' : 'Kết bạn'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
