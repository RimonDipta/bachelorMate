import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/** Contains render errors to one page so the rest of the app keeps working. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" role="alert">
        <div className="empty">
          <div className="empty-icon"><AlertTriangle /></div>
          <h3>Something went wrong on this page</h3>
          <p>The rest of BachelorMate still works. Try reloading, or go back.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => window.history.back()}>Go back</button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
