import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { Loader2, Save, ShieldCheck, Mail, CreditCard } from 'lucide-react';
// NOTE: this page used to also gate on isAdminEmail(user.email) (a hardcoded-
// email check) inside the effect below. That check could disagree with the
// DB-backed `role === 'admin'` check that <ProtectedRoute requiredRole="admin">
// already enforces upstream (App.tsx) - and when it did, the effect called
// navigate("/") without ever calling fetchSettings(), which never called
// setLoading(false), leaving this page stuck on its loading spinner forever
// instead of actually redirecting cleanly. Removed in favor of relying solely
// on ProtectedRoute + Postgres RLS, which is the real access control anyway.

interface AppSetting {
    key: string;
    value: string | null;
    category: string;
    description: string;
    is_secret: boolean;
}

export default function AdminSettings() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AppSetting[]>([]);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .order('category', { ascending: true });

            if (error) throw error;
            setSettings(data || []);
        } catch (error: unknown) {
            console.error('Error fetching settings:', error);
            toast({
                title: 'Error',
                description: 'Failed to load settings',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        // Admin access is already enforced by <ProtectedRoute requiredRole="admin">
        // (backed by the DB `role` column + RLS) - this effect just needs to
        // wait for auth to resolve, then load the settings.
        if (authLoading || !user) return;
        fetchSettings();
    }, [authLoading, user, fetchSettings]);

    const handleUpdateSetting = (key: string, value: string) => {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    };

    const handleToggleSetting = (key: string, enabled: boolean) => {
        handleUpdateSetting(key, enabled.toString());
    };

    const saveSettings = async (category: string) => {
        setSaving(true);
        try {
            const categorySettings = settings.filter(s => s.category === category);

            for (const setting of categorySettings) {
                const { error } = await supabase.rpc('update_app_setting', {
                    p_key: setting.key,
                    p_value: setting.value
                });
                if (error) throw error;
            }

            toast({
                title: 'Settings Saved',
                description: `${category.toUpperCase()} settings updated successfully.`,
            });
        } catch (error: unknown) {
            console.error('Error saving settings:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error, 'Failed to save settings'),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const renderSettingInput = (setting: AppSetting) => {
        if (setting.key.endsWith('_enabled')) {
            return (
                <div key={setting.key} className="flex items-center justify-between py-4 border-b last:border-0">
                    <div className="space-y-0.5">
                        <Label className="text-base">{setting.description}</Label>
                        <p className="text-sm text-muted-foreground">Toggle this feature on or off</p>
                    </div>
                    <Switch
                        checked={setting.value === 'true'}
                        onCheckedChange={(checked) => handleToggleSetting(setting.key, checked)}
                    />
                </div>
            );
        }

        return (
            <div key={setting.key} className="space-y-2 mb-4">
                <Label htmlFor={setting.key}>{setting.description}</Label>
                <Input
                    id={setting.key}
                    type={setting.is_secret ? "password" : "text"}
                    value={setting.value || ''}
                    placeholder={`Enter ${setting.description}`}
                    onChange={(e) => handleUpdateSetting(setting.key, e.target.value)}
                />
                {setting.is_secret && setting.value && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Encrypted and stored securely
                    </p>
                )}
            </div>
        );
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
            </div>
        );
    }

    const razorpaySettings = settings.filter(s => s.category === 'razorpay');
    const smtpSettings = settings.filter(s => s.category === 'smtp');

    return (
        <div className="min-h-screen bg-background pb-12">
            <Header />
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-medium">System Settings</h1>
                        <p className="text-text-secondary mt-1">Manage payment gateways and server configurations</p>
                    </div>
                    <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
                        Back to Dashboard
                    </Button>
                </div>

                <Tabs defaultValue="razorpay" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="razorpay" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> Razorpay
                        </TabsTrigger>
                        <TabsTrigger value="smtp" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Email (SMTP)
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="razorpay">
                        <Card>
                            <CardHeader>
                                <CardTitle>Razorpay Integration</CardTitle>
                                <CardDescription>
                                    Configure your Razorpay payment gateway credentials and environment.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {razorpaySettings.map(renderSettingInput)}
                                <div className="pt-4">
                                    <Button
                                        className="w-full sm:w-auto"
                                        onClick={() => saveSettings('razorpay')}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save Razorpay Settings
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="smtp">
                        <Card>
                            <CardHeader>
                                <CardTitle>SMTP Configuration</CardTitle>
                                <CardDescription>
                                    Configure your outgoing mail server for transactional emails.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {smtpSettings.map(renderSettingInput)}
                                <div className="pt-4">
                                    <Button
                                        className="w-full sm:w-auto"
                                        onClick={() => saveSettings('smtp')}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save SMTP Settings
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
