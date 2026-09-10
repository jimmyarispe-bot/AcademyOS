import { ImageResponse } from "next/og";
import { absoluteAssetUrl, getRequestBranding } from "@/lib/branding/request-branding";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home-screen icon, resolved per subscriber organization.
 *
 * Same contract as `icon.tsx` — see the reasoning there. This one matters for
 * anyone who saves JAG to a phone: a bookmark carrying the wrong school's mark
 * is the kind of small wrongness people notice every single day.
 */
export default async function AppleIcon() {
  const { branding, host } = await getRequestBranding();
  const favicon = branding?.faviconUrl ? absoluteAssetUrl(branding.faviconUrl, host) : null;

  if (favicon) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
          }}
        >
          <img src={favicon} width={156} height={156} alt="" />
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
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {monogram}
      </div>
    ),
    { ...size }
  );
}
