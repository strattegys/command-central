/**
 * Visible app name (sidebar, mobile header) and matches document title logic in layout.
 * DEV: local `next dev` (NODE_ENV=development), or set NEXT_PUBLIC_COMMAND_CENTRAL_DEV=1 on a hosted dev instance.
 */
export function getAppBrandTitle(): string {
  if (process.env.NEXT_PUBLIC_COMMAND_CENTRAL_DEV === "1") {
    return "Strattegys Command Central DEV";
  }
  if (process.env.NODE_ENV === "development") {
    return "Strattegys Command Central DEV";
  }
  return "Strattegys Command Central";
}

export function isDevAppBranding(): boolean {
  return getAppBrandTitle().endsWith(" DEV");
}
