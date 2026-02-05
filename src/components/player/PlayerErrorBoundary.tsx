import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PlayerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // console.error("InflucinePlayer Error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-8 relative overflow-hidden">
            {/* Background noise/pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            
            <div className="z-10 bg-red-500/10 border border-red-500/20 p-8 rounded-2xl backdrop-blur-md max-w-md w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                
                <h2 className="text-2xl font-bold mb-2">Playback Error</h2>
                <p className="text-gray-400 mb-6 text-sm">
                    Something went wrong while trying to play this content.
                </p>

                {/* Error Details (Collapsible in real app, shown for debug here) */}
                {this.state.error && (
                    <div className="bg-black/40 rounded p-3 mb-6 text-left overflow-auto max-h-32">
                        <code className="text-xs text-red-300 font-mono">
                            {this.state.error.toString()}
                        </code>
                    </div>
                )}

                <button 
                    onClick={this.handleRetry}
                    className="w-full bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Reload Player
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
