import { Component } from "react";

/**
 * Catches render-time errors so one broken page cannot blank the whole app.
 *
 * Always logs the real error and component stack to the browser console, so the
 * cause is never hidden. The technical detail is only shown on screen in
 * development; production shows the friendly message alone.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Always log, in every environment: this is the only place the real cause
    // of a blank page becomes visible.
    console.error("Unhandled UI error:", error, info?.componentStack || "");
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    const { children } = this.props;

    if (!error) return children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="w-full max-w-lg rounded-card border border-line bg-surface p-8 text-center shadow-float">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <h1 className="mt-4 text-xl font-bold tracking-tight text-ink">
            Something went wrong on this page.
          </h1>
          <p className="mt-2 text-sm text-body">
            The error has been logged to the browser console. Reload to try again, or head back to
            the home page.
          </p>

          {isDev && (
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-red-200 bg-red-50 p-3 text-left font-mono text-xs text-red-700">
              {String(error?.message || error)}
              {info?.componentStack ? `\n${info.componentStack}` : ""}
            </pre>
          )}

          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-600/20 sm:w-auto"
            >
              Reload page
            </button>
            <a
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary-600 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-600/20 sm:w-auto"
            >
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
