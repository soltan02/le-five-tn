// A stadium "photo". If the owner set a real image URL we show it; otherwise a
// crisp pitch illustration (tinted turf + white markings) stands in so the app
// looks complete before real photos are uploaded.
export default function PitchPhoto({ pitch, height = 108, radius = 14, rounded = "all" }) {
  const br =
    rounded === "top" ? `${radius}px ${radius}px 0 0` : `${radius}px`;
  if (pitch.image) {
    return (
      <div style={{ height, borderRadius: br, overflow: "hidden" }}>
        <img src={pitch.image} alt={pitch.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  const tint = pitch.tint || "#166b3c";
  return (
    <div style={{ height, borderRadius: br, overflow: "hidden", position: "relative", background: `linear-gradient(160deg, ${tint}, #0a2c1a)` }}>
      {/* mowing stripes */}
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 22px, rgba(0,0,0,.05) 22px 44px)",
      }} />
      {/* pitch markings */}
      <svg viewBox="0 0 200 110" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.4">
          <rect x="6" y="6" width="188" height="98" rx="2" />
          <line x1="100" y1="6" x2="100" y2="104" />
          <circle cx="100" cy="55" r="17" />
          <rect x="6" y="30" width="26" height="50" />
          <rect x="168" y="30" width="26" height="50" />
        </g>
      </svg>
    </div>
  );
}
