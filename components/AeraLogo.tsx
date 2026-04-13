export default function AeraLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="inline-flex items-start relative">
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500,
          letterSpacing: "-0.04em",
          fontSize: size,
          lineHeight: 1,
        }}
        className="text-white"
      >
        Aera
      </span>

      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.12,
          height: size * 0.12,
          backgroundColor: "#F5A623",
          top: size * 0.12,
          right: size * -0.06,
        }}
      />
    </div>
  )
}