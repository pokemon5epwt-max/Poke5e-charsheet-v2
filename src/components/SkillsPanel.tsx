import { Search } from 'lucide-react';
import { useState } from 'react';
import {
  AbilityScores,
  SkillName,
  SkillProficiencies,
  SkillProficiencyLevel,
} from '../types/pokemon5e';
import {
  ABILITY_LABELS,
  ALL_SKILLS,
  SKILL_ABILITY_MAP,
  formatSignedModifier,
  getSkillModifier,
} from '../utils/pokemon5eRules';

interface SkillsPanelProps {
  abilities: AbilityScores;
  skills: SkillProficiencies;
  profBonus: number;
  isEditing: boolean;
  onCycleSkillProf: (skill: SkillName) => void;
  onRollSkill: (skill: SkillName) => void;
}

const PROF_LABEL: Record<SkillProficiencyLevel, string> = {
  none: '—',
  proficient: 'Prof',
  expertise: 'Exp',
};

export function SkillsPanel({
  abilities,
  skills,
  profBonus,
  isEditing,
  onCycleSkillProf,
  onRollSkill,
}: SkillsPanelProps) {
  const [query, setQuery] = useState('');

  const filtered = ALL_SKILLS.filter((skill) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const ab = ABILITY_LABELS[SKILL_ABILITY_MAP[skill]].short.toLowerCase();
    return skill.toLowerCase().includes(q) || ab.includes(q);
  });

  return (
    <section className="gba-panel p-3.5 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div>
          <h3 className="font-display text-xs font-bold text-slate-200 uppercase">
            Skills
          </h3>
          <p className="text-xs text-slate-400">
            {isEditing
              ? 'Tap Prof/Exp square to cycle proficiency'
              : 'Tap any skill row to roll check'}
          </p>
        </div>

        <div className="relative w-full sm:w-44">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter skills..."
            aria-label="Filter skills"
            className="gba-well pl-8 pr-3 py-2 sm:py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-1.5">
        {filtered.map((skill) => {
          const abilityKey = SKILL_ABILITY_MAP[skill];
          const profState = skills[skill] ?? 'none';
          const mod = getSkillModifier(abilities, skills, skill, profBonus);

          return (
            <div
              key={skill}
              className="gba-well flex items-center justify-between gap-2 px-2.5 py-2.5 sm:py-2 hover:bg-[#1A232E] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => (isEditing ? onCycleSkillProf(skill) : onRollSkill(skill))}
                  title={
                    isEditing
                      ? 'Cycle None / Proficient / Expertise'
                      : `Roll ${skill}`
                  }
                  className={`px-1.5 py-1 sm:py-0.5 font-mono text-[9px] font-bold border border-[#090D12] shrink-0 cursor-pointer ${
                    profState === 'expertise'
                      ? 'bg-[#F6C445] text-[#090D12]'
                      : profState === 'proficient'
                        ? 'bg-[#267347] text-white'
                        : 'bg-[#18212B] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {PROF_LABEL[profState]}
                </button>
                <button
                  type="button"
                  onClick={() => onRollSkill(skill)}
                  className="text-left min-w-0 flex-1 flex items-center gap-1.5 cursor-pointer truncate"
                >
                  <span className="text-xs text-slate-100 truncate hover:text-white">
                    {skill}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    ({ABILITY_LABELS[abilityKey].short})
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onRollSkill(skill)}
                className="gba-btn font-mono text-[11px] font-bold text-white bg-[#232F3E] hover:bg-[#2F3F52] px-2.5 py-1 sm:py-0.5 shrink-0 cursor-pointer"
              >
                {formatSignedModifier(mod)}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
