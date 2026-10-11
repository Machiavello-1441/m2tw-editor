import React from 'react';
import { clearBigFiles } from '@/lib/bigFileStore';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] Render crash:', error, info?.componentStack);
  }

  handleClear = async () => {
    if (!window.confirm('Clear loaded mod files and editor changes from this browser? Export your changes first.')) return;
    try {
      await clearBigFiles();
      window.location.reload();
    } catch (error) {
      this.setState({ error });
    }
  };

  handleDismiss = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950 z-50 p-6">
          <div className="max-w-lg w-full rounded-xl border border-red-500/40 bg-slate-900 p-6 space-y-4">
            <h2 className="text-red-400 font-bold text-lg">Render Error</h2>
            <p className="text-slate-300 text-sm">
              A component crashed while rendering. Dismiss the error to retry, or clear loaded editor data after exporting any changes you need to keep.
            </p>
            <pre className="text-[11px] text-red-300 bg-slate-800 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {msg}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={this.handleClear}
                className="flex-1 py-2 rounded bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Clear Cache &amp; Reload
              </button>
              <button
                onClick={this.handleDismiss}
                className="px-4 py-2 rounded border border-slate-600/40 text-slate-300 hover:text-white text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}