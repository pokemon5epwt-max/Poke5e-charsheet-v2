import { X } from 'lucide-react';
import { useState } from 'react';
import { useCharacterStore } from '../store/useCharacterStore';
import { PokemonType } from '../types/pokemon5e';
import {
  POKEMON_TYPES,
  createEmptySaves,
  createEmptySkills,
  createId,
} from '../utils/pokemon5eRules';

interface AddPokemonModalProps {
  onClose: () => void;
}

export function AddPokemonModal({ onClose }: AddPokemonModalProps) {
  const addPokemon = useCharacterStore((s) => s.addPokemon);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [level, setLevel] = useState(1);
  const [sr, setSr] = useState('1/2');
  const [primaryType, setPrimaryType] = useState<PokemonType>('Normal');
  const [secondaryType, setSecondaryType] = useState<PokemonType | ''>('');
  const [nature, setNature] = useState('Hardy');
  const [ability, setAbility] = useState('Run Away');
  const [hpMax, setHpMax] = useState(20);
  const [ac, setAc] = useState(13);
  const [speed, setSpeed] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSpecies = species.trim() || name.trim() || 'Eevee';
    const cleanName = name.trim() || cleanSpecies;
    const types: PokemonType[] =
      secondaryType && secondaryType !== primaryType
        ? [primaryType, secondaryType]
        : [primaryType];

    addPokemon({
      name: cleanName,
      species: cleanSpecies,
      level,
      sr,
      types,
      nature,
      ability,
      abilityDescription: '',
      hpCurrent: hpMax,
      hpMax,
      tempHp: 0,
      ac,
      speed,
      hitDice: `${level}d8`,
      abilities: { str: 12, dex: 14, con: 12, int: 8, wis: 10, cha: 12 },
      savingThrows: createEmptySaves(),
      skills: createEmptySkills(),
      moves: [
        {
          id: createId('mv'),
          name: 'Tackle',
          type: 'Normal',
          ppCurrent: 20,
          ppMax: 20,
          movePower: 'str',
          damageDice: '1d6',
          isAttack: true,
          stabEligible: true,
          range: 'Melee (5 ft)',
          castingTime: '1 Action',
          description: 'A full-body charge attack.',
        },
      ],
      heldItem: '',
      statusCondition: 'Healthy',
      notes: '',
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pokemon-title"
    >
      <form
        onSubmit={handleSubmit}
        className="gba-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]"
      >
        <div className="px-4 sm:px-5 py-3.5 bg-[#9E1E2A] border-b-2 border-[#090D12] flex items-center justify-between gap-2 shrink-0">
          <h2
            id="add-pokemon-title"
            className="font-display text-sm sm:text-base font-bold text-white uppercase tracking-tight"
          >
            Add Pokémon to Party
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Modal"
            className="gba-btn w-9 h-9 inline-flex items-center justify-center bg-[#1E2833] hover:bg-[#2A3746] text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nickname
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nimbus"
                className="gba-well w-full px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Species
              </label>
              <input
                type="text"
                required
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="e.g. Eevee"
                className="gba-well w-full px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Level
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) =>
                  setLevel(Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))))
                }
                className="gba-well w-full px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">SR</label>
              <input
                type="text"
                value={sr}
                onChange={(e) => setSr(e.target.value)}
                className="gba-well w-full px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Max HP
              </label>
              <input
                type="number"
                min={1}
                value={hpMax}
                onChange={(e) =>
                  setHpMax(Math.max(1, parseInt(e.target.value || '20', 10)))
                }
                className="gba-well w-full px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">AC</label>
              <input
                type="number"
                min={1}
                value={ac}
                onChange={(e) =>
                  setAc(Math.max(1, parseInt(e.target.value || '12', 10)))
                }
                className="gba-well w-full px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Primary Type
              </label>
              <select
                value={primaryType}
                onChange={(e) => setPrimaryType(e.target.value as PokemonType)}
                className="gba-well w-full px-3 py-2 text-xs text-white"
              >
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Secondary Type
              </label>
              <select
                value={secondaryType}
                onChange={(e) => setSecondaryType(e.target.value as PokemonType | '')}
                className="gba-well w-full px-3 py-2 text-xs text-white"
              >
                <option value="">None</option>
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nature
              </label>
              <input
                type="text"
                value={nature}
                onChange={(e) => setNature(e.target.value)}
                className="gba-well w-full px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ability
              </label>
              <input
                type="text"
                value={ability}
                onChange={(e) => setAbility(e.target.value)}
                className="gba-well w-full px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Speed (ft)
              </label>
              <input
                type="number"
                min={0}
                value={speed}
                onChange={(e) =>
                  setSpeed(Math.max(0, parseInt(e.target.value || '30', 10)))
                }
                className="gba-well w-full px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 border-t-2 border-[#090D12] bg-[#17202A] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="gba-btn px-4 min-h-[40px] sm:min-h-[36px] text-xs font-semibold text-slate-200 bg-[#1E2833] hover:bg-[#2A3746] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="gba-btn px-4 min-h-[40px] sm:min-h-[36px] text-xs font-semibold text-white bg-[#D62839] hover:bg-[#E63946] cursor-pointer"
          >
            Add Pokémon
          </button>
        </div>
      </form>
    </div>
  );
}
