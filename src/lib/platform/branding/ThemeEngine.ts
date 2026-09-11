/**
 * Sprint 211 — Brand → CSS theme generation for dark executive shell.
 */

import type { CSSProperties } from "react";
import { recordBrandObservation } from "./BrandObservability";
import { LogoService } from "./LogoService";
import { TypographyService } from "./TypographyService";
import {
  POWERED_BY_LINE,
  type BrandTheme,
  type OrganizationBrand,
} from "./types";

export type BrandTailwindTokens = {
  readonly brandPrimary: string;
  readonly brandSecondary: string;
  readonly brandAccent: string;
  readonly brandSuccess: string;
  readonly brandWarning: string;
  readonly brandDanger: string;
  readonly jagBg: string;
  readonly jagPanel: string;
  readonly jagText: string;
  readonly jagMuted: string;
  readonly jagBorder: string;
};

export type BrandWebManifest = {
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: readonly { readonly src: string; readonly sizes: string; readonly type: string }[];
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function mixToward(
  hex: string,
  toward: { r: number; g: number; b: number },
  amount: number
): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(rgb.r + (toward.r - rgb.r) * t);
  const g = Math.round(rgb.g + (toward.g - rgb.g) * t);
  const b = Math.round(rgb.b + (toward.b - rgb.b) * t);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Map brand palette onto a dark executive shell (pure; no observability). */
export function buildTheme(brand: OrganizationBrand): BrandTheme {
  const fonts = TypographyService.resolveFonts(brand);
  const primary = brand.primary_color || "#0F172A";
  const secondary = brand.secondary_color || "#1E293B";
  const accent = brand.accent_color || "#0D9488";

  // Shell surfaces stay dark; lift primary toward black for bg, lighten for panel.
  const jagBg = "#000000";
  const jagPanel = mixToward(secondary, { r: 255, g: 255, b: 255 }, 0.06);
  const jagBorder = mixToward(secondary, { r: 255, g: 255, b: 255 }, 0.14);
  const jagText = "#F8FAFC";
  const jagMuted = "#94A3B8";

  const pageTitle = `${brand.display_name} Executive Intelligence Platform`;
  const poweredBy = brand.powered_by_enabled ? POWERED_BY_LINE : null;

  return {
    cssVariables: {
      "--brand-primary": primary,
      "--brand-secondary": secondary,
      "--brand-accent": accent,
      "--brand-success": brand.success_color || "#059669",
      "--brand-warning": brand.warning_color || "#D97706",
      "--brand-danger": brand.danger_color || "#DC2626",
      "--brand-heading-font": `"${fonts.heading}", Georgia, "Times New Roman", serif`,
      "--brand-body-font": `"${fonts.body}", "Segoe UI", system-ui, -apple-system, sans-serif`,
      "--jag-bg": jagBg,
      "--jag-panel": jagPanel,
      "--jag-text": jagText,
      "--jag-muted": jagMuted,
      "--jag-border": jagBorder,
      "--brand-login-bg": brand.login_background_url
        ? `url("${brand.login_background_url}")`
        : jagBg,
      "--brand-dashboard-bg": brand.dashboard_background_url
        ? `url("${brand.dashboard_background_url}")`
        : jagBg,
    },
    metadata: {
      title: pageTitle,
      description: poweredBy
        ? `${pageTitle}. ${poweredBy}`
        : pageTitle,
      poweredBy,
    },
    icons: {
      lightLogo: LogoService.getLightLogo(brand),
      darkLogo: LogoService.getDarkLogo(brand),
      favicon: LogoService.getFavicon(brand),
      appIcon: LogoService.getAppIcon(brand),
    },
  };
}

/** Map brand palette onto a dark executive shell (records theme_generation). */
export function generateTheme(brand: OrganizationBrand): BrandTheme {
  const theme = buildTheme(brand);
  recordBrandObservation({
    kind: "theme_generation",
    organizationId: brand.organization_id,
    detail: `Generated theme for ${brand.display_name}`,
  });
  return theme;
}

/** React `style` prop from generated CSS variables (no page refresh needed). */
export function themeToStyle(theme: BrandTheme): CSSProperties {
  return theme.cssVariables as CSSProperties;
}

/** Tailwind-friendly token map derived from the same theme. */
export function themeToTailwindTokens(theme: BrandTheme): BrandTailwindTokens {
  const v = theme.cssVariables;
  return {
    brandPrimary: v["--brand-primary"] ?? "#0F172A",
    brandSecondary: v["--brand-secondary"] ?? "#1E293B",
    brandAccent: v["--brand-accent"] ?? "#0D9488",
    brandSuccess: v["--brand-success"] ?? "#059669",
    brandWarning: v["--brand-warning"] ?? "#D97706",
    brandDanger: v["--brand-danger"] ?? "#DC2626",
    jagBg: v["--jag-bg"] ?? "#0F172A",
    jagPanel: v["--jag-panel"] ?? "#1E293B",
    jagText: v["--jag-text"] ?? "#F8FAFC",
    jagMuted: v["--jag-muted"] ?? "#94A3B8",
    jagBorder: v["--jag-border"] ?? "#334155",
  };
}

/** Web app manifest fragment for tenant install / icons. */
export function themeToManifest(
  brand: OrganizationBrand,
  theme: BrandTheme
): BrandWebManifest {
  const icons: {
    src: string;
    sizes: string;
    type: string;
  }[] = [];
  if (theme.icons.appIcon) {
    icons.push({
      src: theme.icons.appIcon,
      sizes: "192x192",
      type: "image/png",
    });
  }
  if (theme.icons.favicon) {
    icons.push({
      src: theme.icons.favicon,
      sizes: "32x32",
      type: "image/png",
    });
  }
  return {
    name: theme.metadata.title,
    short_name: brand.display_name,
    description: theme.metadata.description,
    theme_color: brand.primary_color,
    background_color: theme.cssVariables["--jag-bg"] ?? brand.primary_color,
    icons,
  };
}

export const ThemeEngine = {
  buildTheme,
  generateTheme,
  themeToStyle,
  themeToTailwindTokens,
  themeToManifest,
};
