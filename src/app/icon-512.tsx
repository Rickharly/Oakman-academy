import { ImageResponse } from "next/og";
import { CrestSvg } from "@/components/ui/crest";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <CrestSvg width={400} height={400} />
      </div>
    ),
    size,
  );
}
