import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { notificationService, NotificationPreferences } from '@/services/notificationService';
import { getErrorMessage } from '@/lib/errors';

const OPTIONS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: 'emailBookingUpdates',
    label: 'Booking updates',
    description: 'Confirmations, cancellations, and approval/decline emails for your bookings.',
  },
  {
    key: 'emailMessages',
    label: 'New messages',
    description: "Email me when I get a new message from a host or guest.",
  },
  {
    key: 'emailMarketing',
    label: 'Offers & updates',
    description: 'Occasional emails about new features, promotions, and travel inspiration.',
  },
];

/**
 * Real Notifications settings, backed by notification_preferences (see
 * 00000000000005_...migration) - the Account page used to show this
 * permanently disabled with a "Coming soon" badge. Booking-update emails
 * (sendBookingConfirmationEmail/sendBookingCancellationEmail) actually read
 * `emailBookingUpdates` before sending; `emailMessages`/`emailMarketing`
 * are stored for future use since there's no email-on-new-message or
 * marketing-email sender built yet - saving them here doesn't silently
 * do nothing forever, but nothing reads them yet either.
 */
export default function NotificationSettings() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailBookingUpdates: true,
    emailMessages: true,
    emailMarketing: false,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    notificationService.getPreferences(user.id).then((data) => {
      if (!cancelled) {
        setPrefs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await notificationService.updatePreferences(user.id, prefs);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Preferences saved' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Could not save preferences.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">Notifications</h1>
          <p className="text-text-secondary">Choose what Trivara emails you about</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Email notifications</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : (
              <>
                {OPTIONS.map((opt) => (
                  <div key={opt.key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-sm text-text-secondary">{opt.description}</p>
                    </div>
                    <Switch
                      checked={prefs[opt.key]}
                      onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [opt.key]: checked }))}
                    />
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="outline" onClick={() => navigate('/account')}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-hover">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
