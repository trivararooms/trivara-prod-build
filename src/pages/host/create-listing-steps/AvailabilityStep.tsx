import { CalendarDays } from 'lucide-react';

export function AvailabilityStep() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Set availability</h2>
        <p className="text-text-secondary">You can update your calendar after publishing</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <CalendarDays className="h-12 w-12 mx-auto mb-4 text-text-secondary" />
        <p className="text-text-secondary">Calendar management will be available after publishing</p>
      </div>
    </div>
  );
}
