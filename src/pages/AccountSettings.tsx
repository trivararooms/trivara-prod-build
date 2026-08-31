import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { profileService } from '@/services/profileService';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';

/**
 * Real Account Settings - the Account page used to show this permanently
 * disabled with a "Coming soon" badge. Only edits the columns the profiles
 * table's UPDATE grant actually permits for a user's own row (first_name,
 * last_name, phone, avatar_url, bio) - see profileService.updateOwnProfile().
 */
export default function AccountSettings() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '', avatar_url: '' });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    profileService.getByUserId(user.id).then((profile) => {
      if (cancelled || !profile) return;
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
      });
      setLoading(false);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const path = `${user.id}-${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      setForm((prev) => ({ ...prev, avatar_url: publicUrl }));
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: getErrorMessage(error, 'Could not upload avatar.'), variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await profileService.updateOwnProfile(user.id, form);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Settings saved' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Could not save settings.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const initials = `${form.first_name[0] || ''}${form.last_name[0] || ''}`.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">Account settings</h1>
          <p className="text-text-secondary">Update your profile information</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={form.avatar_url} alt={form.first_name} />
                    <AvatarFallback className="bg-accent text-accent-foreground text-xl">{initials}</AvatarFallback>
                  </Avatar>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-surface-2 trivara-transition">
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Change photo
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">First name</label>
                    <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Last name</label>
                    <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Bio</label>
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell hosts and guests a bit about yourself"
                    className="min-h-24"
                  />
                </div>

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
