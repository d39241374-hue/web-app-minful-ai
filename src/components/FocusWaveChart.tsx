import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, Flame, TrendingUp } from 'lucide-react';

interface FocusWaveChartProps {
  weeklyFocusMins: number[];
  todayFocusMins: number;
  compact?: boolean;
  ultraCompact?: boolean;
  showModeToggle?: boolean;
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getTodayWeekdayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Smooth Catmull-Rom to cubic Bezier SVG path through points */
function buildSmoothWavePath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function FocusWaveChart({
  weeklyFocusMins,
  todayFocusMins,
  compact = false,
  ultraCompact = false,
  showModeToggle = false,
}: FocusWaveChartProps) {
  const todayIdx = getTodayWeekdayIndex();
  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);
  const [chartMode, setChartMode] = useState<'wave' | 'bar'>('wave');

  const safeWeekly = useMemo(() => {
    const arr = weeklyFocusMins?.length === 7 ? [...weeklyFocusMins] : [0, 0, 0, 0, 0, 0, 0];
    if (todayFocusMins > (arr[todayIdx] || 0)) {
      arr[todayIdx] = todayFocusMins;
    }
    return arr.map((v) => Math.max(0, Math.round(Number(v) || 0)));
  }, [weeklyFocusMins, todayFocusMins, todayIdx]);

  const totalWeekMins = safeWeekly.reduce((sum, v) => sum + v, 0);
  const avgMins = Math.round(totalWeekMins / 7);
  const activeDays = safeWeekly.filter((v) => v >= 20).length;
  const peakMins = Math.max(...safeWeekly);
  const peakIdx = safeWeekly.indexOf(peakMins);
  const targetMins = 45;
  const maxScale = Math.max(60, Math.ceil(Math.max(peakMins, targetMins) / 15) * 15);

  const consistencyPct = Math.round((activeDays / 7) * 100);
  const assessment =
    totalWeekMins === 0
      ? 'Hãy bắt đầu phiên Deep Work đầu tiên để vẽ nên nhịp Sóng Tập trung của bạn.'
      : consistencyPct >= 70
        ? `Nhịp sóng rất ổn định (${activeDays}/7 ngày đạt chuẩn), duy trì thói quen xuất sắc.`
        : consistencyPct >= 40
          ? `Đà tập trung đang tăng (${activeDays}/7 ngày). Hãy giữ tối thiểu 25 phút mỗi ngày.`
          : 'Sóng tập trung còn ngắt quãng. Thử chia nhỏ phiên 15–25 phút để tạo đà đều hơn.';

  // SVG Layout
  const svgW = 540;
  const svgH = ultraCompact ? 132 : compact ? 168 : 200;
  const padL = 34;
  const padR = 18;
  const padT = ultraCompact ? 16 : 22;
  const padB = ultraCompact ? 22 : 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const baselineY = padT + plotH;

  const points = safeWeekly.map((mins, idx) => {
    const x = padL + (idx / 6) * plotW;
    const norm = Math.min(1, mins / maxScale);
    const y = baselineY - norm * plotH;
    return { x, y, mins, day: DAY_LABELS[idx], idx };
  });

  const waveLinePath = buildSmoothWavePath(points);
  const waveAreaPath = `${waveLinePath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  const targetY = baselineY - Math.min(1, targetMins / maxScale) * plotH;

  const activePoint = points[selectedDay] || points[todayIdx];

  return (
    <div className={`flex flex-col ${ultraCompact ? 'gap-2' : 'gap-3'} min-w-0`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            Sóng Tập trung (Focus Wave)
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs sm:text-sm font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
            {totalWeekMins} phút/tuần
          </span>
          {showModeToggle && (
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setChartMode('wave')}
                aria-pressed={chartMode === 'wave'}
                className={`min-h-[30px] px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                  chartMode === 'wave'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Sóng</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('bar')}
                aria-pressed={chartMode === 'bar'}
                className={`min-h-[30px] px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                  chartMode === 'bar'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Cột</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected Day Readout Strip (Unboxed Typography) */}
      <div className={`flex flex-wrap items-center justify-between gap-2 text-xs border-y border-slate-200/70 dark:border-slate-800/70 ${ultraCompact ? 'py-1.5' : 'py-2'}`}>
        <div className="font-semibold text-slate-700 dark:text-slate-200">
          {activePoint.day}
          {activePoint.idx === todayIdx ? ' (Hôm nay)' : ''}:{' '}
          <span className="font-mono-num font-bold text-sky-600 dark:text-sky-400">
            {activePoint.mins} phút Deep Work
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono-num text-xs text-slate-500 dark:text-slate-400">
          <span>TB {avgMins}p/ngày</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
            <Flame className="w-3.5 h-3.5" />
            Đỉnh {DAY_LABELS[peakIdx]} ({peakMins}p)
          </span>
        </div>
      </div>

      {/* Interactive SVG Wave or Bar Visualization */}
      {chartMode === 'wave' ? (
        <div className="w-full select-none">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className={`w-full ${
              ultraCompact ? 'h-24 sm:h-28 xl:h-32' : compact ? 'h-40 sm:h-44' : 'h-48 sm:h-52'
            } overflow-visible`}
            role="img"
            aria-label="Biểu đồ Sóng Tập trung 7 ngày"
          >
            <defs>
              <linearGradient id="focusWaveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id="focusWaveFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.34" />
                <stop offset="60%" stopColor="#10B981" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal reference grid */}
            {[0, 0.5, 1].map((ratio) => {
              const y = baselineY - ratio * plotH;
              const val = Math.round(maxScale * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray={ratio === 0 ? undefined : '3 4'}
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    className="fill-slate-400 font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* 45m Daily Focus Target Line */}
            <line
              x1={padL}
              y1={targetY}
              x2={svgW - padR}
              y2={targetY}
              stroke="#10B981"
              strokeWidth="1.3"
              strokeDasharray="5 4"
              opacity="0.7"
            />
            <text
              x={svgW - padR}
              y={targetY - 5}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              className="fill-emerald-600 dark:fill-emerald-400 font-mono"
            >
              Mục tiêu {targetMins}p
            </text>

            {/* Area Fill */}
            <motion.path
              d={waveAreaPath}
              fill="url(#focusWaveFill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
            />

            {/* Smooth Animated Focus Wave Line */}
            <motion.path
              d={waveLinePath}
              fill="none"
              stroke="url(#focusWaveStroke)"
              strokeWidth="3.2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            />

            {/* Vertical guide line on selected day */}
            <line
              x1={activePoint.x}
              y1={padT}
              x2={activePoint.x}
              y2={baselineY}
              stroke="#38BDF8"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.55"
            />

            {/* Interactive Day Nodes */}
            {points.map((pt) => {
              const isSelected = pt.idx === selectedDay;
              const isToday = pt.idx === todayIdx;
              return (
                <g
                  key={pt.day}
                  className="cursor-pointer"
                  onClick={() => setSelectedDay(pt.idx)}
                  onMouseEnter={() => setSelectedDay(pt.idx)}
                >
                  {/* Invisible wider touch/hover target */}
                  <rect x={pt.x - 24} y={padT - 8} width="48" height={plotH + 34} fill="transparent" />

                  {isSelected && (
                    <circle cx={pt.x} cy={pt.y} r="10" fill="#38BDF8" opacity="0.22" />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 4.2}
                    fill={isToday ? '#10B981' : '#0EA5E9'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />

                  <text
                    x={pt.x}
                    y={Math.max(13, pt.y - 11)}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    className={`font-mono ${
                      isSelected ? 'fill-slate-900 dark:fill-white' : 'fill-slate-500 dark:fill-slate-400'
                    }`}
                  >
                    {pt.mins}p
                  </text>

                  <text
                    x={pt.x}
                    y={svgH - 6}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={isToday || isSelected ? '700' : '600'}
                    className={
                      isToday
                        ? 'fill-emerald-600 dark:fill-emerald-400'
                        : isSelected
                          ? 'fill-slate-900 dark:fill-white'
                          : 'fill-slate-500 dark:fill-slate-400'
                    }
                  >
                    {pt.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className={`grid grid-cols-7 gap-2.5 items-end ${ultraCompact ? 'h-24 sm:h-28 xl:h-32 pt-1.5' : 'h-48 sm:h-52 pt-4'}`}>
          {points.map((pt) => {
            const pct = Math.max(6, Math.round((pt.mins / maxScale) * 100));
            const isSelected = pt.idx === selectedDay;
            return (
              <button
                key={pt.day}
                type="button"
                onClick={() => setSelectedDay(pt.idx)}
                className="flex flex-col items-center gap-1.5 h-full justify-end group"
              >
                <span className="text-xs font-semibold font-mono-num text-slate-600 dark:text-slate-300">
                  {pt.mins}p
                </span>
                <div className="w-full max-w-[40px] flex-1 flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                    className={`w-full aurora-xp-fill rounded-t-xl ${
                      isSelected ? 'ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-900' : 'opacity-90'
                    }`}
                  />
                </div>
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    pt.idx === todayIdx ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {pt.day}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Self-Evaluation Summary */}
      <div className="flex items-start justify-between gap-3 pt-1 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
        <p className="flex-1">{assessment}</p>
        <span className="font-mono-num font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">
          Độ bền {consistencyPct}%
        </span>
      </div>
    </div>
  );
}
