import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-5">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              An unexpected error occurred. Your data is safe — tap below to reload the app.
            </p>
          </div>
          <Button onClick={this.handleReload} className="gap-2" data-testid="button-error-reload">
            <RefreshCw className="w-4 h-4" />
            Reload app
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
