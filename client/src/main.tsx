import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 React application starting...");

// Register service worker for PWA functionality only in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // In development, unregister any existing service workers to prevent caching issues
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
        console.log('Unregistered SW for development mode');
      });
    });
  });
}

// Get root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Clear the initial loading spinner and render React app
rootElement.innerHTML = '';
createRoot(rootElement).render(<App />);
console.log("✅ React root rendered");
