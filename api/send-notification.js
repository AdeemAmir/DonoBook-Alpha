import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { receiver_id, sender_id, text } = req.body.record;
        const actualMessageText = text || 'Sent a message';
        const notifLink = `/messages?userId=${sender_id}`;

        if (!receiver_id) {
            return res.status(400).json({ error: 'Missing receiver ID context.' });
        }

        const supabaseUrl = process.env.VITE_MY_SUPABASE_URL;
        const serviceRoleKey = process.env.VITE_MY_SUPABASE_SERVICE_ROLE_KEY;

        const [receiverRes, senderRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${receiver_id}&select=fcm_token`, {
                method: 'GET',
                headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
            }),
            sender_id ? fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sender_id}&select=name`, {
                method: 'GET',
                headers: { 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` }
            }) : Promise.resolve(null)
        ]);

        const receiverData = await receiverRes.json();
        const registrationToken = receiverData?.[0]?.fcm_token;

        let displaySenderName = 'New Message';
        if (senderRes) {
            const senderData = await senderRes.json();
            displaySenderName = senderData?.[0]?.name || 'Someone';
        }

        if (!registrationToken) {
            return res.status(200).json({ message: 'User has no registered device token.' });
        }

        // ─── UNIFIED NATIVE FIREBASE PAYLOAD ───
        const message = {
            token: registrationToken,

            // ADD THIS — Android reads this when screen is off / app is closed
            data: {
                title: String(displaySenderName),
                body: String(actualMessageText),
                link: notifLink,
            },

            notification: {
                title: String(displaySenderName),
                body: String(actualMessageText),
            },

            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    title: String(displaySenderName),
                    body: String(actualMessageText),
                    icon: '/logo-192x192.png',
                    badge: '/logo-192x192.png',
                    tag: 'chat-message',
                    renotify: true,
                    data: { url: notifLink },  // ADD THIS too
                },
                fcmOptions: {
                    link: notifLink
                }
            },

            android: {
                priority: 'high'
            }
        };

        await getMessaging().send(message);
        return res.status(200).json({ success: true, message: 'Notification sent successfully.' });

    } catch (error) {
        console.error('Webhook Endpoint Error:', error);
        return res.status(500).json({ error: error.message });
    }
}