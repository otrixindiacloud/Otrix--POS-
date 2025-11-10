import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);

  useEffect(() => {
    // Check if app was already installed or prompt was dismissed recently
    const dismissTime = localStorage.getItem('pwa-install-dismissed');
    const isRecentlyDismissed = dismissTime && (Date.now() - parseInt(dismissTime)) < 7 * 24 * 60 * 60 * 1000; // 7 days
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
      setCanInstall(true);
      
      // Show automatic prompt if not recently dismissed and not already installed
      if (!isRecentlyDismissed && !isStandalone) {
        // Delay the prompt slightly to let the page load
        setTimeout(() => {
          setShowAutoPrompt(true);
        }, 2000);
      }
    };

    const handleAppInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    // Cast to any to avoid TypeScript issues with custom event types
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
      setShowAutoPrompt(false);
    } else {
      // User dismissed the install prompt
      localStorage.setItem('pwa-install-dismissed', 'true');
      setShowAutoPrompt(false);
    }
  };

  const dismissAutoPrompt = () => {
    const dismissTime = Date.now();
    localStorage.setItem('pwa-install-dismissed', dismissTime.toString());
    setShowAutoPrompt(false);
  };

  return { canInstall, installPWA, showAutoPrompt, dismissAutoPrompt };
}