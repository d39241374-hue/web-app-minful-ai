import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    let msg = error.message || 'Đã xảy ra lỗi không mong muốn.';
    try {
      const parsed = JSON.parse(msg) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        msg = `Lỗi dữ liệu đám mây (${parsed.operationType || 'read'}${parsed.path ? ` · ${parsed.path}` : ''}): ${parsed.error}`;
      }
    } catch {
      // plain error string
    }
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: Error) {
    console.error('Mindful AI ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen aurora-surface flex items-center justify-center p-6 text-slate-900 dark:text-slate-100">
          <div className="glass-panel max-w-lg w-full rounded-2xl p-8 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-xl font-semibold">Đã có sự cố phiên làm việc</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="aurora-accent-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
