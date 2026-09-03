import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteSettingsService, CONTENT_FONT_OPTIONS, textToRuns } from '@/services/siteSettingsService';

const FONT_CLASS = new Set<string>(CONTENT_FONT_OPTIONS);

interface EditableTextProps {
  /** app_settings key, e.g. "content_hero_heading" */
  settingKey: string;
  /** Used both as the initial render (before the query resolves) and as the value if nothing's been customized yet. */
  fallback: string;
  /** Wrapping element - carries the block's own typography (size/weight/align/etc), untouched by per-word overrides. */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders admin-editable, per-word-styleable text. Each word is its own
 * <span>; a word with no stored font/color override just inherits the
 * wrapping element's styling, so uncustomized content looks identical to a
 * plain hardcoded string. See AdminSettings.tsx's WordStyleEditor for the
 * editing side and 00000000000016_theme_and_content_settings.sql for the
 * seeded (initially NULL) settings this reads.
 */
export function EditableText({ settingKey, fallback, as = 'span', className, style }: EditableTextProps) {
  const { data: runs } = useQuery({
    queryKey: ['content', settingKey],
    queryFn: () => siteSettingsService.getContentRuns(settingKey, fallback),
  });

  const words = runs ?? textToRuns(fallback);
  const Tag = as as unknown as React.ElementType;

  return (
    <Tag className={className} style={style}>
      {words.map((run, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span
            className={run.font && FONT_CLASS.has(run.font) ? `font-${run.font}` : undefined}
            style={run.color ? { color: run.color } : undefined}
          >
            {run.text}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
