import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import chibiManagerImg from '../assets/images/chibi_tree_manager_1795700337468.jpg';
import { ScrollFadeSection } from './ChibiManager';

interface AuthViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onGoogleLogin: () => Promise<void>;
  onJudgeLogin: (password: string) => boolean;
  authLoading: boolean;
}

export function AuthView({
  isDark,
  onToggleTheme,
  onGoogleLogin,
  onJudgeLogin,
  authLoading,
}: AuthViewProps) {
  const [showJudgeBox, setShowJudgeBox] = useState(false);
  const [judgePass, setJudgePass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [judgeError, setJudgeError] = useState('');

  const handleJudgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onJudgeLogin(judgePass.trim());
    if (!ok) {
      setJudgeError('Mật khẩu Ban giám khảo không đúng.');
    } else {
      setJudgeError('');
    }
  };

  return (
    <div className="relative min-h-[100dvh] aurora-surface flex flex-col justify-between px-4 sm:px-6 py-4 sm:py-5 text-slate-900 dark:text-slate-100">
      <div className="led-strip fixed top-0 inset-x-0 h-[3px] z-30" />
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4 shrink-0 pt-1">
        <div className="font-display text-xl font-extrabold tracking-tight aurora-gradient-text whitespace-nowrap shrink-0">
          Mindful AI
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/75 dark:bg-slate-900/65 text-sm font-semibold hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          {isDark ? 'Chế độ Ngày' : 'Chế độ Đêm'}
        </button>
      </header>

      <main className="max-w-6xl w-full mx-auto my-auto py-5 sm:py-6 grid lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        <section className="lg:col-span-7 flex flex-col justify-center space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            <span>Nghiên cứu KHKT 2026</span>
            <span aria-hidden="true">·</span>
            <span>THPT Hương Khê, Hà Tĩnh</span>
            <span aria-hidden="true">·</span>
            <span>Mô hình CDS-HS</span>
          </div>

          <h1
            className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
            style={{ textWrap: 'balance' }}
          >
            Vườn Tâm Trí 3D &amp; Học tập tập trung Deep Work
          </h1>

          <p className="text-base sm:text-[17px] text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl">
            Kết hợp khu vườn 3D tiến hóa theo từng phiên học, đồng hành cùng Thiên Long Ngân Hà và trợ lý Gemini AI giúp học sinh THPT vượt qua Bất hòa nhận thức số.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
            <ScrollFadeSection>
              <div className="glass-panel rounded-2xl p-4 space-y-1 h-full">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Vườn 3D &amp; Rồng</div>
                <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">10 cấp tiến hóa</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Tăng trưởng theo phút Deep Work</p>
              </div>
            </ScrollFadeSection>
            <ScrollFadeSection delay={0.06}>
              <div className="glass-panel rounded-2xl p-4 space-y-1 h-full">
                <div className="text-sm font-semibold text-sky-700 dark:text-sky-400">Gemini AI &amp; Chibi</div>
                <p className="text-base font-bold text-slate-900 dark:text-white">Cố vấn &amp; Quản gia</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Tâm lý, Toán, Văn, Anh &amp; Sổ tay</p>
              </div>
            </ScrollFadeSection>
            <ScrollFadeSection delay={0.12}>
              <div className="glass-panel rounded-2xl p-4 space-y-1 h-full">
                <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Đồng bộ đám mây</div>
                <p className="text-base font-bold text-slate-900 dark:text-white">Lưu trữ đa thiết bị</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Hồ sơ CDS-HS &amp; học nhóm</p>
              </div>
            </ScrollFadeSection>
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col justify-center">
          <ScrollFadeSection>
            <div className="led-frame glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="led-strip absolute top-0 inset-x-0 h-[3px]" />
              <div className="space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="led-frame rounded-2xl shrink-0">
                    <img
                      src={chibiManagerImg}
                      alt="Linh Mộc Quản Gia Chibi"
                      className="w-16 h-16 rounded-2xl object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Linh Mộc Quản Gia · Sẵn sàng đồng hành
                    </span>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      Bắt đầu hành trình tỉnh thức
                    </h2>
                  </div>
                </div>
                <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Đăng nhập bằng tài khoản Google để đồng bộ cây 3D, Sổ tay 7 mục và dữ liệu CDS-HS trên mọi thiết bị.
                </p>
              </div>

            <button
              type="button"
              disabled={authLoading}
              onClick={() => void onGoogleLogin()}
              className="w-full min-h-[48px] aurora-accent-btn py-3.5 px-5 rounded-2xl text-[15px] font-bold shadow-md hover:opacity-95 disabled:opacity-60 transition-opacity flex items-center justify-center gap-3 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              {authLoading ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}
            </button>

            <div className="border-t border-slate-200 dark:border-slate-700/80 pt-4 space-y-3">
              <button
                type="button"
                onClick={() => setShowJudgeBox((v) => !v)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4" />
                {showJudgeBox ? 'Ẩn đăng nhập Ban giám khảo' : 'Chế độ trải nghiệm Ban giám khảo'}
              </button>

              {showJudgeBox && (
                <form onSubmit={handleJudgeSubmit} className="space-y-3 pt-1">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Nhập mã truy cập Ban giám khảo (mở khóa đủ Cấp 1–10 &amp; Demo 10 giây)
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={judgePass}
                      onChange={(e) => setJudgePass(e.target.value)}
                      placeholder="Nhập mật khẩu BGK..."
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {judgeError && <p className="text-sm text-rose-600 dark:text-rose-400">{judgeError}</p>}
                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    Vào chế độ Ban giám khảo
                  </button>
                </form>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Dữ liệu cá nhân được bảo vệ riêng tư theo từng tài khoản học sinh.</span>
            </div>
            </div>
          </ScrollFadeSection>
        </section>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <span>Mindful AI · Dự án Nghiên cứu Khoa học Kỹ thuật THPT Hương Khê 2026</span>
        <span>Hỗ trợ tập trung sâu &amp; cân bằng cảm xúc số</span>
      </footer>
    </div>
  );
}
