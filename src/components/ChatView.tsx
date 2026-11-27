import { useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Calculator,
  Clock,
  Globe2,
  GraduationCap,
  Heart,
  Layers,
  Megaphone,
  MessageSquare,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { hasCrisisSignal } from '../constants';
import { askGeminiCounselor } from '../services/aiService';
import { subscribePrivateMessages } from '../services/firestoreService';
import type {
  AiChatMessage,
  ChatMode,
  ForumMessage,
  Friendship,
  PrivateMessage,
  PublicGarden,
  UserProfile,
} from '../types';

interface ChatViewProps {
  user: UserProfile;
  aiMessages: AiChatMessage[];
  forumMessages: ForumMessage[];
  friendships: Friendship[];
  publicGardens: PublicGarden[];
  onSaveAiMessage: (role: 'user' | 'assistant', mode: ChatMode, text: string) => Promise<void>;
  onPostForum: (text: string) => Promise<void>;
  onSendPrivateMessage: (peerUid: string, text: string) => Promise<void>;
  onTriggerCrisis: () => void;
}

const AI_MODES: Array<{ id: ChatMode; label: string; desc: string; icon: typeof Heart }> = [
  { id: 'counselor', label: 'Cố vấn Tâm lý', desc: 'Lắng nghe & vượt bẫy CDS-HS', icon: Heart },
  { id: 'math', label: 'Gia sư Toán', desc: 'Gợi mở Socratic Toán THPT', icon: Calculator },
  { id: 'literature', label: 'Gia sư Ngữ văn', desc: 'Dàn ý & phân tích tác phẩm', icon: BookOpenCheck },
  { id: 'english', label: 'Gia sư Tiếng Anh', desc: 'Ngữ pháp & viết lại câu', icon: Globe2 },
];

type ForumStreamFilter = 'all' | 'study_group' | 'teachers' | 'announcements';

const FORUM_STREAM_FILTERS: Array<{
  id: ForumStreamFilter;
  label: string;
  prefix: string;
  icon: typeof Layers;
}> = [
  { id: 'all', label: 'Tất cả', prefix: '', icon: Layers },
  { id: 'study_group', label: 'Nhóm học tập', prefix: '[Nhóm học tập]', icon: Users },
  { id: 'teachers', label: 'Thầy cô', prefix: '[Thầy cô]', icon: GraduationCap },
  { id: 'announcements', label: 'Thông báo chung', prefix: '[Thông báo chung]', icon: Megaphone },
];

function parseForumTopic(rawText: string): {
  stream: Exclude<ForumStreamFilter, 'all'>;
  topicLabel: string;
  cleanText: string;
} {
  if (rawText.startsWith('[Nhóm học tập]')) {
    return {
      stream: 'study_group',
      topicLabel: 'Nhóm học tập',
      cleanText: rawText.slice('[Nhóm học tập]'.length).trimStart(),
    };
  }
  if (rawText.startsWith('[Thầy cô]')) {
    return {
      stream: 'teachers',
      topicLabel: 'Thầy cô',
      cleanText: rawText.slice('[Thầy cô]'.length).trimStart(),
    };
  }
  if (rawText.startsWith('[Thông báo chung]')) {
    return {
      stream: 'announcements',
      topicLabel: 'Thông báo chung',
      cleanText: rawText.slice('[Thông báo chung]'.length).trimStart(),
    };
  }
  return {
    stream: 'announcements',
    topicLabel: 'Thông báo chung',
    cleanText: rawText,
  };
}

export function ChatView({
  user,
  aiMessages,
  forumMessages,
  friendships,
  publicGardens,
  onSaveAiMessage,
  onPostForum,
  onSendPrivateMessage,
  onTriggerCrisis,
}: ChatViewProps) {
  const [channelTab, setChannelTab] = useState<'ai' | 'forum' | 'peer'>('ai');
  const [aiMode, setAiMode] = useState<ChatMode>('counselor');
  const [forumStreamFilter, setForumStreamFilter] = useState<ForumStreamFilter>('all');
  const [forumDirectoryTab, setForumDirectoryTab] = useState<'all' | 'friends' | 'teachers'>('all');
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [selectedPeerUid, setSelectedPeerUid] = useState<string>('');
  const [peerMessages, setPeerMessages] = useState<PrivateMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const forumWaitingFriends: Array<{ id: string; name: string }> = [];
  const forumWaitingTeachers: Array<{ id: string; name: string }> = [];

  const friendPeers = friendships.map((f) => {
    const peerUid = f.uidA === user.uid ? f.uidB : f.uidA;
    const garden = publicGardens.find((g) => g.uid === peerUid);
    return {
      uid: peerUid,
      name: garden ? `${garden.fullname} (${garden.className})` : `Bạn học ${peerUid.slice(0, 6)}`,
    };
  });

  useEffect(() => {
    if (!selectedPeerUid && friendPeers.length > 0) {
      setSelectedPeerUid(friendPeers[0].uid);
    }
  }, [friendPeers, selectedPeerUid]);

  useEffect(() => {
    if (channelTab !== 'peer' || !selectedPeerUid || user.role === 'judge') {
      setPeerMessages([]);
      return;
    }
    const unsub = subscribePrivateMessages(user.uid, selectedPeerUid, setPeerMessages);
    return () => unsub();
  }, [channelTab, selectedPeerUid, user.uid, user.role]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiMessages, forumMessages, peerMessages, channelTab, aiMode]);

  const filteredAiMsgs = aiMessages.filter((m) => m.mode === aiMode);

  const parsedForumMsgs = forumMessages.map((msg) => ({
    ...msg,
    ...parseForumTopic(msg.text),
  }));

  const forumStreamCounts: Record<ForumStreamFilter, number> = {
    all: parsedForumMsgs.length,
    study_group: parsedForumMsgs.filter((m) => m.stream === 'study_group').length,
    teachers: parsedForumMsgs.filter((m) => m.stream === 'teachers').length,
    announcements: parsedForumMsgs.filter((m) => m.stream === 'announcements').length,
  };

  const filteredForumMsgs =
    forumStreamFilter === 'all'
      ? parsedForumMsgs
      : parsedForumMsgs.filter((m) => m.stream === forumStreamFilter);

  const handleSelectForumFilter = (filterId: ForumStreamFilter) => {
    setForumStreamFilter(filterId);
    if (filterId === 'teachers') {
      setForumDirectoryTab('teachers');
    } else if (filterId === 'study_group') {
      setForumDirectoryTab('friends');
    } else {
      setForumDirectoryTab('all');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = input.trim();
    if (!cleaned) return;

    if (hasCrisisSignal(cleaned)) {
      onTriggerCrisis();
    }

    setInput('');
    setAiError('');

    if (channelTab === 'ai') {
      await onSaveAiMessage('user', aiMode, cleaned);
      setAiLoading(true);
      try {
        const reply = await askGeminiCounselor({
          mode: aiMode,
          message: cleaned,
          history: filteredAiMsgs.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          context: {
            treeName: user.treeName,
            level: user.level,
            lastCdsScore: user.lastCdsScore ?? null,
            todayFocusMins: user.todayFocusMins,
            streakDays: user.streakDays,
          },
        });
        await onSaveAiMessage('assistant', aiMode, reply);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Không thể kết nối Gemini AI.');
      } finally {
        setAiLoading(false);
      }
    } else if (channelTab === 'forum') {
      const activeMeta = FORUM_STREAM_FILTERS.find((f) => f.id === forumStreamFilter);
      const alreadyTagged =
        cleaned.startsWith('[Nhóm học tập]') ||
        cleaned.startsWith('[Thầy cô]') ||
        cleaned.startsWith('[Thông báo chung]');
      const payload =
        activeMeta && activeMeta.prefix && !alreadyTagged
          ? `${activeMeta.prefix} ${cleaned}`.slice(0, 1000)
          : cleaned.slice(0, 1000);
      await onPostForum(payload);
    } else if (channelTab === 'peer' && selectedPeerUid) {
      await onSendPrivateMessage(selectedPeerUid, cleaned);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto h-full flex-1 min-h-0 flex flex-col gap-3 sm:gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white leading-tight">
            Cố vấn Gemini AI &amp; Cộng đồng
          </h1>
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setChannelTab('ai')}
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              channelTab === 'ai'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            Trợ lý AI
          </button>
          <button
            type="button"
            onClick={() => setChannelTab('forum')}
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              channelTab === 'forum'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            Diễn đàn
          </button>
          <button
            type="button"
            onClick={() => setChannelTab('peer')}
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
              channelTab === 'peer'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            Bạn bè
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      {channelTab === 'ai' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
          {AI_MODES.map((m) => {
            const Icon = m.icon;
            const active = aiMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setAiMode(m.id)}
                className={`min-h-[42px] p-2.5 sm:px-3.5 rounded-2xl border text-left transition-colors ${
                  active ? 'aurora-accent-btn border-transparent shadow-sm' : 'glass-panel hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Forum Quick Stream Filter Bar */}
      {channelTab === 'forum' && (
        <nav
          aria-label="Bộ lọc luồng thảo luận diễn đàn"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0"
        >
          {FORUM_STREAM_FILTERS.map((item) => {
            const Icon = item.icon;
            const active = forumStreamFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectForumFilter(item.id)}
                aria-pressed={active}
                className={`min-h-[40px] px-3 py-2 rounded-2xl border text-left transition-colors flex items-center justify-between gap-2 ${
                  active
                    ? 'aurora-accent-btn border-transparent shadow-sm'
                    : 'glass-panel hover:border-emerald-400 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  className={`font-mono-num text-xs font-bold shrink-0 ${
                    active ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {forumStreamCounts[item.id]}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {channelTab === 'peer' && (
        <div className="glass-panel rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Chọn bạn học để trò chuyện riêng 1-1:
          </span>
          {friendPeers.length === 0 ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Hãy kết bạn trong mục “Bạn bè &amp; Rồng” để mở phòng chat riêng.
            </span>
          ) : (
            <select
              value={selectedPeerUid}
              onChange={(e) => setSelectedPeerUid(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/85 text-sm font-medium outline-none"
            >
              {friendPeers.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Main Content Area: Split Roster + Forum when on Diễn đàn, full-width for AI / Peer */}
      <div
        className={
          channelTab === 'forum'
            ? 'grid lg:grid-cols-12 gap-3 flex-1 min-h-0 items-stretch'
            : 'flex flex-col flex-1 min-h-0'
        }
      >
        {channelTab === 'forum' && (
          <aside className="lg:col-span-4 glass-panel rounded-3xl p-3.5 sm:p-4 flex flex-col gap-3 min-h-0 max-h-[210px] lg:max-h-none">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Đang chờ tham gia
                </h2>
              </div>
              <span className="font-mono-num text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                0 thành viên
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 shrink-0">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'friends', label: 'Bạn bè (0)' },
                  { id: 'teachers', label: 'Thầy cô (0)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setForumDirectoryTab(tab.id)}
                  className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    forumDirectoryTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="smooth-scroll overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-0.5">
              {(forumDirectoryTab === 'all' || forumDirectoryTab === 'friends') && (
                <div className="rounded-2xl border border-dashed border-slate-300/90 dark:border-slate-700/80 bg-white/55 dark:bg-slate-900/45 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Bạn bè
                    </span>
                    <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                      {forumWaitingFriends.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Danh sách trống — Đang chờ bạn bè tham gia diễn đàn.
                  </p>
                </div>
              )}

              {(forumDirectoryTab === 'all' || forumDirectoryTab === 'teachers') && (
                <div className="rounded-2xl border border-dashed border-slate-300/90 dark:border-slate-700/80 bg-white/55 dark:bg-slate-900/45 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      Thầy cô
                    </span>
                    <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                      {forumWaitingTeachers.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Danh sách trống — Đang chờ thầy cô tham gia diễn đàn.
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Messages Box — Fills remaining viewport height and scrolls internally */}
        <section
          className={`led-frame glass-panel relative rounded-3xl flex flex-col flex-1 min-h-0 overflow-hidden ${
            channelTab === 'forum' ? 'lg:col-span-8' : ''
          }`}
        >
          <div className="led-strip absolute top-0 inset-x-6 h-[3px] z-10" />
          <div ref={scrollRef} className="smooth-scroll overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 min-h-0">
          {channelTab === 'ai' && (
            <>
              {filteredAiMsgs.length === 0 && (
                <div className="py-12 text-center space-y-2 text-[15px] text-slate-500 dark:text-slate-400">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Xin chào {user.fullname}, tôi sẵn sàng hỗ trợ ở chế độ{' '}
                    {AI_MODES.find((m) => m.id === aiMode)?.label}.
                  </p>
                  <p className="text-sm">
                    Hãy chia sẻ câu hỏi hoặc bài tập bạn đang gặp khó khăn để chúng ta cùng giải quyết từng bước.
                  </p>
                </div>
              )}
              {filteredAiMsgs.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'aurora-accent-btn text-white'
                          : 'bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <div>{msg.text}</div>
                      {msg.timeLabel && (
                        <div
                          className={`text-xs mt-1.5 font-mono-num ${
                            isUser ? 'text-white/80' : 'text-slate-400'
                          }`}
                        >
                          {msg.timeLabel}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 text-sm text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                    Gemini AI đang suy nghĩ và soạn hướng dẫn...
                  </div>
                </div>
              )}
            </>
          )}

          {channelTab === 'forum' && (
            <>
              {filteredForumMsgs.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-[15px] text-slate-500 dark:text-slate-400">
                  <p>
                    {forumStreamFilter === 'all'
                      ? 'Diễn đàn trường chưa có tin nhắn nào. Hãy gửi lời chúc tập trung đầu tiên!'
                      : `Chưa có thảo luận nào trong luồng “${
                          FORUM_STREAM_FILTERS.find((f) => f.id === forumStreamFilter)?.label
                        }”. Hãy gửi tin nhắn đầu tiên!`}
                  </p>
                  {forumStreamFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleSelectForumFilter('all')}
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      Xem tất cả luồng thảo luận
                    </button>
                  )}
                </div>
              ) : (
                filteredForumMsgs.map((msg) => {
                  const mine = msg.authorUid === user.uid;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] space-y-1 ${
                          mine
                            ? 'aurora-accent-btn text-white'
                            : 'bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div
                          className={`text-xs font-semibold ${
                            mine ? 'text-white/90' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {msg.senderLabel} · {msg.treeBadge} · {msg.topicLabel}
                        </div>
                        <div className="leading-relaxed whitespace-pre-wrap">{msg.cleanText}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {channelTab === 'peer' && (
            <>
              {user.role === 'judge' ? (
                <div className="py-12 text-center text-[15px] text-slate-500 dark:text-slate-400">
                  Nhắn tin 1-1 hoạt động khi đăng nhập bằng tài khoản học sinh Google.
                </div>
              ) : peerMessages.length === 0 ? (
                <div className="py-12 text-center text-[15px] text-slate-500 dark:text-slate-400">
                  Chưa có tin nhắn nào với người bạn này.
                </div>
              ) : (
                peerMessages.map((msg) => {
                  const mine = msg.senderUid === user.uid;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] ${
                          mine
                            ? 'aurora-accent-btn text-white'
                            : 'bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                        {msg.timeLabel && (
                          <div className={`text-xs mt-1 font-mono-num ${mine ? 'text-white/80' : 'text-slate-400'}`}>
                            {msg.timeLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {aiError && (
          <div className="px-5 py-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm shrink-0">
            {aiError}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="p-3.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center gap-3 bg-white/55 dark:bg-slate-900/55 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1500}
            disabled={aiLoading || (channelTab === 'peer' && (!selectedPeerUid || user.role === 'judge'))}
            placeholder={
              channelTab === 'ai'
                ? 'Nhập câu hỏi hoặc bài tập cần Gemini AI hỗ trợ...'
                : channelTab === 'forum'
                  ? forumStreamFilter === 'study_group'
                    ? 'Đăng thảo luận vào luồng Nhóm học tập...'
                    : forumStreamFilter === 'teachers'
                      ? 'Gửi câu hỏi hoặc trao đổi vào luồng Thầy cô...'
                      : forumStreamFilter === 'announcements'
                        ? 'Đăng chia sẻ vào luồng Thông báo chung...'
                        : 'Chia sẻ động lực học tập lên diễn đàn trường...'
                  : 'Nhắn tin cho bạn học...'
            }
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || aiLoading}
            className="aurora-accent-btn inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            Gửi
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
