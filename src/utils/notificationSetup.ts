// src/notificationSetup.ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB79kP09MnDG2P-FtshDl9ihO7pcu45UbM",
  authDomain: "donobook-fyp.firebaseapp.com",
  projectId: "donobook-fyp",
  storageBucket: "donobook-fyp.firebasestorage.app",
  messagingSenderId: "179204954432",
  appId: "1:179204954432:web:83ff5022c73fb189b242a5",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async (userId: string): Promise<string | null> => {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permission denied.');
      return null;
    }

    // CRITICAL: Always explicitly register YOUR Firebase SW
    // Do not rely on the auto-generated Workbox SW for FCM
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );

    // Wait until the SW is truly active (critical on mobile)
    await navigator.serviceWorker.ready;

    // If a new SW is waiting, activate it immediately
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    console.log('Firebase SW registered and ready');

    const token = await getToken(messaging, {
      vapidKey: 'BOrKJCGlLGqUo41CkfDkZACOma05_By2wOgfIZc4KlrAwlfz6UtzkF9qwYO90uAFm-yb7qhNTsaMmj4Cj6bOSfw',
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM Token:', token);
      // Save token to Supabase profile here
      return token;
    }

    console.warn('No FCM token received');
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

export const setupForegroundMessageListener = () => {
  try {
    onMessage(messaging, (payload) => {
      console.log("Foreground message:", payload);
      const title = payload.notification?.title || payload.data?.title || "New Message";
      const body = payload.notification?.body || payload.data?.body || "You have a new message";
      (`🔔 ${title}: ${body}`);
    });
  } catch (error) {
    console.error("Foreground listener failed:", error);
  }
};