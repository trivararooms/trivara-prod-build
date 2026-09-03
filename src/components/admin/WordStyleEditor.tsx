import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { siteSettingsService, ContentRun, CONTENT_FONT_OPTIONS } from '@/services/siteSettingsService';

interface WordStyleEditorProps {
  /** app_settings key, e.g. "content_hero_heading" */
  settingKey: string;
  label: string;
  fallback: string;
}

/**
 * Lets an admin edit a piece of homepage copy word-by-word: change the text
 * itself, then give any individual word its own font and/or color. Backs
 * onto the same ContentRun[] JSON the public EditableText component reads
 * (src/components/content/EditableText.tsx).
 */
export function WordStyleEditor({ settingKey, label, fallback }: WordStyleEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [runs, setRuns] = useState<ContentRun[] | null>(null);

  const query = useQuery({
    queryKey: ['content', settingKey],
    queryFn: () => siteSettingsService.getContentRuns(settingKey, fallback),
  });

  // Only seed local state once, from whatever the server had - further
  // refetches (e.g. after save) shouldn't clobber in-progress edits.
  useEffect(() => {
    if (query.data && runs === null) setRuns(query.data);
  }, [query.data, runs]);

  const handleTextChange = (newText: string) => {
    const words = newText.split(/\s+/).filter(Boolean);
    setRuns((prev) =>
      words.map((w, i) => {
        const existing = prev?.[i];
        return existing && existing.text === w ? existing : { text: w, font: existing?.font ?? null, color: existing?.color ?? null };
      })
    );
  };

  const updateWord = (i: number, patch: Partial<ContentRun>) => {
    setRuns((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  };

  const saveMutation = useMutation({
    mutationFn: () => siteSettingsService.setContentRuns(settingKey, runs ?? []),
    onSuccess: () => {
      toast({ title: `${label} saved` });
      queryClient.invalidateQueries({ queryKey: ['content', settingKey] });
    },
    onError: (error) => toast({ title: 'Error', description: getErrorMessage(error, 'Could not save.'), variant: 'destructive' }),
  });

  if (runs === null) {
    return (
      <div className="py-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
      </div>
    );
  }

  const text = runs.map((r) => r.text).join(' ');

  return (
    <div className="space-y-3 border border-border rounded-md p-4">
      <Label>{label}</Label>
      <Input value={text} onChange={(e) => handleTextChange(e.target.value)} />

      <div className="flex flex-wrap gap-3">
        {runs.map((run, i) => (
          <div key={i} className="flex items-center gap-2 border border-border rounded-md px-2 py-1.5">
            <span className="text-sm">{run.text}</span>
            <select
              className="text-xs bg-surface-2 border border-border rounded px-1 py-0.5"
              value={run.font ?? ''}
              onChange={(e) => updateWord(i, { font: e.target.value || null })}
            >
              <option value="">Default font</option>
              {CONTENT_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <input
              type="color"
              aria-label={`Color for "${run.text}"`}
              className="h-6 w-8 border border-border rounded"
              value={run.color ?? '#f2ede3'}
              onChange={(e) => updateWord(i, { color: e.target.value })}
            />
            {(run.font || run.color) && (
              <button
                type="button"
                className="text-xs text-text-meta hover:text-foreground"
                onClick={() => updateWord(i, { font: null, color: null })}
              >
                Reset
              </button>
            )}
          </div>
        ))}
      </div>

      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </Button>
    </div>
  );
}
