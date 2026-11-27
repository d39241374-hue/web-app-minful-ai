import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Award, CheckCircle2, X, XCircle } from 'lucide-react';
import type { ToastItem } from '../types';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TOAST_STYLES: Record<
  ToastItem['type'],
  {
    ring: string;
    iconBg: string;
    bar: string;
    Icon: typeof CheckCircle2;
  }
> = {
  success: {
    ring: 'border-emerald-500/30 dark:border-emerald-400/25',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    bar: 'bg-gradient-to-r from-emerald-500 to-cyan-400',
    Icon: CheckCircle2,
  },
  warning: {
    ring: 'border-amber-500/35 dark:border-amber-400/30',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-400',
    Icon: AlertTriangle,
  },
  error: {
    ring: 'border-rose-500/35 dark:border-rose-400/30',
    iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    bar: 'bg-gradient-to-r from-rose-500 to-pink-500',
    Icon: XCircle,
  },
  badge: {
    ring: 'border-indigo-500/35 dark:border-indigo-400/30',
    iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    bar: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
    Icon: Award,
  },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      className="fixed top-[calc(0.75rem+env(safe-area-inset-top))] inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 z-[90] flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.success;
          const Icon = style.Icon;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -22, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.42}
              onDragEnd={(_event, info) => {
                if (Math.abs(info.offset.x) > 75 || Math.abs(info.velocity.x) > 450) {
                  onDismiss(toast.id);
                }
              }}
              className={`pointer-events-auto relative overflow-hidden glass-card-solid rounded-2xl px-3.5 py-3 shadow-xl border ${style.ring} flex items-center gap-3 text-sm text-slate-900 dark:text-slate-100 cursor-grab active:cursor-grabbing`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="flex-1 leading-snug text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 -mr-1 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>

              <motion.span
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.5, ease: 'linear' }}
                className={`absolute bottom-0 left-0 right-0 h-[2.5px] origin-left ${style.bar}`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
