import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { strings } from "./lib/i18n";
import "./index.css";

/**
 * Last line of defence.
 *
 * Every tool already validates its inputs and reports failures as a Notice, but
 * a render-time throw in any one of them would otherwise unmount the entire app
 * and leave a blank page with no way back. This keeps the failure visible, says
 * what happened, and offers a reload — it does not hide the error.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep it in the console for a bug report; never swallow it silently.
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Read the language the app last applied; fall back to the stored setting so
    // this still localises when the crash happened before the effect ran.
    const lang = document.documentElement.lang.startsWith("zh") ? 1 : 0;
    const title = lang ? "界面渲染失败" : "Something failed to render";
    const hint = lang
      ? "这是一个未预期的错误。下面的信息可用于定位问题；重新加载通常可以继续使用其他工具。"
      : "This was an unexpected error. The message below helps track it down; reloading usually gets the rest of the tools back.";
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="w-full max-w-2xl rounded-tool border border-danger/40 bg-surface p-6">
          <h1 className="text-xl font-bold text-text">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{hint}</p>
          <pre className="mt-4 max-h-64 overflow-auto rounded-ui border border-line bg-panel p-3 font-mono text-xs leading-5 text-danger">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-11 items-center rounded-ui border border-accent bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            {strings["common.reload"][lang]}
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
