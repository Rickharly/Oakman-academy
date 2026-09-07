import { ImageResponse } from "next/og";
import { CrestSvg } from "@/components/ui/crest";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <CrestSvg width={150} height={150} />
      </div>
    ),
    size,
  );
}
