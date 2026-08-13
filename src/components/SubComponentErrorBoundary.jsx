import React from 'react';

/**
 * A lightweight error boundary for wrapping individual sub-components.
 *
 * The top-level AppErrorBoundary catches render crashes but can't tell us
 * *which* sub-component threw. In production (minified) builds a TDZ error
 * like "Cannot access 'I' before initialization" gives no source location, so
 * wrapping each major panel in its own boundary lets us isolate the culprit
 * from the boundary's `name` prop.
 *
 * On crash it shows a compact inline message with the component name and a
 * Retry button, and logs the full error + component stack to the console.
 */
export default class SubComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ errorInfo: info });
    console.error(
      `[SubComponentErrorBoundary] "${this.props.name}" crashed:`,
      error,
      info?.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 gap-3 text-center">
          <p className="text-xs font-semibold text-red-400">
            {this.props.name} crashed
          </p>
          <pre className="text-[10px] text-red-300 bg-slate-800 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all max-w-full">
            {msg}
          </pre>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1 text-[11px] rounded border border-slate-600/40 text-slate-300 hover:text-white hover:bg-accent transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}