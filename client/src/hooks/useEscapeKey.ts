import { useEffect } from "react";

interface UseEscapeKeyOptions {
  onEscape: () => void;
  enabled?: boolean;
}

export function useEscapeKey({ onEscape, enabled = true }: UseEscapeKeyOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, enabled]);
}

// Hook for multiple modal/dialog management
export function useModalStack() {
  const modalStack: Array<() => void> = [];

  const pushModal = (closeHandler: () => void) => {
    modalStack.push(closeHandler);
  };

  const popModal = () => {
    const lastModal = modalStack.pop();
    if (lastModal) {
      lastModal();
    }
  };

  const clearStack = () => {
    modalStack.length = 0;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalStack.length > 0) {
        event.preventDefault();
        popModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { pushModal, popModal, clearStack };
}