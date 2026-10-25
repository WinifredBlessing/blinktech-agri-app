import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Notification } from '../types';

/**
 * Raw database row shape for public.notifications table.
 */
export interface DatabaseNotificationRow {
  id: string; // UUID primary key
  recipient_id: string; // UUID references public.profiles(id)
  type: string; // Allowed notification type string
  title: string; // Notification title header
  message: string; // Notification body text
  link: string | null; // Optional React-Router route
  related_id: string | null; // Optional UUID of related entity
  is_read: boolean; // Read status boolean
  read_at: string | null; // Timestamp when marked read
  created_at: string; // Timestamp when created
}

/**
 * Payload parameters required for creating a notification via the RPC.
 */
export interface CreateNotificationInput {
  recipientId: string;
  type:
    | 'new_request'
    | 'request_submitted'
    | 'request_accepted'
    | 'request_declined'
    | 'order_created'
    | 'order_status'
    | 'logistics_requested'
    | 'logistics_update'
    | string;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
}

/**
 * Realtime event shape emitted to notification listeners.
 */
export interface NotificationRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  notification?: Notification;
  id: string;
}

/**
 * Valid allowed types matching the database CHECK constraint on public.notifications.
 */
export const ALLOWED_NOTIFICATION_TYPES = [
  'new_request',
  'request_submitted',
  'request_accepted',
  'request_declined',
  'order_created',
  'order_status',
  'logistics_requested',
  'logistics_update'
] as const;

export type AllowedNotificationType = (typeof ALLOWED_NOTIFICATION_TYPES)[number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a formatted UUID.
 */
export const isValidUuid = (value?: string | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
};

/**
 * Automatically derives a default deep-link route for a given notification type.
 */
export const deriveNotificationLink = (type: string): string | undefined => {
  switch (type) {
    case 'new_request':
      return '/farmer/requests';
    case 'request_submitted':
      return '/buyer/requests';
    case 'request_accepted':
      return '/buyer/orders';
    case 'request_declined':
      return '/buyer/requests';
    case 'order_created':
      return '/farmer/orders';
    case 'logistics_requested':
    case 'logistics_update':
      return '/logistics';
    default:
      return undefined;
  }
};

/**
 * Maps a Supabase DatabaseNotificationRow into the application's domain Notification model.
 * Preserves existing field compatibility (userId, read) while providing Supabase-native fields.
 */
export function mapRowToNotification(row: DatabaseNotificationRow): Notification {
  return {
    id: row.id,
    userId: row.recipient_id,
    recipientId: row.recipient_id,
    type: row.type,
    title: row.title || '',
    message: row.message || '',
    link: row.link || undefined,
    relatedId: row.related_id || undefined,
    read: Boolean(row.is_read),
    isRead: Boolean(row.is_read),
    readAt: row.read_at || null,
    createdAt: row.created_at
  };
}

export class NotificationService {
  /**
   * 1. Fetches notifications for the authenticated user from Supabase.
   * Governed by RLS: recipient_id = auth.uid().
   * Ordered by created_at DESC (newest first).
   */
  public async fetchNotifications(userId?: string): Promise<Notification[]> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured. Returning empty notifications array.');
      return [];
    }

    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      if (!targetUserId) {
        return [];
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('NotificationService.fetchNotifications error:', error);
        return [];
      }

      return (data || []).map((row) => mapRowToNotification(row as DatabaseNotificationRow));
    } catch (err) {
      console.error('NotificationService.fetchNotifications exception:', err);
      return [];
    }
  }

  /**
   * 2. Creates a notification through the existing live Supabase RPC:
   * public.create_notification(p_recipient_id, p_type, p_title, p_message, p_link, p_related_id)
   *
   * SECURITY RULES ENFORCED:
   * - Never inserts directly into public.notifications from the frontend.
   * - Direct table INSERT is revoked on the database; only the SECURITY DEFINER RPC can insert.
   * - Validates UUID format and non-empty parameters.
   * - Sanitizes optional p_related_id to NULL if invalid UUID.
   */
  public async createNotification(input: CreateNotificationInput): Promise<Notification | null> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured. Cannot create notification.');
      return null;
    }

    const { recipientId, type, title, message, link, relatedId } = input;

    if (!recipientId || !isValidUuid(recipientId)) {
      console.warn('NotificationService.createNotification: invalid or missing recipientId UUID:', recipientId);
      return null;
    }

    if (!type || !title || !message) {
      console.warn('NotificationService.createNotification: missing required fields (type, title, message).');
      return null;
    }

    const sanitizedRelatedId = relatedId && isValidUuid(relatedId) ? relatedId.trim() : null;
    const sanitizedLink = link ? link.trim() : (deriveNotificationLink(type) || null);

    try {
      const { data, error } = await supabase.rpc('create_notification', {
        p_recipient_id: recipientId.trim(),
        p_type: type.trim(),
        p_title: title.trim(),
        p_message: message.trim(),
        p_link: sanitizedLink,
        p_related_id: sanitizedRelatedId
      });

      if (error) {
        console.error('NotificationService.createNotification RPC error:', error);
        throw new Error(this.formatServiceError(error, 'Failed to create notification.'));
      }

      if (!data) {
        return null;
      }

      return mapRowToNotification(data as DatabaseNotificationRow);
    } catch (err) {
      console.error('NotificationService.createNotification exception:', err);
      throw err;
    }
  }

  /**
   * 3. Marks a single notification as read in Supabase.
   * Governed by RLS and database trigger trg_enforce_notification_update_security.
   * Trigger auto-stamps read_at = NOW() and prevents tampering with identity/content fields.
   */
  public async markNotificationRead(
    notificationId: string,
    userId?: string
  ): Promise<Notification | null> {
    if (!isSupabaseConfigured || !notificationId) {
      return null;
    }

    try {
      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (userId && isValidUuid(userId)) {
        query = query.eq('recipient_id', userId);
      }

      const { data, error } = await query
        .select()
        .maybeSingle();

      if (error) {
        console.error(`NotificationService.markNotificationRead (${notificationId}) error:`, error);
        throw new Error(this.formatServiceError(error, 'Failed to mark notification as read.'));
      }

      return data ? mapRowToNotification(data as DatabaseNotificationRow) : null;
    } catch (err) {
      console.error('NotificationService.markNotificationRead exception:', err);
      throw err;
    }
  }

  /**
   * 4. Marks all notifications for the authenticated user as read in Supabase.
   * Updates only rows where recipient_id = userId and is_read = false.
   */
  public async markAllNotificationsRead(userId: string): Promise<void> {
    if (!isSupabaseConfigured || !userId) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error(`NotificationService.markAllNotificationsRead (${userId}) error:`, error);
        throw new Error(this.formatServiceError(error, 'Failed to mark all notifications as read.'));
      }
    } catch (err) {
      console.error('NotificationService.markAllNotificationsRead exception:', err);
      throw err;
    }
  }

  /**
   * 5. Subscribes to Supabase Realtime changes on public.notifications.
   * Filtered exclusively to the authenticated user's recipient_id.
   * Returns a cleanup unsubscribe function.
   */
  public subscribeToNotifications(
    userId: string,
    callback: (event: NotificationRealtimeEvent) => void
  ): () => void {
    if (!isSupabaseConfigured || !userId) {
      return () => {};
    }

    const channelName = `public:notifications:${userId}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          try {
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            const oldRecord = payload.old as Record<string, any> | undefined;
            const newRecord = payload.new as Record<string, any> | undefined;

            if (eventType === 'DELETE') {
              const deletedId = oldRecord?.id;
              if (deletedId) {
                callback({ eventType: 'DELETE', id: deletedId });
              }
              return;
            }

            if (newRecord) {
              // Defensive check to ensure notification belongs to user
              if (newRecord.recipient_id && newRecord.recipient_id !== userId) {
                return;
              }

              const notification = mapRowToNotification(newRecord as unknown as DatabaseNotificationRow);
              callback({
                eventType,
                notification,
                id: notification.id
              });
            }
          } catch (eventErr) {
            console.error('Error handling notification Realtime event:', eventErr);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.warn(`Notifications Realtime subscription status: ${status}`, err?.message || err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Formats error messages cleanly for end-user display.
   */
  private formatServiceError(error: any, fallback: string): string {
    if (!error) return fallback;

    const message = error.message || error.details || error.hint || '';

    if (message.includes('Authentication required')) {
      return 'You must be logged in to send notifications.';
    }
    if (message.includes('Recipient profile') && message.includes('not found')) {
      return 'Recipient profile not found in system.';
    }
    if (message.includes('Unknown notification type')) {
      return 'Invalid notification type.';
    }
    if (message.includes('immutable after creation')) {
      return 'Notification content cannot be altered after creation.';
    }
    if (message.includes('reverted from read to unread')) {
      return 'Read notifications cannot be marked unread.';
    }

    return message || fallback;
  }
}

export const notificationService = new NotificationService();

// Standalone functional exports
export const fetchNotifications = (userId?: string) => notificationService.fetchNotifications(userId);
export const createNotification = (input: CreateNotificationInput) => notificationService.createNotification(input);
export const markNotificationRead = (id: string, userId?: string) => notificationService.markNotificationRead(id, userId);
export const markAllNotificationsRead = (userId: string) => notificationService.markAllNotificationsRead(userId);
export const subscribeToNotifications = (userId: string, callback: (event: NotificationRealtimeEvent) => void) =>
  notificationService.subscribeToNotifications(userId, callback);
