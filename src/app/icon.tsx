import { ImageResponse } from "next/og";
import { absoluteAssetUrl, getRequestBranding } from "@/lib/branding/request-branding";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * The browser-tab icon, resolved per subscriber organization.
 *
 * This used to draw a slate square with the letter J for everybody. JAG is the
 * platform; the organization in the tab should be the one whose door the
 * visitor came through, which is what `favicon_url` on the branding config has
 * always been for — it was collected by /dashboard/admin/branding and read by
 * nothing.
 *
 * DYNAMIC BY CONSTRUCTION. Next statically optimizes icon routes unless they
 * touch a request-time API; `getRequestBranding()` reads `headers()`, which is
 * what makes this per-request. Do not remove that call expecting the host
 * lookup to survive — without it this route is generated once at build time
 * and every tenant gets whichever organization built last.
 *
 * Three outcomes, in order: the organization's own favicon image; failing
 * that, its monogram on its primary colour; failing that, the JAG mark. The
 * last is correct for a host that belongs to no subscriber.
 */
export default async function Icon() {
  const { branding, host } = await getRequestBranding();
  const favicon = branding?.faviconUrl ? absoluteAssetUrl(branding.faviconUrl, host) : null;

  if (favicon) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          <img src={favicon} width={size.width} height={size.height} alt="" />
        </div>
      ),
      { ...size }
    );
  }

  const background = branding?.primaryColor?.trim() || "#0F172A";
  const monogram = branding?.monogram?.trim() || "J";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
          color: "#F8FAFC",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.5,
        }}
      >
        {monogram}
      </div>
    ),
    { ...size }
  );
}
