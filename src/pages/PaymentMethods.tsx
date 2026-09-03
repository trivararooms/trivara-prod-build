import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface BankDetails {
  id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: ''
};

async function fetchBankDetails(hostId: string): Promise<BankDetails | null> {
  const { data, error } = await supabase
    .from('host_bank_accounts')
    .select('*')
    .eq('host_id', hostId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export default function PaymentMethods() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(emptyForm);

  const bankDetailsQuery = useQuery({
    queryKey: ['bank-details', user?.id],
    queryFn: () => fetchBankDetails(user!.id),
    enabled: !!user?.id,
  });

  // Keep the editable form in sync whenever fresh bank details come back
  // from the server (initial load, or after a successful save).
  useEffect(() => {
    const data = bankDetailsQuery.data;
    if (data) {
      setFormData({
        account_holder_name: data.account_holder_name ?? '',
        bank_name: data.bank_name ?? '',
        account_number: data.account_number ?? '',
        ifsc_code: data.ifsc_code ?? '',
      });
    }
  }, [bankDetailsQuery.data]);

  useEffect(() => {
    if (bankDetailsQuery.error) {
      console.error(bankDetailsQuery.error);
      toast({
        title: 'Error',
        description: 'Failed to load bank details',
        variant: 'destructive',
      });
    }
  }, [bankDetailsQuery.error, toast]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // First run a SELECT to check if a row exists
      const { data: existingRecord, error: selectError } = await supabase
        .from('host_bank_accounts')
        .select('id')
        .eq('host_id', user!.id)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      const payload = {
        account_holder_name: formData.account_holder_name.trim(),
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.trim(),
      };

      const result = existingRecord
        ? await supabase.from('host_bank_accounts').update(payload).eq('host_id', user!.id)
        : await supabase.from('host_bank_accounts').insert({ host_id: user!.id, ...payload });

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Bank details saved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['bank-details', user?.id] });
    },
    onError: (error: unknown) => {
      console.error('Error saving bank details:', error);
      toast({
        title: 'Error',
        description: 'Failed to save bank details. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // react-query's `isPending` stays true forever for a *disabled* query (i.e.
  // enabled: !!user?.id being false) - it never runs, so it never settles to
  // success/error. That's exactly the "stuck on the spinner forever" bug the
  // authLoading/!user checks above exist to avoid: by the time we reach this
  // check, `user` is guaranteed truthy, so the query is guaranteed enabled
  // and isPending will actually resolve once the fetch completes.
  if (bankDetailsQuery.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide text-foreground mb-2">
            Payout account
          </h1>
          <p className="text-text-secondary">
            Manage the bank account Trivara pays your host earnings into. This isn't where guests
            manage how they pay for bookings - that happens at checkout.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bank Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="account_holder_name" className="block text-sm font-medium text-text-secondary mb-2">
                    Account Holder Name
                  </label>
                  <Input
                    id="account_holder_name"
                    name="account_holder_name"
                    value={formData.account_holder_name}
                    onChange={handleChange}
                    placeholder="Enter account holder name"
                    required
                    className="trivara-input"
                  />
                </div>

                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-text-secondary mb-2">
                    Bank Name
                  </label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleChange}
                    placeholder="Enter bank name"
                    required
                    className="trivara-input"
                  />
                </div>

                <div>
                  <label htmlFor="account_number" className="block text-sm font-medium text-text-secondary mb-2">
                    Account Number
                  </label>
                  <Input
                    id="account_number"
                    name="account_number"
                    type="text"
                    value={formData.account_number}
                    onChange={handleChange}
                    placeholder="Enter account number"
                    required
                    className="trivara-input"
                  />
                </div>

                <div>
                  <label htmlFor="ifsc_code" className="block text-sm font-medium text-text-secondary mb-2">
                    IFSC Code
                  </label>
                  <Input
                    id="ifsc_code"
                    name="ifsc_code"
                    value={formData.ifsc_code}
                    onChange={handleChange}
                    placeholder="Enter IFSC code"
                    required
                    className="trivara-input"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="trivara-btn-primary"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Bank Details'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
