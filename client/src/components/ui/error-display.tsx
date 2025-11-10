import * as React from "react"
import { AlertCircle, X, Lightbulb, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ErrorDisplayProps {
  title?: string
  message: string
  suggestions?: string[]
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: "default" | "inline" | "compact"
}

export function ErrorDisplay({
  title = "Something went wrong",
  message,
  suggestions = [],
  onRetry,
  onDismiss,
  className,
  variant = "default",
}: ErrorDisplayProps) {
  const getSuggestions = (msg: string): string[] => {
    const lowerMsg = msg.toLowerCase()
    const defaultSuggestions: string[] = []

    if (lowerMsg.includes("session expired") || lowerMsg.includes("unauthorized")) {
      defaultSuggestions.push("Refresh the page to restore your session")
      defaultSuggestions.push("Check if you're logged in")
    } else if (lowerMsg.includes("network") || lowerMsg.includes("fetch")) {
      defaultSuggestions.push("Check your internet connection")
      defaultSuggestions.push("Try again in a few moments")
    } else if (lowerMsg.includes("validation") || lowerMsg.includes("required")) {
      defaultSuggestions.push("Please check all required fields are filled")
      defaultSuggestions.push("Verify the data format is correct")
    } else if (lowerMsg.includes("not found") || lowerMsg.includes("404")) {
      defaultSuggestions.push("The resource may have been moved or deleted")
      defaultSuggestions.push("Check if the URL is correct")
    } else if (lowerMsg.includes("timeout")) {
      defaultSuggestions.push("The request took too long to complete")
      defaultSuggestions.push("Try again with a simpler request")
    } else {
      defaultSuggestions.push("Please try again in a moment")
      defaultSuggestions.push("If the problem persists, contact support")
    }

    return suggestions.length > 0 ? suggestions : defaultSuggestions
  }

  const errorSuggestions = getSuggestions(message)

  if (variant === "inline") {
    return (
      <div className={cn("flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800", className)}>
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{title}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{message}</p>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800", className)}>
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">{message}</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 shadow-lg p-6", className)}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-3">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
            {title}
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-4 leading-relaxed">
            {message}
          </p>

          {errorSuggestions.length > 0 && (
            <div className="mt-4 p-4 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Suggestions
                </span>
              </div>
              <ul className="space-y-1.5">
                {errorSuggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <span className="text-amber-500 dark:text-amber-400 mt-1.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2 mt-4">
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

