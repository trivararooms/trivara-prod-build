import { formatINR } from '@/lib/utils';
import { AppliedDiscount } from '@/services/discountService';

export interface PricingBreakdownData {
  nights: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  total: number;
}

interface PricingBreakdownProps {
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  pricing: PricingBreakdownData;
  appliedDiscount: AppliedDiscount | null;
}

/** Subtotal / cleaning fee / service fee / discount / total block shown once dates are selected. */
export function PricingBreakdown({ pricePerNight, cleaningFee, serviceFee, pricing, appliedDiscount }: PricingBreakdownProps) {
  return (
    <div className="mb-6 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-text-secondary">
          {formatINR(pricePerNight)} × {pricing.nights} nights
        </span>
        <span className="text-foreground">{formatINR(pricing.subtotal)}</span>
      </div>
      {cleaningFee > 0 && (
        <div className="flex justify-between">
          <span className="text-text-secondary">Cleaning fee</span>
          <span className="text-foreground">{formatINR(cleaningFee)}</span>
        </div>
      )}
      {serviceFee > 0 && (
        <div className="flex justify-between">
          <span className="text-text-secondary">Service fee</span>
          <span className="text-foreground">{formatINR(serviceFee)}</span>
        </div>
      )}
      {appliedDiscount && (
        <div className="flex justify-between">
          <span className="text-accent">{appliedDiscount.name}</span>
          <span className="text-accent">-{formatINR(appliedDiscount.amount)}</span>
        </div>
      )}
      <hr className="border-border my-2" />
      <div className="flex justify-between items-baseline font-pillar font-bold uppercase tracking-wide text-base">
        <span className="text-foreground">Total</span>
        <span className="text-accent">
          {formatINR(appliedDiscount ? pricing.total - appliedDiscount.amount : pricing.total)}
        </span>
      </div>
    </div>
  );
}
