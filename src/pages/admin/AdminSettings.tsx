import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Loader2, Save, ShieldCheck, Mail, CreditCard, Tag, Trash2, Plus, Power } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { discountService, DiscountRule, DiscountRuleType, DiscountValueType } from '@/services/discountService';
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

async function fetchAppSettings(): Promise<AppSetting[]> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
}

const RULE_TYPE_LABELS: Record<DiscountRuleType, string> = {
    first_time_user: 'First-time user',
    area: 'Area',
    combo: 'Combo',
};

function OffersTab() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [ruleType, setRuleType] = useState<DiscountRuleType>('first_time_user');
    const [locationContains, setLocationContains] = useState('');
    const [listingIdsCsv, setListingIdsCsv] = useState('');
    const [minNights, setMinNights] = useState('');
    const [discountType, setDiscountType] = useState<DiscountValueType>('percentage');
    const [discountValue, setDiscountValue] = useState('');

    const rulesQuery = useQuery({ queryKey: ['discount-rules'], queryFn: () => discountService.list() });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discount-rules'] });

    const createMutation = useMutation({
        mutationFn: async () => {
            const value = Number(discountValue);
            if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a discount value greater than 0.');

            const conditions: Record<string, unknown> = {};
            if (ruleType === 'area') {
                if (!locationContains.trim()) throw new Error('Enter the area to match.');
                conditions.location_contains = locationContains.trim();
            } else if (ruleType === 'combo') {
                if (listingIdsCsv.trim()) conditions.listing_ids = listingIdsCsv.split(',').map(s => s.trim()).filter(Boolean);
                if (minNights.trim()) conditions.min_nights = Number(minNights);
                if (!conditions.listing_ids && !conditions.min_nights) {
                    throw new Error('Enter listing IDs and/or a minimum nights condition for a combo rule.');
                }
            }

            await discountService.create({
                name,
                rule_type: ruleType,
                conditions,
                discount_type: discountType,
                discount_value: value,
                active_from: null,
                active_until: null,
                is_active: true,
            });
        },
        onSuccess: () => {
            toast({ title: 'Offer created' });
            setName('');
            setLocationContains('');
            setListingIdsCsv('');
            setMinNights('');
            setDiscountValue('');
            invalidate();
        },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not create offer.'), variant: 'destructive' }),
    });

    const toggleMutation = useMutation({
        mutationFn: (rule: DiscountRule) => discountService.setActive(rule.id, !rule.is_active),
        onSuccess: invalidate,
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not update offer.'), variant: 'destructive' }),
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => discountService.remove(id),
        onSuccess: invalidate,
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not remove offer.'), variant: 'destructive' }),
    });

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>New offer</CardTitle>
                    <CardDescription>
                        Only the single largest matching offer applies to a booking - offers never stack.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome discount" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Applies to</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={ruleType}
                                onChange={(e) => setRuleType(e.target.value as DiscountRuleType)}
                            >
                                {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Discount type</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value as DiscountValueType)}
                            >
                                <option value="percentage">Percentage</option>
                                <option value="flat_amount">Flat amount (₹)</option>
                            </select>
                        </div>
                    </div>

                    {ruleType === 'area' && (
                        <div>
                            <Label>Area (matches listing location)</Label>
                            <Input value={locationContains} onChange={(e) => setLocationContains(e.target.value)} placeholder="e.g. Goa" />
                        </div>
                    )}

                    {ruleType === 'combo' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Listing IDs (comma-separated, optional)</Label>
                                <Input value={listingIdsCsv} onChange={(e) => setListingIdsCsv(e.target.value)} placeholder="uuid, uuid" />
                            </div>
                            <div>
                                <Label>Minimum nights (optional)</Label>
                                <Input type="number" min="1" value={minNights} onChange={(e) => setMinNights(e.target.value)} />
                            </div>
                        </div>
                    )}

                    <div>
                        <Label>{discountType === 'percentage' ? 'Percentage off' : 'Amount off (₹)'}</Label>
                        <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                    </div>

                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={!name.trim() || !discountValue.trim() || createMutation.isPending}
                        className="gap-2"
                    >
                        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create offer
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing offers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {rulesQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                    {rulesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No offers yet.</p>}
                    {rulesQuery.data?.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between border rounded-md px-4 py-3">
                            <div>
                                <p className="font-medium flex items-center gap-2">
                                    {rule.name}
                                    {!rule.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {RULE_TYPE_LABELS[rule.rule_type]} &middot; {rule.discount_type === 'percentage' ? `${rule.discount_value}%` : `₹${rule.discount_value}`} off
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => toggleMutation.mutate(rule)}>
                                    <Power className="h-4 w-4" />
                                    {rule.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive gap-2" onClick={() => removeMutation.mutate(rule.id)}>
                                    <Trash2 className="h-4 w-4" /> Remove
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export default function AdminSettings() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [settings, setSettings] = useState<AppSetting[]>([]);

    const settingsQuery = useQuery({
        queryKey: ['admin-settings'],
        queryFn: fetchAppSettings,
        // Admin access is already enforced by <ProtectedRoute requiredRole="admin">
        // (backed by the DB `role` column + RLS) - this just needs to wait for
        // auth to resolve before loading the settings.
        enabled: !authLoading && !!user,
    });

    // Keep the editable settings list in sync whenever fresh data comes back
    // from the server (initial load). Edits made via handleUpdateSetting below
    // are local-only until saveSettingsMutation persists them.
    useEffect(() => {
        if (settingsQuery.data) {
            setSettings(settingsQuery.data);
        }
    }, [settingsQuery.data]);

    useEffect(() => {
        if (settingsQuery.error) {
            console.error('Error fetching settings:', settingsQuery.error);
            toast({
                title: 'Error',
                description: 'Failed to load settings',
                variant: 'destructive',
            });
        }
    }, [settingsQuery.error, toast]);

    const handleUpdateSetting = (key: string, value: string) => {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    };

    const handleToggleSetting = (key: string, enabled: boolean) => {
        handleUpdateSetting(key, enabled.toString());
    };

    const saveSettingsMutation = useMutation({
        mutationFn: async (category: string) => {
            const categorySettings = settings.filter(s => s.category === category);

            for (const setting of categorySettings) {
                // Trimmed here so a stray copy-pasted space/newline (a common
                // mistake when pasting Razorpay keys) never makes it into the
                // stored value in the first place.
                const { error } = await supabase.rpc('update_app_setting', {
                    p_key: setting.key,
                    p_value: setting.value.trim()
                });
                if (error) throw error;
            }

            return category;
        },
        onSuccess: (category) => {
            toast({
                title: 'Settings Saved',
                description: `${category.toUpperCase()} settings updated successfully.`,
            });
        },
        onError: (error: unknown) => {
            console.error('Error saving settings:', error);
            toast({
                title: 'Error',
                description: getErrorMessage(error, 'Failed to save settings'),
                variant: 'destructive',
            });
        },
    });

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

    // Auth is resolved and we have a user - `enabled` above is guaranteed true
    // by this point, so `isPending` will actually resolve instead of staying
    // true forever the way it would for a permanently-disabled query.
    if (settingsQuery.isPending) {
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
                        <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide">System Settings</h1>
                        <p className="text-text-secondary mt-1">Manage payment gateways and server configurations</p>
                    </div>
                    <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
                        Back to Dashboard
                    </Button>
                </div>

                <Tabs defaultValue="razorpay" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="razorpay" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> Razorpay
                        </TabsTrigger>
                        <TabsTrigger value="smtp" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Email (SMTP)
                        </TabsTrigger>
                        <TabsTrigger value="offers" className="flex items-center gap-2">
                            <Tag className="h-4 w-4" /> Offers
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
                                        onClick={() => saveSettingsMutation.mutate('razorpay')}
                                        disabled={saveSettingsMutation.isPending}
                                    >
                                        {saveSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
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
                                        onClick={() => saveSettingsMutation.mutate('smtp')}
                                        disabled={saveSettingsMutation.isPending}
                                    >
                                        {saveSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save SMTP Settings
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="offers">
                        <OffersTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
