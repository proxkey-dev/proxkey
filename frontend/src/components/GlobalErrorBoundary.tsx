import { Component, type ErrorInfo, type ReactNode } from 'react'
import { FeedbackModal } from './FeedbackModal'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  showFeedbackModal: boolean
  errorId: string
}

type FeedbackPayload = {
  errorId: string
  feedback: string
  error?: string
  stack?: string
  timestamp: string
  userAgent: string
  url: string
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    showFeedbackModal: false,
    errorId: '',
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = Math.random().toString(36).substr(2, 9)
    return {
      hasError: true,
      error,
      showFeedbackModal: true,
      errorId,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GlobalErrorBoundary caught an error:', error, errorInfo)

    // Log error details
    this.logError(error, errorInfo)
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    console.error('Error logged:', errorDetails)

    // You can send this to your error tracking service
    // Example: Sentry.captureException(error, { extra: errorDetails });
  }

  private handleFeedbackSubmit = (feedback: string) => {
    const feedbackData = {
      errorId: this.state.errorId,
      feedback,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    console.log('User feedback submitted:', feedbackData)

    // Send feedback to your backend
    this.sendFeedback(feedbackData)

    // Close the feedback modal
    this.setState({ showFeedbackModal: false })
  }

  private sendFeedback = async (feedbackData: FeedbackPayload) => {
    try {
      // You can send this to your backend API
      // await fetch('/api/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(feedbackData),
      // });

      console.log('Feedback sent to backend:', feedbackData)
    } catch (error) {
      console.error('Failed to send feedback:', error)
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      showFeedbackModal: false,
      errorId: '',
    })
  }

  private handleSkipFeedback = () => {
    this.setState({ showFeedbackModal: false })
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            {/* Error Display */}
            <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 16 16"
                    className="text-red-400"
                    style={{ imageRendering: 'pixelated' }}
                    fill="currentColor"
                  >
                    {/* Pixel-style warning triangle */}
                    <rect x="7" y="2" width="2" height="1" />
                    <rect x="6" y="3" width="4" height="1" />
                    <rect x="5" y="4" width="6" height="1" />
                    <rect x="4" y="5" width="8" height="1" />
                    <rect x="3" y="6" width="10" height="1" />
                    <rect x="2" y="7" width="12" height="1" />
                    <rect x="1" y="8" width="14" height="1" />
                    <rect x="2" y="9" width="12" height="1" />
                    <rect x="3" y="10" width="10" height="1" />
                    <rect x="4" y="11" width="8" height="1" />
                    <rect x="5" y="12" width="6" height="1" />
                    {/* Exclamation mark */}
                    <rect x="7" y="5" width="2" height="3" />
                    <rect x="7" y="9" width="2" height="1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-red-400">We Just Caught an Error</h2>
                  <p className="text-red-300 text-sm">Something unexpected happened</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-red-200 text-sm">
                  We&apos;re sorry for the inconvenience. This error has been automatically logged
                  and our team will investigate. Your feedback would be incredibly helpful in fixing
                  this issue.
                </p>

                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                  <p className="text-red-300 text-xs">
                    <strong>Error ID:</strong> {this.state.errorId}
                  </p>
                  <p className="text-red-300 text-xs mt-1">
                    Please include this ID if you contact support.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={this.handleRetry}
                    className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={this.handleRefresh}
                    className="flex-1 rounded-md border border-red-500/30 px-4 py-2 text-sm font-medium hover:bg-red-500/10 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>

            {/* Error Details (for development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 mb-4">
                <h3 className="text-sm font-medium text-white mb-2">Error Details (Development)</h3>
                <pre className="text-xs text-white/60 overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </div>
            )}
          </div>

          {/* Feedback Modal */}
          {this.state.showFeedbackModal && (
            <FeedbackModal
              isOpen={true}
              onClose={this.handleSkipFeedback}
              onSubmit={this.handleFeedbackSubmit}
              title="Help Us Fix This Error"
              description={`We just caught an error (ID: ${this.state.errorId}) and would love your feedback to help us improve. Please describe what you were doing when this happened.`}
              placeholder="What were you trying to do when this error occurred? Any additional details would be helpful..."
              submitText="Submit Feedback"
              skipText="Skip for Now"
            />
          )}
        </div>
      )
    }

    return this.props.children
  }
}
