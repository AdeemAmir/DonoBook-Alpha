importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. A dummy variable to prevent Vite build crashes with injectManifest
console.log('Workbox Manifest Injected:', self.__WB_MANIFEST);

// 2. Initialize Firebase
firebase.initializeApp({
    apiKey: "AIzaSyB79kP09MnDG2P-FtshDl9ihO7pcu45UbM",
    authDomain: "donobook-fyp.firebaseapp.com",
    projectId: "donobook-fyp",
    storageBucket: "donobook-fyp.firebasestorage.app",
    messagingSenderId: "179204954432",
    appId: "1:179204954432:web:83ff5022c73fb189b242a5",
});

const messaging = firebase.messaging();

// 3. Gracefully catch the background signal so Chrome doesn't throw a fallback error
// AFTER (fixed - actually shows the notification)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background push received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'New Message';
    const body = payload.notification?.body || payload.data?.body || 'You have a new message';
    const url = payload.data?.link || payload.fcmOptions?.link || '/dashboard?tab=messages';

    return self.registration.showNotification(title, {
        body,
        icon: '/logo-192x192.png',
        badge: '/logo-192x192.png',
        tag: 'chat-message',
        renotify: true,
        vibrate: [300, 100, 400],
        data: { url },
    });
});

// 4. Force instant takeover
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Handle clean redirection routing when a user taps your notification banner
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Extract the redirect target URL from the incoming notification data packet
    const targetUrl = event.notification.data?.url || '/dashboard?tab=messages';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If the application dashboard tab is open, focus it and route
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if ('focus' in client && 'navigate' in client) {
                    client.focus();
                    return client.navigate(targetUrl);
                }
            }
            // If the app is completely closed, launch a fresh window straight to messages
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});