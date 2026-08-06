interface LogoProps {
  collapsed: boolean
  size?: number
}

export default function Logo({ collapsed, size = 28 }: LogoProps) {
  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-[#2563EB]"
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.45 }}>E</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-lg bg-[#2563EB] shrink-0"
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.45 }}>E</span>
      </div>
      <div>
        <p className="text-white font-bold text-sm leading-tight">Edupilot</p>
        <p className="text-accent font-semibold text-[10px] leading-tight tracking-wide">DZ</p>
      </div>
    </div>
  )
}
