import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Clock, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import {
  hostApplicationService,
  HostApplication,
  IdProofType,
  OwnershipProofType,
  BankProofType,
} from '@/services/hostApplicationService';

const ID_PROOF_OPTIONS: { value: IdProofType; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'passport', label: 'Passport' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_license', label: 'Driving license' },
];

const OWNERSHIP_OPTIONS: { value: OwnershipProofType; label: string; hint: string }[] = [
  { value: 'property_tax_receipt', label: 'Property tax receipt', hint: 'You own the property' },
  { value: 'sale_deed', label: 'Sale deed', hint: 'You own the property' },
  { value: 'lease_agreement', label: 'Lease / rent agreement', hint: 'You lease the property — an owner NOC is also required' },
];

const BANK_PROOF_OPTIONS: { value: BankProofType; label: string }[] = [
  { value: 'cancelled_cheque', label: 'Cancelled cheque' },
  { value: 'bank_statement', label: 'Bank statement' },
];

function StatusScreen({ application, onReapply }: { application: HostApplication; onReapply: () => void }) {
  if (application.status === 'pending') {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Clock className="mx-auto mb-4 h-12 w-12 text-accent" />
        <h1 className="text-2xl font-medium mb-2">Application under review</h1>
        <p className="text-text-secondary">
          You submitted your host application on {new Date(application.submitted_at).toLocaleDateString()}.
          We'll email you once it's been reviewed.
        </p>
      </div>
    );
  }

  if (application.status === 'approved') {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-accent" />
        <h1 className="text-2xl font-medium mb-2">You're an approved host</h1>
        <p className="text-text-secondary mb-6">You can now create and publish listings.</p>
        <Button className="trivara-btn-primary" onClick={() => (window.location.href = '/host/listings/new')}>
          Create your first listing
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-medium mb-2">Application not approved</h1>
      <p className="text-text-secondary mb-6">
        {application.rejection_reason || 'Your application did not meet our requirements.'}
      </p>
      <Button className="trivara-btn-primary" onClick={onReapply}>
        Submit a new application
      </Button>
    </div>
  );
}

export default function HostApplicationPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [existing, setExisting] = useState<HostApplication | null | 'loading'>('loading');
  const [forceNewForm, setForceNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [legalName, setLegalName] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [idProofType, setIdProofType] = useState<IdProofType>('aadhaar');
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [ownershipType, setOwnershipType] = useState<OwnershipProofType>('property_tax_receipt');
  const [ownershipFile, setOwnershipFile] = useState<File | null>(null);
  const [nocFile, setNocFile] = useState<File | null>(null);
  const [bankProofType, setBankProofType] = useState<BankProofType>('cancelled_cheque');
  const [bankProofFile, setBankProofFile] = useState<File | null>(null);
  const [isGstRegistered, setIsGstRegistered] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [gstFile, setGstFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    hostApplicationService
      .getMine(user.id)
      .then(setExisting)
      .catch((error) => {
        toast({ title: 'Error', description: getErrorMessage(error, 'Could not load your application.'), variant: 'destructive' });
        setExisting(null);
      });
  }, [user, toast]);

  if (authLoading || existing === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.is_host) return <Navigate to="/host/dashboard" replace />;

  const showStatusScreen = existing && existing !== 'loading' && existing.status !== 'rejected' && !forceNewForm;
  const showRejectedScreen = existing && existing !== 'loading' && existing.status === 'rejected' && !forceNewForm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panFile || !idProofFile || !ownershipFile || !bankProofFile) {
      toast({ title: 'Missing documents', description: 'Please upload every required document.', variant: 'destructive' });
      return;
    }
    if (ownershipType === 'lease_agreement' && !nocFile) {
      toast({ title: 'Missing NOC', description: 'A leased property needs an owner NOC.', variant: 'destructive' });
      return;
    }
    if (isGstRegistered && (!gstNumber.trim() || !gstFile)) {
      toast({ title: 'Missing GST details', description: 'Provide both your GST number and certificate, or uncheck GST registration.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const application = await hostApplicationService.submit(user.id, {
        legal_name: legalName,
        pan_file: panFile,
        id_proof_type: idProofType,
        id_proof_file: idProofFile,
        ownership_proof_type: ownershipType,
        ownership_proof_file: ownershipFile,
        noc_file: nocFile || undefined,
        bank_proof_type: bankProofType,
        bank_proof_file: bankProofFile,
        gst_number: isGstRegistered ? gstNumber : undefined,
        gst_certificate_file: isGstRegistered ? (gstFile || undefined) : undefined,
      });
      setExisting(application);
      setForceNewForm(false);
      toast({ title: 'Application submitted', description: "We'll review it and get back to you." });
    } catch (error) {
      toast({ title: 'Submission failed', description: getErrorMessage(error, 'Could not submit your application.'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl py-12">
        {showStatusScreen && <StatusScreen application={existing as HostApplication} onReapply={() => setForceNewForm(true)} />}
        {showRejectedScreen && <StatusScreen application={existing as HostApplication} onReapply={() => setForceNewForm(true)} />}

        {!showStatusScreen && !showRejectedScreen && (
          <>
            <h1 className="text-3xl font-display font-medium mb-2">Apply to become a host</h1>
            <p className="text-text-secondary mb-8">
              We ask for a few documents to verify your identity and your property before you can list it.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="legal-name">Legal name</Label>
                    <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
                  </div>
                  <FileField label="PAN card" file={panFile} onChange={setPanFile} />
                  <div>
                    <Label className="mb-2 block">ID proof</Label>
                    <RadioGroup value={idProofType} onValueChange={(v) => setIdProofType(v as IdProofType)} className="mb-3">
                      {ID_PROOF_OPTIONS.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <RadioGroupItem value={opt.value} id={`id-${opt.value}`} />
                          <Label htmlFor={`id-${opt.value}`} className="font-normal">{opt.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    <FileField file={idProofFile} onChange={setIdProofFile} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Property authorization</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={ownershipType} onValueChange={(v) => setOwnershipType(v as OwnershipProofType)} className="mb-3">
                    {OWNERSHIP_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-start gap-2">
                        <RadioGroupItem value={opt.value} id={`own-${opt.value}`} className="mt-1" />
                        <Label htmlFor={`own-${opt.value}`} className="font-normal">
                          {opt.label}
                          <span className="block text-xs text-text-secondary">{opt.hint}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <FileField file={ownershipFile} onChange={setOwnershipFile} />
                  {ownershipType === 'lease_agreement' && (
                    <FileField label="Owner NOC" file={nocFile} onChange={setNocFile} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Payout bank details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={bankProofType} onValueChange={(v) => setBankProofType(v as BankProofType)} className="mb-3">
                    {BANK_PROOF_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`bank-${opt.value}`} />
                        <Label htmlFor={`bank-${opt.value}`} className="font-normal">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <FileField file={bankProofFile} onChange={setBankProofFile} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">GST registration (optional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="gst-toggle" checked={isGstRegistered} onCheckedChange={(v) => setIsGstRegistered(v === true)} />
                    <Label htmlFor="gst-toggle" className="font-normal">I'm GST-registered</Label>
                  </div>
                  {isGstRegistered && (
                    <>
                      <div>
                        <Label htmlFor="gst-number">GST number</Label>
                        <Input id="gst-number" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                      </div>
                      <FileField label="GST certificate" file={gstFile} onChange={setGstFile} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Button type="submit" className="trivara-btn-primary w-full py-6" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit application'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function FileField({ label, file, onChange }: { label?: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      {label && <Label className="mb-2 block">{label}</Label>}
      <label className="flex items-center gap-2 text-sm border border-input rounded-md px-3 py-2 cursor-pointer hover:bg-surface-1">
        <Upload className="h-4 w-4 text-text-secondary" />
        <span className="text-text-secondary truncate">{file ? file.name : 'Choose a file (PDF or image)'}</span>
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}
