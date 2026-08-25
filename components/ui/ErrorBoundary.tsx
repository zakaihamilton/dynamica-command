"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import styles from "./ErrorBoundary.module.css";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Screen-specific heading shown when content crashes. */
  title?: string;
  eyebrow?: string;
  fallback?: ReactNode;
};
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className={styles.fallback} role="alert" data-testid="screen-error">
          <p className={styles.eyebrow}>{this.props.eyebrow ?? "Transmission interrupted"}</p>
          <h2 className={styles.title}>{this.props.title ?? "Something went wrong"}</h2>
          <p className={styles.detail}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </button>
            <Link href="/" className={styles.home}>
              Return to menu
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
