export const tokens = {
  color: {
    // Surfaces
    bgCanvas: '#FFFFFF',
    bgSubtle: '#F7F7F8',
    bgMuted: '#EFEFF1',
    bgInverse: '#0A0A0A',

    // Text
    textPrimary: '#0A0A0A',
    textSecondary: '#5A5A60',
    textMuted: '#9A9AA0',
    textInverse: '#FFFFFF',

    // Borders
    borderDefault: '#E5E5E8',
    borderStrong: '#0A0A0A',

    // State
    accentFocus: '#0A0A0A',
    accentSuccess: '#16A34A',
    accentWarning: '#D97706',
    accentDanger: '#DC2626',
  },
  shadow: {
    card: '0 2px 8px rgba(10, 10, 10, 0.04), 0 1px 2px rgba(10, 10, 10, 0.06)',
    raised: '0 8px 24px rgba(10, 10, 10, 0.08), 0 2px 4px rgba(10, 10, 10, 0.04)',
    panel: '0 16px 48px rgba(10, 10, 10, 0.10)',
  },
  radius: {
    none: '0px',
    sm: '6px',
    md: '10px',
    lg: '16px',
    pill: '9999px',
  },
  font: {
    sans: '"Nunito", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", Consolas, monospace',
  },
  spacing: {
    xs: '4px', sm: '8px', md: '12px', lg: '16px',
    xl: '24px', '2xl': '32px', '3xl': '48px',
  },
} as const;
