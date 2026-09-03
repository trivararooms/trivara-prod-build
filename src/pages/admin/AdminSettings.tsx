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
import { Loader2, Save, ShieldCheck, Mail, CreditCard, Users, Tag, Trash2, Plus, Power, Percent, Star, Search as SearchIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { adminAccessService } from '@/services/adminAccessService';
import { discountService, DiscountRule, DiscountRuleType, DiscountValueType } from '@/services/discountService';
import { commissionService, CommissionTier, OverrideScope } from '@/services/commissionService';
import { listingService } from '@/services/listingService';
import { Listing } from '@/types';
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

function FeaturedTab() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [maxSlots, setMaxSlots] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Listing[]>([]);
    const [searching, setSearching] = useState(false);

    const capQuery = useQuery({
        queryKey: ['featured-cap'],
        queryFn: async () => {
            const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'featured_stays_max_slots').single();
            if (error) throw error;
            return data?.value || '25';
        },
    });

    const featuredQuery = useQuery({ queryKey: ['featured-listings'], queryFn: () => listingService.getAllFeatured() });

    useEffect(() => {
        if (capQuery.data) setMaxSlots(capQuery.data);
    }, [capQuery.data]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['featured-listings'] });
        queryClient.invalidateQueries({ queryKey: ['featured-cap'] });
    };

    const saveCapMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('update_app_setting', { p_key: 'featured_stays_max_slots', p_value: maxSlots.trim() });
            if (error) throw error;
        },
        onSuccess: () => { toast({ title: 'Slot limit saved' }); invalidate(); },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not save the slot limit.'), variant: 'destructive' }),
    });

    const featureMutation = useMutation({
        mutationFn: (listing: Listing) => listingService.setFeatured(listing.id, true),
        onSuccess: () => { toast({ title: 'Listing featured' }); setQuery(''); setResults([]); invalidate(); },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not feature this listing.'), variant: 'destructive' }),
    });

    const unfeatureMutation = useMutation({
        mutationFn: (listing: Listing) => listingService.setFeatured(listing.id, false),
        onSuccess: invalidate,
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not remove this listing.'), variant: 'destructive' }),
    });

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            setResults(await listingService.searchByTitle(query.trim()));
        } catch (error) {
            toast({ title: 'Error', description: getErrorMessage(error, 'Search failed.'), variant: 'destructive' });
        } finally {
            setSearching(false);
        }
    };

    const usedSlots = featuredQuery.data?.length ?? 0;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Slot limit</CardTitle>
                    <CardDescription>The maximum number of listings that can be featured on the home page at once.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-3">
                    <div>
                        <Label>Max featured slots</Label>
                        <Input type="number" min="1" value={maxSlots} onChange={(e) => setMaxSlots(e.target.value)} className="w-32" />
                    </div>
                    <Button onClick={() => saveCapMutation.mutate()} disabled={saveCapMutation.isPending} className="gap-2">
                        {saveCapMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </Button>
                    <p className="text-sm text-muted-foreground pb-2">{usedSlots} / {capQuery.data ?? '25'} slots used</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Feature a listing</CardTitle>
                    <CardDescription>Search by title, then add it to Featured Stays.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search listings by title..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button variant="outline" onClick={handleSearch} disabled={searching} className="gap-2">
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                        </Button>
                    </div>
                    {results.length > 0 && (
                        <div className="space-y-2">
                            {results.map((listing) => (
                                <div key={listing.id} className="flex items-center justify-between border rounded-md px-4 py-2">
                                    <span className="text-sm">{listing.title}</span>
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        disabled={listing.isFeatured || featureMutation.isPending}
                                        onClick={() => featureMutation.mutate(listing)}
                                    >
                                        <Star className="h-4 w-4" />
                                        {listing.isFeatured ? 'Already featured' : 'Feature'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Currently featured</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {featuredQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                    {featuredQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No featured listings yet.</p>}
                    {featuredQuery.data?.map((listing) => (
                        <div key={listing.id} className="flex items-center justify-between border rounded-md px-4 py-2">
                            <span className="text-sm">{listing.title}</span>
                            <Button variant="ghost" size="sm" className="text-destructive gap-2" onClick={() => unfeatureMutation.mutate(listing)}>
                                <Trash2 className="h-4 w-4" /> Remove
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function CommissionTab() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [tiers, setTiers] = useState<CommissionTier[] | null>(null);
    const [overrideScope, setOverrideScope] = useState<OverrideScope>('host');
    const [overrideKey, setOverrideKey] = useState('');
    const [overrideRate, setOverrideRate] = useState('');

    const tiersQuery = useQuery({ queryKey: ['commission-tiers'], queryFn: () => commissionService.getTiers() });
    const overridesQuery = useQuery({ queryKey: ['commission-overrides'], queryFn: () => commissionService.getOverrides() });

    useEffect(() => {
        if (tiersQuery.data) setTiers(tiersQuery.data);
    }, [tiersQuery.data]);

    const saveTiersMutation = useMutation({
        mutationFn: () => commissionService.saveTiers(tiers || []),
        onSuccess: () => toast({ title: 'Commission tiers saved' }),
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not save tiers.'), variant: 'destructive' }),
    });

    const addOverrideMutation = useMutation({
        mutationFn: async () => {
            const rate = Number(overrideRate);
            if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
                throw new Error('Enter a commission rate between 0 and 100.');
            }
            const scopeId = overrideScope === 'host'
                ? await commissionService.findHostIdByEmail(overrideKey.trim())
                : await commissionService.findListingIdByTitle(overrideKey.trim());
            if (!scopeId) {
                throw new Error(overrideScope === 'host' ? 'No host found with that email.' : 'No listing found with that title.');
            }
            await commissionService.setOverride(overrideScope, scopeId, rate);
        },
        onSuccess: () => {
            toast({ title: 'Override saved' });
            setOverrideKey('');
            setOverrideRate('');
            queryClient.invalidateQueries({ queryKey: ['commission-overrides'] });
        },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not save override.'), variant: 'destructive' }),
    });

    const removeOverrideMutation = useMutation({
        mutationFn: (id: string) => commissionService.removeOverride(id),
        onSuccess: () => {
            toast({ title: 'Override removed' });
            queryClient.invalidateQueries({ queryKey: ['commission-overrides'] });
        },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not remove override.'), variant: 'destructive' }),
    });

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Default revenue tiers</CardTitle>
                    <CardDescription>
                        A host's commission defaults to whichever tier their trailing 30-day revenue reaches, unless a
                        host or property override below applies.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {tiersQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                    {tiers?.map((tier, idx) => (
                        <div key={tier.tier_order} className="grid grid-cols-3 gap-4 items-end">
                            <div className="text-sm font-medium pb-2">Tier {tier.tier_order}</div>
                            <div>
                                <Label>Min. monthly revenue (₹)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={tier.min_monthly_revenue}
                                    onChange={(e) => setTiers(prev => prev!.map((t, i) => i === idx ? { ...t, min_monthly_revenue: Number(e.target.value) } : t))}
                                />
                            </div>
                            <div>
                                <Label>Commission rate (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={tier.commission_rate}
                                    onChange={(e) => setTiers(prev => prev!.map((t, i) => i === idx ? { ...t, commission_rate: Number(e.target.value) } : t))}
                                />
                            </div>
                        </div>
                    ))}
                    <Button onClick={() => saveTiersMutation.mutate()} disabled={saveTiersMutation.isPending || !tiers} className="gap-2">
                        {saveTiersMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save tiers
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Overrides</CardTitle>
                    <CardDescription>Set a fixed commission rate for a specific host or property, overriding the tiers above.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <Label>Scope</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={overrideScope}
                                onChange={(e) => setOverrideScope(e.target.value as OverrideScope)}
                            >
                                <option value="host">Host (by email)</option>
                                <option value="property">Property (by listing title)</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Label>{overrideScope === 'host' ? 'Host email' : 'Listing title'}</Label>
                            <Input value={overrideKey} onChange={(e) => setOverrideKey(e.target.value)} />
                        </div>
                        <div className="w-32">
                            <Label>Rate (%)</Label>
                            <Input type="number" min="0" max="100" value={overrideRate} onChange={(e) => setOverrideRate(e.target.value)} />
                        </div>
                        <Button
                            onClick={() => addOverrideMutation.mutate()}
                            disabled={!overrideKey.trim() || !overrideRate.trim() || addOverrideMutation.isPending}
                            className="gap-2"
                        >
                            {addOverrideMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Set override
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {overridesQuery.data?.map((o) => (
                            <div key={o.id} className="flex items-center justify-between border rounded-md px-4 py-2 text-sm">
                                <span>{o.scope_type === 'host' ? 'Host' : 'Property'} {o.scope_id} — {o.commission_rate}%</span>
                                <Button variant="ghost" size="sm" onClick={() => removeOverrideMutation.mutate(o.id)} className="text-destructive gap-2">
                                    <Trash2 className="h-4 w-4" /> Remove
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ManageAdminsTab() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState('');

    const opsAdminsQuery = useQuery({
        queryKey: ['ops-admins'],
        queryFn: () => adminAccessService.listOpsAdmins(),
    });

    const grantMutation = useMutation({
        mutationFn: (e: string) => adminAccessService.grant(e),
        onSuccess: () => {
            toast({ title: 'Access granted', description: `${email} can now approve payouts and view platform stats.` });
            setEmail('');
            queryClient.invalidateQueries({ queryKey: ['ops-admins'] });
        },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not grant access.'), variant: 'destructive' }),
    });

    const revokeMutation = useMutation({
        mutationFn: (e: string) => adminAccessService.revoke(e),
        onSuccess: () => {
            toast({ title: 'Access revoked' });
            queryClient.invalidateQueries({ queryKey: ['ops-admins'] });
        },
        onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not revoke access.'), variant: 'destructive' }),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Delegated admins</CardTitle>
                <CardDescription>
                    Grant an email platform stats, live activity, payout approve/reject/request-on-behalf, and refunds —
                    without full admin access (commission, offers, and admin management stay main-admin only).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-2">
                    <Input
                        type="email"
                        placeholder="teammate@trivara.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button
                        onClick={() => grantMutation.mutate(email)}
                        disabled={!email.trim() || grantMutation.isPending}
                        className="gap-2 whitespace-nowrap"
                    >
                        {grantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Grant access
                    </Button>
                </div>

                {opsAdminsQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-accent" />}

                {opsAdminsQuery.data && opsAdminsQuery.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">No delegated admins yet.</p>
                )}

                <div className="space-y-2">
                    {opsAdminsQuery.data?.map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between border rounded-md px-4 py-3">
                            <div>
                                <p className="font-medium">{profile.full_name || profile.email}</p>
                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                                onClick={() => revokeMutation.mutate(profile.email)}
                                disabled={revokeMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                                Revoke
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
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
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="razorpay" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> Razorpay
                        </TabsTrigger>
                        <TabsTrigger value="smtp" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Email (SMTP)
                        </TabsTrigger>
                        <TabsTrigger value="featured" className="flex items-center gap-2">
                            <Star className="h-4 w-4" /> Featured
                        </TabsTrigger>
                        <TabsTrigger value="commission" className="flex items-center gap-2">
                            <Percent className="h-4 w-4" /> Commission
                        </TabsTrigger>
                        <TabsTrigger value="offers" className="flex items-center gap-2">
                            <Tag className="h-4 w-4" /> Offers
                        </TabsTrigger>
                        <TabsTrigger value="admins" className="flex items-center gap-2">
                            <Users className="h-4 w-4" /> Admins
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

                    <TabsContent value="featured">
                        <FeaturedTab />
                    </TabsContent>

                    <TabsContent value="commission">
                        <CommissionTab />
                    </TabsContent>

                    <TabsContent value="offers">
                        <OffersTab />
                    </TabsContent>

                    <TabsContent value="admins">
                        <ManageAdminsTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
