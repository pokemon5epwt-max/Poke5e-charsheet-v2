export function PokedexLens({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 shrink-0" aria-hidden="true">
      {/* 16x16 Pixel-Art Pokédex Cyan Sensor */}
      <svg
        viewBox="0 0 16 16"
        className={`${className} pixel-art`}
        shapeRendering="crispEdges"
        fill="none"
      >
        {/* Outer White/Silver Pixel Ring */}
        <rect x="4" y="1" width="8" height="1" fill="#090D12" />
        <rect x="2" y="2" width="2" height="1" fill="#090D12" />
        <rect x="12" y="2" width="2" height="1" fill="#090D12" />
        <rect x="1" y="4" width="1" height="8" fill="#090D12" />
        <rect x="14" y="4" width="1" height="8" fill="#090D12" />
        <rect x="2" y="13" width="2" height="1" fill="#090D12" />
        <rect x="12" y="13" width="2" height="1" fill="#090D12" />
        <rect x="4" y="14" width="8" height="1" fill="#090D12" />

        <rect x="4" y="2" width="8" height="12" fill="#E2E8F0" />
        <rect x="2" y="4" width="12" height="8" fill="#E2E8F0" />
        <rect x="3" y="3" width="10" height="10" fill="#E2E8F0" />

        {/* Inner Dark Rim */}
        <rect x="5" y="3" width="6" height="10" fill="#0F172A" />
        <rect x="3" y="5" width="10" height="6" fill="#0F172A" />
        <rect x="4" y="4" width="8" height="8" fill="#0F172A" />

        {/* Cyan Lens Body */}
        <rect x="5" y="4" width="6" height="8" fill="#0284C7" />
        <rect x="4" y="5" width="8" height="6" fill="#0284C7" />
        <rect x="5" y="5" width="5" height="5" fill="#38BDF8" />
        {/* Specular Pixel Glint */}
        <rect x="5" y="5" width="2" height="2" fill="#E0F2FE" />
        <rect x="7" y="5" width="1" height="1" fill="#BAE6FD" />
        <rect x="9" y="9" width="2" height="2" fill="#0369A1" />
      </svg>

      {/* Classic GBA Pokédex Square Pixel LEDs */}
      <div className="hidden sm:flex items-center gap-1">
        <span className="w-2 h-2 bg-[#EF4444] border border-[#090D12]" />
        <span className="w-2 h-2 bg-[#FACC15] border border-[#090D12]" />
        <span className="w-2 h-2 bg-[#38D46A] border border-[#090D12]" />
      </div>
    </div>
  );
}

export type BallVariant = 'poke' | 'great' | 'ultra' | 'fainted';

export function PokeballIcon({
  variant = 'poke',
  className = 'w-5 h-5',
}: {
  variant?: BallVariant;
  className?: string;
}) {
  const topMain =
    variant === 'great'
      ? '#2563EB'
      : variant === 'ultra'
        ? '#27303D'
        : variant === 'fainted'
          ? '#475569'
          : '#E63946';

  const topShade =
    variant === 'great'
      ? '#1D4ED8'
      : variant === 'ultra'
        ? '#181E27'
        : variant === 'fainted'
          ? '#334155'
          : '#B91C1C';

  const bottomMain = variant === 'fainted' ? '#334155' : '#F8FAFC';
  const bottomShade = variant === 'fainted' ? '#1E293B' : '#CBD5E1';

  return (
    <svg
      viewBox="0 0 16 16"
      className={`${className} pixel-art`}
      shapeRendering="crispEdges"
      fill="none"
      aria-hidden="true"
    >
      {/* Black Pixel Outline */}
      <rect x="5" y="1" width="6" height="1" fill="#090D12" />
      <rect x="3" y="2" width="2" height="1" fill="#090D12" />
      <rect x="11" y="2" width="2" height="1" fill="#090D12" />
      <rect x="2" y="3" width="1" height="2" fill="#090D12" />
      <rect x="13" y="3" width="1" height="2" fill="#090D12" />
      <rect x="1" y="5" width="1" height="6" fill="#090D12" />
      <rect x="14" y="5" width="1" height="6" fill="#090D12" />
      <rect x="2" y="11" width="1" height="2" fill="#090D12" />
      <rect x="13" y="11" width="1" height="2" fill="#090D12" />
      <rect x="3" y="13" width="2" height="1" fill="#090D12" />
      <rect x="11" y="13" width="2" height="1" fill="#090D12" />
      <rect x="5" y="14" width="6" height="1" fill="#090D12" />

      {/* Top Hemisphere */}
      <rect x="5" y="2" width="6" height="1" fill={topMain} />
      <rect x="3" y="3" width="10" height="2" fill={topMain} />
      <rect x="2" y="5" width="12" height="2" fill={topMain} />
      <rect x="11" y="5" width="3" height="2" fill={topShade} />
      {/* Pixel Highlight */}
      <rect x="4" y="3" width="2" height="2" fill="#FFFFFF" fillOpacity="0.35" />

      {/* Great Ball Red Stripes */}
      {variant === 'great' && (
        <>
          <rect x="3" y="4" width="2" height="2" fill="#EF4444" />
          <rect x="11" y="4" width="2" height="2" fill="#EF4444" />
        </>
      )}

      {/* Ultra Ball Gold H-Stripe */}
      {variant === 'ultra' && (
        <>
          <rect x="5" y="2" width="6" height="1" fill="#FACC15" />
          <rect x="4" y="3" width="2" height="3" fill="#FACC15" />
          <rect x="10" y="3" width="2" height="3" fill="#FACC15" />
        </>
      )}

      {/* Center Black Band */}
      <rect x="2" y="7" width="12" height="2" fill="#090D12" />

      {/* Bottom Hemisphere */}
      <rect x="2" y="9" width="12" height="2" fill={bottomMain} />
      <rect x="3" y="11" width="10" height="2" fill={bottomMain} />
      <rect x="5" y="13" width="6" height="1" fill={bottomShade} />
      <rect x="11" y="11" width="2" height="2" fill={bottomShade} />

      {/* Center Button */}
      <rect x="6" y="6" width="4" height="4" fill="#090D12" />
      <rect
        x="7"
        y="7"
        width="2"
        height="2"
        fill={variant === 'fainted' ? '#64748B' : '#FFFFFF'}
      />
    </svg>
  );
}

export function LeagueBadgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${className} pixel-art`}
      shapeRendering="crispEdges"
      fill="none"
      aria-hidden="true"
    >
      <rect x="5" y="1" width="2" height="1" fill="#FDE047" />
      <rect x="3" y="2" width="6" height="2" fill="#FACC15" />
      <rect x="2" y="4" width="8" height="4" fill="#EAB308" />
      <rect x="4" y="4" width="4" height="4" fill="#FEF08A" />
      <rect x="3" y="8" width="6" height="2" fill="#CA8A04" />
      <rect x="5" y="10" width="2" height="1" fill="#A16207" />
    </svg>
  );
}

export function PixelCursor({ className = 'w-2.5 h-2.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 8 8"
      className={`${className} pixel-art shrink-0`}
      shapeRendering="crispEdges"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="2" height="6" fill="currentColor" />
      <rect x="3" y="2" width="2" height="4" fill="currentColor" />
      <rect x="5" y="3" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

export function PokeballBackdrop({
  colorHex = '#E63946',
}: {
  colorHex?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-36 h-36 pointer-events-none select-none opacity-[0.11] pixel-art"
      shapeRendering="crispEdges"
      fill="none"
      aria-hidden="true"
    >
      {/* Stepped Pixel Pokéball Watermark Silhouette */}
      <rect x="8" y="2" width="8" height="2" fill={colorHex} />
      <rect x="5" y="4" width="3" height="2" fill={colorHex} />
      <rect x="16" y="4" width="3" height="2" fill={colorHex} />
      <rect x="3" y="6" width="2" height="3" fill={colorHex} />
      <rect x="19" y="6" width="2" height="3" fill={colorHex} />
      <rect x="2" y="9" width="2" height="6" fill={colorHex} />
      <rect x="20" y="9" width="2" height="6" fill={colorHex} />
      <rect x="3" y="15" width="2" height="3" fill={colorHex} />
      <rect x="19" y="15" width="2" height="3" fill={colorHex} />
      <rect x="5" y="18" width="3" height="2" fill={colorHex} />
      <rect x="16" y="18" width="3" height="2" fill={colorHex} />
      <rect x="8" y="20" width="8" height="2" fill={colorHex} />
      {/* Center Band */}
      <rect x="4" y="11" width="5" height="2" fill={colorHex} />
      <rect x="15" y="11" width="5" height="2" fill={colorHex} />
      {/* Center Ring */}
      <rect x="10" y="9" width="4" height="1" fill={colorHex} />
      <rect x="9" y="10" width="1" height="4" fill={colorHex} />
      <rect x="14" y="10" width="1" height="4" fill={colorHex} />
      <rect x="10" y="14" width="4" height="1" fill={colorHex} />
      <rect x="11" y="11" width="2" height="2" fill={colorHex} />
    </svg>
  );
}
