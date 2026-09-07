import { ImageResponse } from "next/og";
import { CrestSvg } from "@/components/ui/crest";

/**
 * The iPad/iPhone home-screen icon. Rendered from the same crest as the rest of the app, on a
 * solid ground because iOS gives home-screen icons no background of their own.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <CrestSvg width={148} height={148} />
      </div>
    ),
    size,
  );
}
