import type { NbaCoverage } from '../services/nbaApi'

export type ShareResultData = {
  sport: string
  searchType: string
  conditions: string[]
  filters: string[]
  total: number
  rarity: string
  coverage?: NbaCoverage | null
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function downloadCard(data: ShareResultData) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#07111f'
  ctx.fillRect(0, 0, 1080, 1080)
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080)
  gradient.addColorStop(0, 'rgba(34,211,238,.18)')
  gradient.addColorStop(1, 'rgba(15,23,42,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1080, 1080)

  ctx.fillStyle = '#67e8f9'
  ctx.font = '700 34px system-ui, -apple-system, sans-serif'
  ctx.fillText('STAT FINDER', 72, 92)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '700 25px system-ui, -apple-system, sans-serif'
  ctx.fillText(`${data.sport} • ${data.searchType}`.toUpperCase(), 72, 142)

  let y = 230
  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 48px system-ui, -apple-system, sans-serif'
  for (const condition of data.conditions.slice(0, 6)) {
    const lines = wrapText(ctx, condition, 900)
    for (const line of lines) {
      ctx.fillText(line, 72, y)
      y += 61
    }
  }
  if (!data.conditions.length) {
    ctx.fillText('All performances', 72, y)
    y += 61
  }

  y += 24
  ctx.fillStyle = '#22d3ee'
  ctx.font = '900 70px system-ui, -apple-system, sans-serif'
  const resultText = data.total === 0 ? 'NEVER DONE' : `${data.total.toLocaleString()} ${data.total === 1 ? 'PERFORMANCE' : 'PERFORMANCES'}`
  for (const line of wrapText(ctx, resultText, 900)) {
    ctx.fillText(line, 72, y)
    y += 82
  }

  ctx.fillStyle = '#e2e8f0'
  ctx.font = '800 30px system-ui, -apple-system, sans-serif'
  ctx.fillText(data.rarity, 72, y)
  y += 58

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 24px system-ui, -apple-system, sans-serif'
  for (const filter of data.filters.slice(0, 4)) {
    for (const line of wrapText(ctx, filter, 900)) {
      ctx.fillText(line, 72, y)
      y += 34
    }
  }

  const coverage = data.coverage ? `Historical coverage: ${data.coverage.startSeason} – ${data.coverage.endSeason}` : 'Based on the available Stat Finder database.'
  ctx.fillStyle = '#64748b'
  ctx.font = '500 21px system-ui, -apple-system, sans-serif'
  const coverageLines = wrapText(ctx, coverage, 900)
  let footerY = 965 - (coverageLines.length - 1) * 28
  for (const line of coverageLines) {
    ctx.fillText(line, 72, footerY)
    footerY += 28
  }
  ctx.fillText('stat finder • historical game-level search', 72, 1020)

  const link = document.createElement('a')
  link.download = `stat-finder-${data.sport.toLowerCase()}-${data.searchType.toLowerCase()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function shareText(data: ShareResultData) {
  const lines = [
    'STAT FINDER',
    `${data.sport} • ${data.searchType}`,
    '',
    ...(data.conditions.length ? data.conditions : ['All performances']),
    '',
    data.total === 0 ? 'NEVER DONE' : `${data.total.toLocaleString()} ${data.total === 1 ? 'performance' : 'performances'} found`,
    data.rarity,
  ]
  if (data.coverage) lines.push(`Coverage: ${data.coverage.startSeason} – ${data.coverage.endSeason}`)
  return lines.join('\n')
}

export function ShareResultModal({ open, data, onClose }: { open: boolean; data: ShareResultData; onClose: () => void }) {
  if (!open) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText(data)) }
    catch { /* Clipboard can be blocked in some browsers. */ }
  }
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/90 p-0 backdrop-blur-sm md:items-center md:p-6" onMouseDown={onClose}>
    <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#08111f] p-5 shadow-2xl md:max-w-xl md:rounded-3xl md:p-7" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Share Result</div><h2 className="mt-2 text-2xl font-black">Ready for social.</h2><p className="mt-1 text-sm leading-6 text-slate-500">Export a square PNG or copy a clean text summary. No extra library is required.</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl text-slate-400 hover:bg-white/10">×</button></div>
      <div className="mt-5 rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[.09] to-transparent p-6">
        <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">STAT FINDER</div>
        <div className="mt-2 text-sm font-bold uppercase tracking-wider text-slate-500">{data.sport} • {data.searchType}</div>
        <div className="mt-6 space-y-2">{(data.conditions.length ? data.conditions : ['All performances']).slice(0,6).map(line=><div key={line} className="text-2xl font-black text-white">{line}</div>)}</div>
        <div className="mt-7 text-4xl font-black text-cyan-300">{data.total === 0 ? 'NEVER DONE' : `${data.total.toLocaleString()} ${data.total===1?'PERFORMANCE':'PERFORMANCES'}`}</div>
        <div className="mt-2 text-sm font-black tracking-widest text-slate-300">{data.rarity}</div>
        {data.filters.length>0&&<div className="mt-5 space-y-1 text-xs text-slate-500">{data.filters.slice(0,4).map(line=><div key={line}>{line}</div>)}</div>}
        {data.coverage&&<div className="mt-5 text-xs text-slate-600">Historical coverage: {data.coverage.startSeason} – {data.coverage.endSeason}</div>}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={()=>downloadCard(data)} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300">Save PNG</button><button onClick={copy} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black text-slate-200 hover:bg-white/10">Copy Summary</button></div>
    </section>
  </div>
}
