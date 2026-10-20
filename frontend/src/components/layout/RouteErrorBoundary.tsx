import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Callout } from "../ui";

interface Props {
  children: ReactNode;
  // Changing it (the pathname) clears a shown error, so navigating away recovers the app.
  resetKey: string;
}

interface State {
  error: Error | null;
  resetKey: string;
}

// Without a boundary, one failed render — or a lazy chunk that can't be fetched, e.g. right after
// a deploy or on a dropped connection — unmounts the whole app and leaves a blank screen.
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: Props,
    state: State,
  ): Partial<State> | null {
    return props.resetKey !== state.resetKey
      ? { error: null, resetKey: props.resetKey }
      : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-bg p-4 text-text">
        <div className="mx-auto flex max-w-md flex-col gap-3 pt-10">
          <Callout tone="danger">
            Diese Seite konnte nicht geladen werden. Das passiert nach einem
            Update oder bei schlechter Verbindung. Deine Daten sind nicht
            betroffen.
          </Callout>
          <Button
            variant="primary"
            size="lg"
            onClick={() => window.location.reload()}
          >
            Neu laden
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => this.setState({ error: null })}
          >
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }
}
