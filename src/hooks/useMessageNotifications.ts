import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseMessageNotificationsProps {
  currentUserId: string | null;
  onNewMessage?: () => void;
}

export const useMessageNotifications = ({ 
  currentUserId, 
  onNewMessage 
}: UseMessageNotificationsProps) => {
  const { toast } = useToast();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio for notification sound
    audioRef.current = new Audio();
    // Using a simple beep sound via data URL
    audioRef.current.src = '/sound/message_notification.mp3';
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setPermissionGranted(permission === 'granted');
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setPermissionGranted(true);
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('message_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', newMessage.sender_id)
            .single();

          const senderName = senderProfile?.name || 'Someone';

          // Play notification sound
          if (audioRef.current) {
            try {
              audioRef.current.play().catch(err => console.log('Audio play failed:', err));
            } catch (error) {
              console.log('Audio error:', error);
            }
          }

          // Show browser notification
          if (permissionGranted && document.hidden) {
            try {
              const notification = new Notification(`New message from ${senderName}`, {
                body: newMessage.text,
                icon: '/favicon.ico',
                tag: 'message-notification',
                requireInteraction: false,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch (error) {
              console.log('Notification error:', error);
            }
          }

          // Show toast notification if app is visible
          if (!document.hidden) {
            toast({
              title: `New message from ${senderName}`,
              description: newMessage.text,
            });
          }

          // Callback for additional actions
          if (onNewMessage) {
            onNewMessage();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, permissionGranted, toast, onNewMessage]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionGranted(permission === 'granted');
      
      if (permission === 'granted') {
        toast({
          title: 'Notifications enabled',
          description: 'You will receive notifications for new messages',
        });
      } else {
        toast({
          title: 'Notifications blocked',
          description: 'Enable notifications in your browser settings to receive alerts',
          variant: 'destructive',
        });
      }
    }
  };

  return { permissionGranted, requestPermission };
};
