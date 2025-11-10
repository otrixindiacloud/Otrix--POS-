import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Check for infinite loop patterns
    if (error.message.includes('Maximum update depth exceeded')) {
      console.error('🔴 INFINITE LOOP DETECTED!');
      console.error('This typically happens when:');
      console.error('1. A useEffect updates state that is in its dependency array');
      console.error('2. State setters from stores are included in useEffect dependencies');
      console.error('3. A component renders itself in an infinite loop');
      console.error('\nComponent Stack:', errorInfo.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
    `.trim();
    
    navigator.clipboard.writeText(errorText);
    alert('Error details copied to clipboard!');
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails } = this.state;
      const isInfiniteLoop = error?.message.includes('Maximum update depth exceeded');

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-2xl w-full">
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-bold">
                {isInfiniteLoop ? 'Infinite Loop Detected' : 'Something went wrong'}
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="font-semibold">{error?.message}</p>
                
                {isInfiniteLoop && (
                  <div className="mt-4 p-3 bg-rose-100 border border-rose-300 rounded text-sm">
                    <p className="font-bold text-rose-900 mb-2">Common Causes:</p>
                    <ul className="list-disc list-inside space-y-1 text-rose-800">
                      <li>useEffect with state setters in dependency array</li>
                      <li>State update triggering the same state update</li>
                      <li>Zustand store setters in useEffect dependencies</li>
                      <li>Infinite render loop in component logic</li>
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={this.handleReset}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                  <Button
                    onClick={this.handleCopyError}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Error
                  </Button>
                  <Button
                    onClick={this.toggleDetails}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showDetails ? 'Hide' : 'Show'} Details
                  </Button>
                </div>

                {showDetails && (
                  <div className="mt-4 space-y-3">
                    <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-60">
                      <div className="font-bold text-red-400 mb-2">Error Stack:</div>
                      <pre className="whitespace-pre-wrap">{error?.stack}</pre>
                    </div>
                    
                    {errorInfo?.componentStack && (
                      <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-60">
                        <div className="font-bold text-yellow-400 mb-2">Component Stack:</div>
                        <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
