import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background:
            "radial-gradient(circle at 20% 20%, #162039 0%, #0d111c 45%, #090c13 100%)",
          color: "#e5e7eb",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 4, color: "#67e8f9" }}>
          INSIDE JS
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, marginTop: 16 }}>
          JavaScript Runtime Visualizer
        </div>
        <div style={{ fontSize: 30, marginTop: 18, color: "#a5b4fc" }}>
          Call Stack • Event Loop • Memory • Async Queues
        </div>
      </div>
    ),
    size,
  );
}
