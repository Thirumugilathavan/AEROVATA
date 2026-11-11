/**
 * AEROVATA Design Tokens & Telemetry Thresholds
 * Centralized design system constants, WCAG AA compliant colors,
 * telemetry status boundaries, and airspace styling rules.
 */

export const DESIGN_TOKENS = {
  // Brand & Accent Colors
  colors: {
    cyan: {
      glow: 'rgba(0, 240, 255, 0.4)',
      bright: '#00f0ff',
      primary: '#06b6d4',
      muted: '#0e7490',
      dark: '#164e63',
      surface: 'rgba(6, 182, 212, 0.12)',
    },
    amber: {
      bright: '#fbbf24',
      primary: '#f59e0b',
      dark: '#b45309',
      surface: 'rgba(245, 158, 11, 0.15)',
      frame: 'rgba(245, 158, 11, 0.35)',
    },
    emerald: {
      bright: '#34d399',
      primary: '#10b981',
      dark: '#047857',
      surface: 'rgba(16, 185, 129, 0.15)',
    },
    rose: {
      bright: '#f87171',
      primary: '#ef4444',
      dark: '#b91c1c',
      surface: 'rgba(239, 68, 68, 0.18)',
    },
    // Desaturated Slate/Grey for 3D Building Extrusions (Muted so route is visual focus)
    buildings: {
      base: '#1a2233',
      low: '#222d42',
      mid: '#2d3a52',
      high: '#3b4b66',
      landmark: '#334460',
      opacity: 0.62,
      nearRouteOpacity: 0.18,
    },
    // Backgrounds & Panels (Deep mission control palette with subtle blue undertone)
    surface: {
      canvas: '#070a12',
      panel: '#0c1220',
      panelTranslucent: 'rgba(12, 18, 32, 0.92)',
      card: '#111828',
      cardHover: '#172036',
      border: '#1f2d47',
      borderSubtle: '#18243b',
    },
    // WCAG AA Compliant Text Colors on Dark Backgrounds
    text: {
      primary: '#f8fafc',    // Contrast > 14:1
      secondary: '#cbd5e1',  // Contrast > 9:1
      muted: '#94a3b8',      // Contrast > 5.5:1 (meets AA requirement for 11px+)
      faint: '#64748b',      // Large elements / secondary labels
    },
  },

  // Typography Tokens
  typography: {
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    labels: {
      rail: '11px',
      badge: '11px',
      hud: '12px',
      telemetryValue: '14px',
      telemetryLarge: '16px',
    },
  },

  // Panel Styling & Radii
  panels: {
    borderRadius: '8px',
    backdropBlur: 'blur(12px)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
  },

  // Airspace Zone Styles
  airspace: {
    red: {
      fill: '#ef4444',
      fillOpacity: 0.18,
      border: '#dc2626',
      borderWidth: 2.5,
      label: 'RED ZONE · NO-FLY',
      badge: 'bg-rose-950/80 text-rose-300 border-rose-600',
    },
    yellow: {
      fill: '#facc15',
      fillOpacity: 0.16,
      border: '#eab308',
      borderWidth: 2.2,
      dasharray: [4, 2],
      label: 'YELLOW ZONE · ATC AUTH REQ',
      badge: 'bg-amber-950/80 text-amber-300 border-amber-600',
    },
    green: {
      fill: '#22c55e',
      fillOpacity: 0.12,
      border: '#16a34a',
      borderWidth: 1.8,
      label: 'GREEN ZONE · PERMITTED',
      badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-600',
    },
    unknown: {
      fill: '#94a3b8',
      fillOpacity: 0.14,
      border: '#64748b',
      borderWidth: 1.8,
      dasharray: [4, 3],
      label: 'UNMAPPED · ADVISORY HOLD',
      badge: 'bg-slate-900/80 text-slate-300 border-slate-600',
    },
  },
} as const;

// Telemetry Threshold Constants
export const TELEMETRY_THRESHOLDS = {
  battery: {
    good: 50,      // > 50% Green
    warning: 25,   // 25 - 50% Amber
    critical: 0,   // < 25% Red
  },
  altitude: {
    maxAgLMeters: 120, // DGCA statutory ceiling
    warningAglMeters: 105,
    minCruiseMeters: 20,
  },
  satellites: {
    excellent: 14,
    good: 10,
    poor: 6,
  },
  linkRssi: {
    excellent: -65,
    good: -80,
    poor: -95,
  },
  proximityWarningDistanceMeters: 40,
} as const;

/**
 * Returns WCAG-compliant status color class for battery percentage
 */
export function getBatteryStatusColor(percentage: number): {
  textClass: string;
  badgeClass: string;
  hex: string;
  level: 'good' | 'warning' | 'critical';
} {
  if (percentage > TELEMETRY_THRESHOLDS.battery.good) {
    return {
      textClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600',
      hex: DESIGN_TOKENS.colors.emerald.bright,
      level: 'good',
    };
  }
  if (percentage > TELEMETRY_THRESHOLDS.battery.warning) {
    return {
      textClass: 'text-amber-400',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600',
      hex: DESIGN_TOKENS.colors.amber.bright,
      level: 'warning',
    };
  }
  return {
    textClass: 'text-rose-400',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-600',
    hex: DESIGN_TOKENS.colors.rose.bright,
    level: 'critical',
  };
}

/**
 * Returns color info for RTB status
 */
export function getRtbStatusColor(status?: string): {
  textClass: string;
  badgeClass: string;
  label: string;
} {
  switch (status) {
    case 'SUFFICIENT':
      return {
        textClass: 'text-emerald-400',
        badgeClass: 'bg-emerald-950/70 border-emerald-600 text-emerald-300',
        label: 'SUFFICIENT',
      };
    case 'MARGINAL':
      return {
        textClass: 'text-amber-400',
        badgeClass: 'bg-amber-950/70 border-amber-600 text-amber-300',
        label: 'MARGINAL',
      };
    case 'CRITICAL':
    case 'INSUFFICIENT':
      return {
        textClass: 'text-rose-400',
        badgeClass: 'bg-rose-950/70 border-rose-600 text-rose-300',
        label: 'CRITICAL',
      };
    default:
      return {
        textClass: 'text-slate-300',
        badgeClass: 'bg-slate-900 border-slate-700 text-slate-300',
        label: status || 'NOMINAL',
      };
  }
}

/**
 * Returns link / GPS quality formatting
 */
export function getGpsFixFormatting(fix?: string, sats?: number): {
  textClass: string;
  label: string;
  isHighQuality: boolean;
} {
  const satCount = sats ?? 16;
  if (fix === 'RTK_FIX' || satCount >= TELEMETRY_THRESHOLDS.satellites.excellent) {
    return {
      textClass: 'text-emerald-400',
      label: `${satCount} SATS · RTK FIX`,
      isHighQuality: true,
    };
  }
  if (fix === '3D_FIX' || satCount >= TELEMETRY_THRESHOLDS.satellites.good) {
    return {
      textClass: 'text-amber-400',
      label: `${satCount} SATS · 3D DGPS`,
      isHighQuality: true,
    };
  }
  return {
    textClass: 'text-rose-400',
    label: `${satCount} SATS · SEARCHING`,
    isHighQuality: false,
  };
}
