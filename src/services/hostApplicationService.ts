import { supabase } from '@/lib/supabase';

export type IdProofType = 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';
export type OwnershipProofType = 'property_tax_receipt' | 'sale_deed' | 'lease_agreement';
export type BankProofType = 'cancelled_cheque' | 'bank_statement';
export type HostApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface HostApplication {
  id: string;
  user_id: string;
  status: HostApplicationStatus;
  legal_name: string;
  pan_path: string;
  id_proof_type: IdProofType;
  id_proof_path: string;
  ownership_proof_type: OwnershipProofType;
  ownership_proof_path: string;
  noc_path: string | null;
  bank_proof_type: BankProofType;
  bank_proof_path: string;
  gst_number: string | null;
  gst_certificate_path: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface SubmitHostApplicationInput {
  legal_name: string;
  pan_file: File;
  id_proof_type: IdProofType;
  id_proof_file: File;
  ownership_proof_type: OwnershipProofType;
  ownership_proof_file: File;
  noc_file?: File;
  bank_proof_type: BankProofType;
  bank_proof_file: File;
  gst_number?: string;
  gst_certificate_file?: File;
}

const BUCKET = 'host-verification-docs';

export class HostApplicationService {
  private async uploadDoc(userId: string, docType: string, file: File): Promise<string> {
    const path = `${userId}/${docType}-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) throw error;
    return data.path;
  }

  /** Latest application for the current user, or null if they've never applied. */
  async getMine(userId: string): Promise<HostApplication | null> {
    const { data, error } = await supabase
      .from('host_applications')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async submit(userId: string, input: SubmitHostApplicationInput): Promise<HostApplication> {
    if (input.ownership_proof_type === 'lease_agreement' && !input.noc_file) {
      throw new Error('An NOC from the property owner is required for a leased property.');
    }

    const [pan_path, id_proof_path, ownership_proof_path, bank_proof_path] = await Promise.all([
      this.uploadDoc(userId, 'pan', input.pan_file),
      this.uploadDoc(userId, 'id-proof', input.id_proof_file),
      this.uploadDoc(userId, 'ownership-proof', input.ownership_proof_file),
      this.uploadDoc(userId, 'bank-proof', input.bank_proof_file),
    ]);
    const noc_path = input.noc_file ? await this.uploadDoc(userId, 'noc', input.noc_file) : null;
    const gst_certificate_path = input.gst_certificate_file
      ? await this.uploadDoc(userId, 'gst-certificate', input.gst_certificate_file)
      : null;

    const { data, error } = await supabase
      .from('host_applications')
      .insert({
        user_id: userId,
        legal_name: input.legal_name,
        pan_path,
        id_proof_type: input.id_proof_type,
        id_proof_path,
        ownership_proof_type: input.ownership_proof_type,
        ownership_proof_path,
        noc_path,
        bank_proof_type: input.bank_proof_type,
        bank_proof_path,
        gst_number: input.gst_number || null,
        gst_certificate_path,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Admin-only: every application awaiting review, oldest first. */
  async listPending(): Promise<HostApplication[]> {
    const { data, error } = await supabase
      .from('host_applications')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /** Admin-only: a short-lived signed URL to view/download one uploaded document. */
  async getDocUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }

  async approve(applicationId: string): Promise<HostApplication> {
    const { data, error } = await supabase.rpc('approve_host_application', { p_application_id: applicationId });
    if (error) throw error;
    return data;
  }

  async reject(applicationId: string, reason: string): Promise<HostApplication> {
    const { data, error } = await supabase.rpc('reject_host_application', {
      p_application_id: applicationId,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  }
}

export const hostApplicationService = new HostApplicationService();
