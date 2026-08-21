import type { Operator, StatCondition, StatDefinition } from '../types/search'

const operatorOptions: {value: Operator; label: string}[] = [
  {value:'any', label:'Any'}, {value:'gte', label:'At least ≥'}, {value:'eq', label:'Exactly ='}, {value:'lte', label:'At most ≤'}, {value:'between', label:'Between'}
]

export function StatRow({ definition, condition, onChange }: { definition: StatDefinition; condition: StatCondition; onChange: (next: StatCondition) => void }) {
  const disabled = condition.operator === 'any'
  return (
    <div className="grid gap-3 border-b border-white/7 py-3 last:border-0 md:grid-cols-[1fr_170px_110px_110px] md:items-center">
      <div className="font-medium text-slate-200">{definition.label}</div>
      <select value={condition.operator} onChange={e => onChange({...condition, operator:e.target.value as Operator})} className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm outline-none focus:border-cyan-400/60">
        {operatorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input type="number" step="any" disabled={disabled} value={condition.value ?? ''} onChange={e => onChange({...condition, value:e.target.value === '' ? undefined : Number(e.target.value)})} placeholder="Value" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-35 focus:border-cyan-400/60" />
      <input type="number" step="any" disabled={condition.operator !== 'between'} value={condition.secondValue ?? ''} onChange={e => onChange({...condition, secondValue:e.target.value === '' ? undefined : Number(e.target.value)})} placeholder="Max" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-20 focus:border-cyan-400/60" />
    </div>
  )
}
