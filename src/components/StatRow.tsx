import type { Operator, StatCondition, StatDefinition } from '../types/search'

const operatorOptions: {value: Operator; label: string}[] = [
  {value:'any', label:'Any'}, {value:'gte', label:'At least ≥'}, {value:'eq', label:'Exactly ='}, {value:'lte', label:'At most ≤'}, {value:'between', label:'Between'}
]

export function StatRow({ definition, condition, onChange }: { definition: StatDefinition; condition: StatCondition; onChange: (next: StatCondition) => void }) {
  const disabled = condition.operator === 'any'
  const allowsNegative = /plusMinus|fantasy|rushingYards|receivingYards/i.test(definition.key)
  const minimum = allowsNegative ? undefined : 0
  const numericValue = (raw: string) => {
    if (raw === '') return undefined
    const value = Number(raw)
    return minimum === 0 ? Math.max(0, value) : value
  }
  return (
    <div className="grid gap-3 border-b border-white/7 py-4 last:border-0 md:grid-cols-[1fr_170px_110px_110px] md:items-center md:py-3">
      <div className="text-sm font-semibold text-slate-100 md:text-base md:font-medium md:text-slate-200">{definition.label}</div>
      <select value={condition.operator} onChange={e => onChange({...condition, operator:e.target.value as Operator})} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-base outline-none focus:border-cyan-400/60 md:text-sm">
        {operatorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3 md:contents">
        <input type="number" inputMode="decimal" step="any" min={minimum} disabled={disabled} value={condition.value ?? ''} onChange={e => onChange({...condition, value:numericValue(e.target.value)})} placeholder={condition.operator === 'between' ? 'Min' : 'Value'} className="min-h-11 min-w-0 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-base outline-none disabled:cursor-not-allowed disabled:opacity-35 focus:border-cyan-400/60 md:text-sm" />
        <input type="number" inputMode="decimal" step="any" min={minimum} disabled={condition.operator !== 'between'} value={condition.secondValue ?? ''} onChange={e => onChange({...condition, secondValue:numericValue(e.target.value)})} placeholder="Max" className="min-h-11 min-w-0 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-base outline-none disabled:cursor-not-allowed disabled:opacity-20 focus:border-cyan-400/60 md:text-sm" />
      </div>
    </div>
  )
}
