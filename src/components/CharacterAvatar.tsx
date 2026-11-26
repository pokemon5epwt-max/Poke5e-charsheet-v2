import { useEffect, useState } from 'react';
import { PokeballIcon } from './PokemonAccessories';

interface CharacterAvatarProps {
  src?: string;
  name: string;
  isPokemon?: boolean;
  isFainted?: boolean;
  accentHex?: string;
  className?: string;
  imgClassName?: string;
  fallbackTextClassName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function CharacterAvatar({
  src,
  name,
  isPokemon = false,
  isFainted = false,
  accentHex = '#38BDF8',
  className = 'w-10 h-10',
  imgClassName = 'w-full h-full object-cover object-top',
  fallbackTextClassName = 'text-xs',
}: CharacterAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanSrc = src?.trim();
  const showImage = Boolean(cleanSrc) && !hasError;

  return (
    <div
      style={
        !showImage
          ? {
              backgroundImage: `linear-gradient(145deg, ${accentHex}44 0%, #16202A 75%, #0F151C 100%)`,
            }
          : undefined
      }
      className={`relative overflow-hidden flex items-center justify-center bg-[#121922] select-none ${className}`}
    >
      {showImage ? (
        <img
          src={cleanSrc}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
          className={`${imgClassName} ${isFainted ? 'grayscale contrast-90 opacity-65' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full gap-0.5 text-slate-100">
          {isPokemon ? (
            <PokeballIcon
              variant={isFainted ? 'fainted' : 'poke'}
              className="w-1/2 h-1/2 max-w-[26px] max-h-[26px]"
            />
          ) : (
            <span
              className={`font-display font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${fallbackTextClassName}`}
            >
              {getInitials(name)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
