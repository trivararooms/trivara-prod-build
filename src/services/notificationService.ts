import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  emailBookingUpdates: boolean;
  emailMessages: boolean;
  emailMarketing: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailBookingUpdates: true,
  emailMessages: true,
  emailMarketing: false,
};

class NotificationService {
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return DEFAULT_PREFERENCES;
    }
    if (!data) return DEFAULT_PREFERENCES;

    return {
      emailBookingUpdates: data.email_booking_updates,
      emailMessages: data.email_messages,
      emailMarketing: data.email_marketing,
    };
  }

  async updatePreferences(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: userId,
      email_booking_updates: preferences.emailBookingUpdates,
      email_messages: preferences.emailMessages,
      email_marketing: preferences.emailMarketing,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}

export const notificationService = new NotificationService();
