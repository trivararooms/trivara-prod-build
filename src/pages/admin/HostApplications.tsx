import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { hostApplicationService, HostApplication } from '@/services/hostApplicationService';

const DOC_LABELS: { key: keyof HostApplication; label: string }[] = [
  { key: 'pan_path', label: 'PAN card' },
  { key: 'id_proof_path', label: 'ID proof' },
  { key: 'ownership_proof_path', label: 'Ownership proof' },
  { key: 'noc_path', label: 'Owner NOC' },
  { key: 'bank_proof_path', label: 'Bank proof' },
  { key: 'gst_certificate_path', label: 'GST certificate' },
];

function DocLink({ path, label }: { path: string; label: string }) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const url = await hostApplicationService.getDocUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Could not open document.'), variant: 'destructive' });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={open} disabled={opening} className="gap-2">
      {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

function ApplicationCard({ application }: { application: HostApplication }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['host-applications-pending'] });

  const approveMutation = useMutation({
    mutationFn: () => hostApplicationService.approve(application.id),
    onSuccess: () => {
      toast({ title: 'Application approved', description: `${application.legal_name} is now an approved host.` });
      invalidate();
    },
    onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not approve.'), variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (r: string) => hostApplicationService.reject(application.id, r),
    onSuccess: () => {
      toast({ title: 'Application rejected' });
      invalidate();
    },
    onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not reject.'), variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{application.legal_name}</CardTitle>
          <p className="text-xs text-text-secondary mt-1">
            Submitted {new Date(application.submitted_at).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">{application.ownership_proof_type.replace(/_/g, ' ')}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {application.gst_number && (
          <p className="text-sm text-text-secondary">GST: {application.gst_number}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {DOC_LABELS.map(({ key, label }) => {
            const path = application[key];
            return typeof path === 'string' && path ? <DocLink key={key} path={path} label={label} /> : null;
          })}
        </div>

        {!rejecting ? (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="trivara-btn-primary gap-2"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-2" onClick={() => setRejecting(true)}>
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <Textarea
              placeholder="Reason for rejection (shown to the applicant)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={!reason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(reason)}
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm rejection'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HostApplications() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['host-applications-pending'],
    queryFn: () => hostApplicationService.listPending(),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide mb-8">Host applications</h1>

        {isLoading && (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
        )}

        {!isLoading && applications?.length === 0 && (
          <p className="text-text-secondary">No applications waiting for review.</p>
        )}

        <div className="space-y-4">
          {applications?.map((app) => <ApplicationCard key={app.id} application={app} />)}
        </div>
      </div>
    </div>
  );
}
