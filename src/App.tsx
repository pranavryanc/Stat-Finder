import { useEffect, useMemo, useRef, useState } from 'react'
import { getNbaBoxScore, getNbaMeta, getNbaNearestCalendarDay, searchNba, searchNbaAggregate, type NbaCoverage } from './services/nbaApi'
import { getNflBoxScore, getNflMeta, getNflNearestCalendarDay, searchNfl, searchNflAggregate } from './services/nflApi'
import { statDefinitions } from './data/statDefinitions'
import { aggregateStatDefinitions, nflAggregateStatDefinitions } from './data/aggregateStatDefinitions'
import { exploreSearches, getFeaturedToday, type ExploreSearch } from './data/exploreSearches'
import { StatRow } from './components/StatRow'
import { DataQaPage } from './components/DataQaPage'
import { ShareResultModal, type ShareResultData } from './components/ShareResultModal'
import { matchesCondition } from './lib/searchEngine'
import { loadSearchHistory, prependSearchHistory, saveSearchHistory, type SearchHistoryEntry } from './lib/searchHistory'
import { classifyRarity, type RarityKey } from './config/rarity'
import type { ClosestPerformance, GameBoxScore, GameRecord, GameStage, SearchScope, SearchType, Sport, StatCondition } from './types/search'

function pill(active: boolean) {
  return `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`
}

type StageFilter = 'Any' | GameStage
type SeasonOperator = 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
type ResultFilter = 'Any' | 'W' | 'L' | 'D'
type SortDirection = 'asc' | 'desc'
type CalendarFilter = 'Any' | string
type AppPage = 'finder' | 'explore' | 'history' | 'qa'
const PAGE_SIZE = 50
const DAY_OPTIONS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_OPTIONS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_IN_MONTH = [31,29,31,30,31,30,31,31,30,31,30,31]
const NBA_PLAYOFF_ROUNDS = [{value:'1',label:'First Round'},{value:'2',label:'Conference Semifinals'},{value:'3',label:'Conference Finals'},{value:'4',label:'NBA Finals'}]
const NFL_PLAYOFF_ROUNDS = ['Wild Card','Divisional','Conference Championship','Super Bowl']

function formatMonthDay(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})$/)
  if (!match) return value || 'Any'
  const month = Number(match[1])
  const day = Number(match[2])
  return `${MONTH_OPTIONS[month - 1] ?? match[1]} ${day}`
}

function seasonStart(season: string) {
  const match = season.match(/\d{4}/)
  return match ? Number(match[0]) : 0
}

function prioritizeNflDefinitions<T extends {section:string}>(defs:T[], position:string){
  if(!position||position==='Any') return defs
  const pos=position.toUpperCase()
  const priorities:string[] = pos==='QB' ? ['Passing','Rushing','Receiving','Kicking','Defense']
    : ['RB','FB'].includes(pos) ? ['Rushing','Receiving','Passing','Kicking','Defense']
    : ['WR','TE'].includes(pos) ? ['Receiving','Rushing','Passing','Kicking','Defense']
    : ['K','PK'].includes(pos) ? ['Kicking','Passing','Rushing','Receiving','Defense']
    : ['DE','DT','DL','NT','LB','ILB','OLB','MLB','DB','CB','S','FS','SS'].includes(pos) ? ['Defense','Receiving','Rushing','Passing','Kicking']
    : []
  if(!priorities.length) return defs
  const rank=new Map(priorities.map((section,index)=>[section,index]))
  return [...defs].sort((a,b)=>(rank.get(a.section)??99)-(rank.get(b.section)??99))
}

export default function App() {
  const [pageView, setPageView] = useState<AppPage>('finder')
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => loadSearchHistory())
  const [pendingHistoryRun, setPendingHistoryRun] = useState(false)
  const [sport, setSport] = useState<Sport>('NBA')
  const [searchType, setSearchType] = useState<SearchType>('Player')
  const [searchScope, setSearchScope] = useState<SearchScope>('Game')
  const [gameStage, setGameStage] = useState<StageFilter>('Any')
  const [seasonOperator, setSeasonOperator] = useState<SeasonOperator>('Any')
  const [seasonValue, setSeasonValue] = useState('')
  const [seasonSecondValue, setSeasonSecondValue] = useState('')
  const [careerYearOperator, setCareerYearOperator] = useState<SeasonOperator>('Any')
  const [careerYearValue, setCareerYearValue] = useState('')
  const [careerYearSecondValue, setCareerYearSecondValue] = useState('')
  const [teamFilter, setTeamFilter] = useState('Any')
  const [opponentFilter, setOpponentFilter] = useState('Any')
  const [playerFilter, setPlayerFilter] = useState('Any')
  const [positionFilter, setPositionFilter] = useState('Any')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('Any')
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<CalendarFilter>('Any')
  const [monthFilter, setMonthFilter] = useState<CalendarFilter>('Any')
  const [specificDateFilter, setSpecificDateFilter] = useState('')
  const [playoffRoundFilter, setPlayoffRoundFilter] = useState('Any')
  const [nflPeriodFilter, setNflPeriodFilter] = useState('Any')
  const [sortBy, setSortBy] = useState('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const [conditions, setConditions] = useState<StatCondition[]>([])
  const [results, setResults] = useState<GameRecord[] | null>(null)
  const [selectedPerformance, setSelectedPerformance] = useState<GameRecord | null>(null)
  const [selectedBoxScore, setSelectedBoxScore] = useState<GameBoxScore | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [nflMeta, setNflMeta] = useState<{seasons:string[];teams:string[];players:string[];opponents:string[];positions:string[];counts:{games:number;player_games:number;team_games:number};source:string} | null>(null)
  const [nbaMeta, setNbaMeta] = useState<{seasons:string[];teams:string[];players:string[];opponents:string[];positions:string[];counts:{games:number;player_games:number;team_games:number};source:string} | null>(null)
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [nbaClosest, setNbaClosest] = useState<ClosestPerformance[]>([])
  const [nbaCoverage, setNbaCoverage] = useState<NbaCoverage | null>(null)
  const resultsRef = useRef<HTMLElement | null>(null)

  const rawDefs = searchScope === 'Game' ? statDefinitions[sport][searchType] : (sport === 'NBA' ? (aggregateStatDefinitions[searchScope]?.[searchType] ?? []) : (nflAggregateStatDefinitions[searchScope]?.[searchType] ?? []))
  const defs = useMemo(() => sport==='NFL'&&searchType==='Player' ? prioritizeNflDefinitions(rawDefs,positionFilter) : rawDefs, [rawDefs,sport,searchType,positionFilter])
  const grouped = useMemo(
    () => Object.entries(defs.reduce<Record<string, typeof defs>>((acc, d) => {
      ;(acc[d.section] ||= []).push(d)
      return acc
    }, {})),
    [defs],
  )
  const currentConditions = useMemo(
    () => defs.map(d => conditions.find(c => c.statistic === d.key) ?? { statistic: d.key, operator: 'any' as const }),
    [defs, conditions],
  )
  const activeMeta = sport === 'NBA' ? nbaMeta : nflMeta
  const availableSeasons = useMemo(() => activeMeta?.seasons ?? [], [activeMeta])
  const availableTeams = useMemo(() => activeMeta?.teams ?? [], [activeMeta])
  const availableOpponents = useMemo(() => activeMeta?.opponents ?? [], [activeMeta])
  const availablePlayers = useMemo(() => activeMeta?.players ?? [], [activeMeta])
  const availablePositions = useMemo(() => sport === 'NBA' ? ['Guard','Forward','Center'] : (activeMeta?.positions ?? []), [activeMeta, sport])
  const activeConditions = currentConditions.filter(c => c.operator !== 'any')
  const hasStatConditions = activeConditions.length > 0
  const sortOptions = useMemo(() => [
    ...(searchScope === 'Game' ? [{value:'date',label:'Date'}] : []),
    {value:'entity',label:searchType === 'Player' ? 'Player' : 'Team'},
    {value:'team',label:'Team'},
    ...(searchScope === 'Game' ? [{value:'opponent',label:'Opponent'},{value:'result',label:'Result'}] : []),
    ...(searchScope !== 'Career' ? [{value:'season',label:'Season'}] : []),
    ...defs.map(def => ({value:def.key,label:def.label})),
  ], [defs, searchType, searchScope])
  const closest: ClosestPerformance[] = results?.length === 0 ? nbaClosest : []
  const rarity = results !== null && hasStatConditions ? classifyRarity(totalResults) : null
  const shareData: ShareResultData = useMemo(() => {
    const opLabel:Record<string,string>={gte:'≥',eq:'=',lte:'≤',between:'BETWEEN'}
    const conditionLines=activeConditions.map(c=>{
      const label=defs.find(d=>d.key===c.statistic)?.label??c.statistic
      return c.operator==='between' ? `${label} ${c.value ?? '?'}–${c.secondValue ?? '?'}` : `${label} ${opLabel[c.operator]??c.operator} ${c.value ?? ''}`
    })
    const filters:string[]=[`Window: ${searchScope}`]
    if(gameStage!=='Any') filters.push(gameStage)
    if(seasonOperator!=='Any') filters.push(`Season ${seasonOperator} ${seasonValue}${seasonOperator==='Between'?`–${seasonSecondValue}`:''}`)
    if(searchType==='Player'&&careerYearOperator!=='Any') filters.push(`Career Year ${careerYearOperator} ${careerYearValue}${careerYearOperator==='Between'?`–${careerYearSecondValue}`:''}`)
    if(specificDateFilter) filters.push(`Date: ${formatMonthDay(specificDateFilter)}`)
    if(sport==='NBA'&&playoffRoundFilter!=='Any') filters.push(`Playoff Round: ${NBA_PLAYOFF_ROUNDS.find(r=>r.value===playoffRoundFilter)?.label ?? playoffRoundFilter}`)
    if(sport==='NFL'&&nflPeriodFilter!=='Any') filters.push(nflPeriodFilter)
    else { if(monthFilter!=='Any') filters.push(`Month: ${MONTH_OPTIONS[Number(monthFilter)-1]}`); if(dayOfWeekFilter!=='Any') filters.push(`Day: ${DAY_OPTIONS[Number(dayOfWeekFilter)]}`) }
    if(playerFilter!=='Any'&&searchType==='Player') filters.push(`Player: ${playerFilter}`)
    if(teamFilter!=='Any') filters.push(`Team: ${teamFilter}`)
    if(opponentFilter!=='Any') filters.push(`Opponent: ${opponentFilter}`)
    if(positionFilter!=='Any'&&searchType==='Player') filters.push(`Position: ${positionFilter}`)
    if(resultFilter!=='Any') filters.push(`Result: ${resultFilter}`)
    return {sport,searchType:`${searchType} • ${searchScope}`,conditions:conditionLines,filters,total:totalResults,rarity:rarity?.label??'',coverage:nbaCoverage}
  },[activeConditions,defs,gameStage,seasonOperator,seasonValue,seasonSecondValue,careerYearOperator,careerYearValue,careerYearSecondValue,specificDateFilter,monthFilter,dayOfWeekFilter,playerFilter,searchType,searchScope,teamFilter,opponentFilter,positionFilter,resultFilter,sport,totalResults,rarity,nbaCoverage,playoffRoundFilter,nflPeriodFilter])


  useEffect(() => {
    if (sport !== 'NBA') return
    getNbaMeta().then(meta => { setNbaMeta(meta); setDataError('') }).catch(error => setDataError(error instanceof Error ? error.message : 'NBA database unavailable'))
  }, [sport])

  useEffect(() => {
    if (sport !== 'NFL') return
    getNflMeta().then(meta => { setNflMeta(meta); setDataError('') }).catch(error => setDataError(error instanceof Error ? error.message : 'NFL database unavailable. Run the NFL schema and ingestion steps first.'))
  }, [sport])

  useEffect(() => {
    if (results === null) return
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [results])

  useEffect(() => {
    if (!selectedPerformance && !selectedBoxScore) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedBoxScore) setSelectedBoxScore(null)
        else setSelectedPerformance(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedPerformance, selectedBoxScore])

  const updateMode = (nextSport: Sport, nextType: SearchType) => {
    setSport(nextSport)
    setSearchType(nextType)
    setSearchScope('Game')
    setConditions([])
    setGameStage('Any')
    setSeasonOperator('Any')
    setSeasonValue('')
    setSeasonSecondValue('')
    setCareerYearOperator('Any')
    setCareerYearValue('')
    setCareerYearSecondValue('')
    setTeamFilter('Any')
    setOpponentFilter('Any')
    setPlayerFilter('Any')
    setPositionFilter('Any')
    setResultFilter('Any')
    setDayOfWeekFilter('Any')
    setMonthFilter('Any')
    setSpecificDateFilter('')
    setPlayoffRoundFilter('Any')
    setNflPeriodFilter('Any')
    setSortBy('date')
    setSortDirection('desc')
    setPage(0)
    setTotalResults(0)
    setResults(null)
    setNbaClosest([])
    setNbaCoverage(null)
    setDataError('')
    setSelectedPerformance(null)
    setSelectedBoxScore(null)
  }

  const updateScope = (nextScope: SearchScope) => {
    if (searchType === 'Team' && nextScope === 'Career') return
    setSearchScope(nextScope)
    setConditions([])
    setOpponentFilter('Any'); setResultFilter('Any'); setPlayoffRoundFilter('Any'); setNflPeriodFilter('Any')
    setSortBy(nextScope === 'Season' ? 'season' : nextScope === 'Career' ? (sport==='NFL'?'passingYards':'points') : 'date')
    setSortDirection('desc'); setPage(0); setTotalResults(0); setResults(null); setNbaClosest([]); setNbaCoverage(null); setSelectedPerformance(null); setSelectedBoxScore(null)
    if (nextScope !== 'Game') setGameStage('Regular Season')
  }

  const updateCondition = (next: StatCondition) =>
    setConditions(prev => [...prev.filter(c => c.statistic !== next.statistic), next])

  const sortLocalRecords = (records: GameRecord[], key: string, direction: SortDirection) => {
    const multiplier = direction === 'asc' ? 1 : -1
    return [...records].sort((a,b) => {
      const getValue = (record:GameRecord) => {
        if (key === 'date') return record.date
        if (key === 'entity') return record.entityName
        if (key === 'team') return record.team
        if (key === 'opponent') return record.opponent
        if (key === 'season') return record.season
        if (key === 'result') return record.result
        return record.stats[key] ?? null
      }
      const av=getValue(a), bv=getValue(b)
      if (av === null && bv === null) return b.date.localeCompare(a.date)
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*multiplier || b.date.localeCompare(a.date)
      return String(av).localeCompare(String(bv))*multiplier || b.date.localeCompare(a.date)
    })
  }

  const addSearchToHistory = (total: number, coverage: NbaCoverage | null = null) => {
    const rarityForSearch = classifyRarity(total)
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const entry: SearchHistoryEntry = {
      id,
      searchedAt: new Date().toISOString(),
      sport,
      searchType,
      searchScope,
      conditions: currentConditions.filter(condition => condition.operator !== 'any').map(condition => ({ ...condition })),
      gameStage,
      seasonOperator,
      seasonValue,
      seasonSecondValue,
      careerYearOperator,
      careerYearValue,
      careerYearSecondValue,
      team: teamFilter,
      opponent: opponentFilter,
      player: searchType === 'Player' ? playerFilter : 'Any',
      position: searchType === 'Player' ? positionFilter : 'Any',
      result: resultFilter,
      dayOfWeek: dayOfWeekFilter,
      month: monthFilter,
      specificDate: specificDateFilter,
      playoffRound: playoffRoundFilter,
      periodFilter: nflPeriodFilter,
      sortBy,
      sortDirection,
      totalResults: total,
      rarityKey: rarityForSearch.key,
      rarityLabel: rarityForSearch.label,
      coverage,
    }
    setSearchHistory(previous => prependSearchHistory(previous, entry))
  }

  const fetchResults = async (nextPage = page, nextSortBy = sortBy, nextSortDirection = sortDirection, shouldScroll = false, recordHistory = false) => {
    setSelectedPerformance(null)
    setSelectedBoxScore(null)
    setDataError('')
    try {
      setLoading(true)
      const commonGamePayload={ searchType, gameStage, seasonOperator, seasonValue, seasonSecondValue, careerYearOperator, careerYearValue, careerYearSecondValue, team: teamFilter, opponent: opponentFilter, player: searchType === 'Player' ? playerFilter : 'Any', position: searchType === 'Player' ? positionFilter : 'Any', resultFilter, dayOfWeek: dayOfWeekFilter, month: monthFilter, specificDate: specificDateFilter, playoffRound: playoffRoundFilter, periodFilter: nflPeriodFilter, conditions: currentConditions, limit:PAGE_SIZE, offset:nextPage*PAGE_SIZE, sortBy:nextSortBy, sortDirection:nextSortDirection }
      const commonAggregatePayload={ scope:searchScope as Exclude<SearchScope,'Game'>, searchType, gameStage, seasonOperator, seasonValue, seasonSecondValue, careerYearOperator, careerYearValue, careerYearSecondValue, team:teamFilter, player:searchType==='Player'?playerFilter:'Any', position:searchType==='Player'?positionFilter:'Any', dayOfWeek:dayOfWeekFilter, month:monthFilter, specificDate:specificDateFilter, playoffRound:playoffRoundFilter, periodFilter:nflPeriodFilter, conditions:currentConditions, limit:PAGE_SIZE, offset:nextPage*PAGE_SIZE, sortBy:nextSortBy, sortDirection:nextSortDirection }
      const response = sport === 'NBA'
        ? (searchScope === 'Game' ? await searchNba(commonGamePayload) : await searchNbaAggregate(commonAggregatePayload))
        : (searchScope === 'Game' ? await searchNfl(commonGamePayload) : await searchNflAggregate(commonAggregatePayload))
      setResults(response.records)
      setTotalResults(response.total)
      setNbaClosest(response.closest ?? [])
      setNbaCoverage(response.coverage ?? null)
      setPage(nextPage)
      if (recordHistory) addSearchToHistory(response.total, response.coverage ?? null)
      if (shouldScroll) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
    } catch (error) {
      setResults(null)
      setTotalResults(0)
      setDataError(error instanceof Error ? error.message : `${sport} search failed`)
    } finally { setLoading(false) }
  }

  const runSearch = async () => {
    setPage(0)
    await fetchResults(0,sortBy,sortDirection,true,true)
  }

  const changeSort = async (nextSortBy:string) => {
    setSortBy(nextSortBy)
    if (results !== null) await fetchResults(0,nextSortBy,sortDirection,false)
  }

  const changeSortDirection = async (nextDirection:SortDirection) => {
    setSortDirection(nextDirection)
    if (results !== null) await fetchResults(0,sortBy,nextDirection,false)
  }

  const changePage = async (nextPage:number) => {
    if (nextPage < 0 || nextPage >= Math.ceil(totalResults/PAGE_SIZE)) return
    await fetchResults(nextPage,sortBy,sortDirection,true)
  }

  const clear = () => {
    setConditions([])
    setGameStage(searchScope === 'Game' ? 'Any' : 'Regular Season')
    setSeasonOperator('Any')
    setSeasonValue('')
    setSeasonSecondValue('')
    setCareerYearOperator('Any')
    setCareerYearValue('')
    setCareerYearSecondValue('')
    setTeamFilter('Any')
    setOpponentFilter('Any')
    setPlayerFilter('Any')
    setPositionFilter('Any')
    setResultFilter('Any')
    setDayOfWeekFilter('Any')
    setMonthFilter('Any')
    setSpecificDateFilter('')
    setPlayoffRoundFilter('Any')
    setNflPeriodFilter('Any')
    setSortBy(searchScope === 'Season' ? 'season' : searchScope === 'Career' ? (sport==='NFL'?'passingYards':'points') : 'date')
    setSortDirection('desc')
    setPage(0)
    setTotalResults(0)
    setResults(null)
    setNbaClosest([])
    setNbaCoverage(null)
    setDataError('')
    setSelectedPerformance(null)
    setSelectedBoxScore(null)
  }

  const openBoxScore = async (record: GameRecord) => {
    if (record.scope && record.scope !== 'Game') return
    try {
      setDataError('')
      const boxScore = record.sport === 'NBA' ? await getNbaBoxScore(record.gameId) : await getNflBoxScore(record.gameId)
      setSelectedBoxScore(boxScore)
    } catch (error) { setDataError(error instanceof Error ? error.message : 'Box score lookup failed') }
  }


  const applyExploreSearch = (search: ExploreSearch) => {
    updateMode(search.sport, search.searchType)
    setSearchScope('Game')
    setConditions(search.conditions.map(condition => ({ ...condition })))
    setGameStage(search.gameStage ?? 'Any')
    setMonthFilter(search.month ?? 'Any')
    setSpecificDateFilter(search.specificDate ?? '')
    setPageView('finder')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applyHistorySearch = (entry: SearchHistoryEntry, rerun = true) => {
    updateMode(entry.sport, entry.searchType)
    setSearchScope(entry.searchScope ?? 'Game')
    setConditions(entry.conditions.map(condition => ({ ...condition })))
    setGameStage(entry.gameStage)
    setSeasonOperator(entry.seasonOperator)
    setSeasonValue(entry.seasonValue)
    setSeasonSecondValue(entry.seasonSecondValue)
    setCareerYearOperator(entry.careerYearOperator ?? 'Any')
    setCareerYearValue(entry.careerYearValue ?? '')
    setCareerYearSecondValue(entry.careerYearSecondValue ?? '')
    setTeamFilter(entry.team)
    setOpponentFilter(entry.opponent)
    setPlayerFilter(entry.player)
    setPositionFilter(entry.position)
    setResultFilter(entry.result)
    setDayOfWeekFilter(entry.dayOfWeek)
    setMonthFilter(entry.month)
    setSpecificDateFilter(entry.specificDate)
    setPlayoffRoundFilter(entry.playoffRound ?? 'Any')
    setNflPeriodFilter(entry.periodFilter ?? 'Any')
    setSortBy(entry.sortBy)
    setSortDirection(entry.sortDirection)
    setPageView('finder')
    setPendingHistoryRun(rerun)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteHistoryEntry = (id: string) => {
    setSearchHistory(previous => {
      const next = previous.filter(entry => entry.id !== id)
      saveSearchHistory(next)
      return next
    })
  }

  const clearSearchHistory = () => {
    setSearchHistory([])
    saveSearchHistory([])
  }

  useEffect(() => {
    if (!pendingHistoryRun) return
    setPendingHistoryRun(false)
    void runSearch()
  }, [pendingHistoryRun])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#153154_0,_#07101f_42%,_#050914_100%)] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#07101f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 font-black text-slate-950">SF</div>
            <div><div className="font-bold tracking-tight">STAT FINDER</div><div className="text-[11px] uppercase tracking-[.22em] text-slate-500">Sports analytics search</div></div>
          </div>
          <nav className="flex gap-1 md:gap-2">{([['finder','Stat Finder'],['explore','Explore'],['history','History'],['qa','Data QA']] as [AppPage,string][]).map(([key,label]) => <button key={key} onClick={()=>setPageView(key)} className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition md:px-3 md:text-sm ${pageView===key?'bg-white/8 text-white':'text-slate-500 hover:text-slate-300'}`}>{label}</button>)}</nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-10">
        {pageView === 'explore' ? <ExplorePage onTrySearch={applyExploreSearch} /> : pageView === 'history' ? <HistoryPage entries={searchHistory} onRerun={entry=>applyHistorySearch(entry,true)} onEdit={entry=>applyHistorySearch(entry,false)} onDelete={deleteHistoryEntry} onClear={clearSearchHistory} onExplore={()=>setPageView('explore')} /> : pageView === 'qa' ? <DataQaPage /> : <>
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">Real NBA + NFL Data</div>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">Has anyone ever done <span className="text-cyan-300">this?</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Build an exact statistical combination and search real NBA or NFL game, season, or career performances. NBA uses the connected NBA Stats database; NFL uses historical game-level data for 1970–1998 plus nflverse game-level data from 1999 onward, loaded into PostgreSQL.</p>
        </div>

        <section className="mb-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 shadow-2xl shadow-black/20 md:grid-cols-2 md:p-5">
          <div><div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Sport</div><div className="grid grid-cols-2 gap-2">{(['NBA', 'NFL'] as Sport[]).map(x => <button key={x} onClick={() => updateMode(x, searchType)} className={pill(sport === x)}>{x}</button>)}</div></div>
          <div><div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Search Type</div><div className="grid grid-cols-2 gap-2">{(['Player', 'Team'] as SearchType[]).map(x => <button key={x} onClick={() => updateMode(sport, x)} className={pill(searchType === x)}>{x}</button>)}</div></div>
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.035] p-4 md:p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Stat Window</div>
          <div className="grid gap-2 sm:grid-cols-3">{(['Game','Season','Career'] as SearchScope[]).map(scope=>{const disabled=(searchType==='Team'&&scope==='Career');return <button key={scope} disabled={disabled} onClick={()=>updateScope(scope)} className={`${pill(searchScope===scope)} disabled:cursor-not-allowed disabled:opacity-35`}>{scope}{scope==='Career'&&searchType==='Team'?' (Franchise later)':''}</button>})}</div>
          {(sport==='NFL'||searchType==='Team')&&<p className="mt-2 text-xs text-slate-500">{searchType==='Team'?'Team Season search is live. Franchise-history search will be added after franchise identity mapping is defined.':''}</p>}
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-white/10 bg-white/[.035] p-4 md:p-5">
            <div className="mb-1 flex items-center justify-between"><div><h2 className="text-xl font-bold">Stat Filters</h2><p className="mt-1 text-sm text-slate-500">Only filters changed from “Any” are included.</p></div><button onClick={clear} className="text-sm font-semibold text-slate-400 hover:text-white">Reset Filters</button></div>
            {sport==='NFL'&&searchType==='Player'&&positionFilter!=='Any'&&<div className="mb-3 rounded-xl border border-cyan-400/10 bg-cyan-400/[.04] px-3 py-2 text-xs text-slate-500">Showing all NFL player stats; sections most relevant to <span className="font-bold text-cyan-300">{positionFilter}</span> are listed first.</div>}
              {grouped.map(([section, sectionDefs]) => <div key={section} className="mt-6"><div className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-cyan-300/70">{section}</div>{sectionDefs.map(def => <StatRow key={def.key} definition={def} condition={currentConditions.find(c => c.statistic === def.key)!} onChange={updateCondition} />)}</div>)}

            <div className="mt-8 border-t border-white/8 pt-6">
              <div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300/70">Additional Filters</div>
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Season Type</div><div className="mt-1 text-xs text-slate-500">Regular season or postseason</div></div>
                  <select value={gameStage} onChange={e => { const next=e.target.value as StageFilter; setGameStage(next); if(next==='Playoffs' && resultFilter==='D') setResultFilter('Any'); if(next!=='Playoffs')setPlayoffRoundFilter('Any'); if(sport==='NFL'){if(next==='Regular Season'&&NFL_PLAYOFF_ROUNDS.includes(nflPeriodFilter))setNflPeriodFilter('Any');if(next==='Playoffs'&&nflPeriodFilter.startsWith('Week '))setNflPeriodFilter('Any')} }} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                    <option>Any</option><option>Regular Season</option><option>Playoffs</option>
                  </select>
                </div>

                {sport==='NFL' && <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Week / Playoff Round</div><div className="mt-1 text-xs text-slate-500">Choose a regular-season week or a specific postseason round</div></div>
                  <select value={nflPeriodFilter} onChange={e=>{const value=e.target.value;setNflPeriodFilter(value);if(value.startsWith('Week '))setGameStage('Regular Season');else if(NFL_PLAYOFF_ROUNDS.includes(value))setGameStage('Playoffs')}} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                    <option value="Any">Any week / round</option><optgroup label="Regular Season">{Array.from({length:18},(_,i)=>i+1).map(week=><option key={week} value={`Week ${week}`}>Week {week}</option>)}</optgroup><optgroup label="Playoffs">{NFL_PLAYOFF_ROUNDS.map(round=><option key={round} value={round}>{round}</option>)}</optgroup>
                  </select>
                </div>}

                {sport==='NBA' && <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Playoff Round</div><div className="mt-1 text-xs text-slate-500">Filter postseason games to a specific round</div></div>
                  <select disabled={gameStage!=='Playoffs'} value={playoffRoundFilter} onChange={e=>setPlayoffRoundFilter(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40">
                    <option value="Any">Any playoff round</option>{NBA_PLAYOFF_ROUNDS.map(round=><option key={round.value} value={round.value}>{round.label}</option>)}
                  </select>
                </div>}

                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                  <div><div className="font-semibold">Season</div><div className="mt-1 text-xs text-slate-500">Exact, before, after, or an inclusive range</div></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={seasonOperator} onChange={e => { const next = e.target.value as SeasonOperator; setSeasonOperator(next); if (next === 'Any') { setSeasonValue(''); setSeasonSecondValue('') } }} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                      <option>Any</option><option>Exactly</option><option>Before</option><option>After</option><option>Between</option>
                    </select>
                    <select disabled={seasonOperator === 'Any'} value={seasonValue} onChange={e => setSeasonValue(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40">
                      <option value="">Select season</option>{availableSeasons.map(season => <option key={season} value={season}>{season}</option>)}
                    </select>
                    {seasonOperator === 'Between' && <select value={seasonSecondValue} onChange={e => setSeasonSecondValue(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 sm:col-start-2">
                      <option value="">Through season</option>{availableSeasons.map(season => <option key={season} value={season}>{season}</option>)}
                    </select>}
                  </div>
                </div>

                {searchType === 'Player' && <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                  <div><div className="font-semibold">Career Year</div><div className="mt-1 text-xs text-slate-500">Filter by a player's 1st, 2nd, 3rd, etc. season played. In Career mode, only the selected career years are aggregated.</div></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={careerYearOperator} onChange={e=>{const next=e.target.value as SeasonOperator;setCareerYearOperator(next);if(next==='Any'){setCareerYearValue('');setCareerYearSecondValue('')}}} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                      <option>Any</option><option>Exactly</option><option>Before</option><option>After</option><option>Between</option>
                    </select>
                    <input type="number" min="1" step="1" disabled={careerYearOperator==='Any'} value={careerYearValue} onChange={e=>setCareerYearValue(e.target.value)} placeholder="Career year" className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40"/>
                    {careerYearOperator==='Between'&&<input type="number" min="1" step="1" value={careerYearSecondValue} onChange={e=>setCareerYearSecondValue(e.target.value)} placeholder="Through career year" className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 sm:col-start-2"/>}
                  </div>
                </div>}

                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start">
                  <div><div className="font-semibold">Date Filters</div><div className="mt-1 text-xs text-slate-500">Day of week, calendar month, or a specific month/day</div></div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-400">Day of week
                      <select value={dayOfWeekFilter} onChange={e=>setDayOfWeekFilter(e.target.value)} className="mt-1 block w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                        <option value="Any">Any day</option>{DAY_OPTIONS.map((day,index)=><option key={day} value={String(index)}>{day}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-400">Month
                      <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} className="mt-1 block w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                        <option value="Any">Any month</option>{MONTH_OPTIONS.map((month,index)=><option key={month} value={String(index+1)}>{month}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-400">Specific date (month/day)
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <select value={specificDateFilter ? String(Number(specificDateFilter.slice(0,2))) : ''} onChange={e=>{const month=e.target.value;if(!month){setSpecificDateFilter('');return}const currentDay=Number(specificDateFilter.slice(3,5))||1;const maxDay=DAYS_IN_MONTH[Number(month)-1]??31;setSpecificDateFilter(`${String(month).padStart(2,'0')}-${String(Math.min(currentDay,maxDay)).padStart(2,'0')}`)}} className="block w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                          <option value="">Month</option>{MONTH_OPTIONS.map((month,index)=><option key={month} value={String(index+1)}>{month}</option>)}
                        </select>
                        <select disabled={!specificDateFilter} value={specificDateFilter ? String(Number(specificDateFilter.slice(3,5))) : ''} onChange={e=>{const month=Number(specificDateFilter.slice(0,2));const day=Number(e.target.value);if(month&&day)setSpecificDateFilter(`${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`)}} className="block w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40">
                          <option value="">Day</option>{specificDateFilter && Array.from({length:DAYS_IN_MONTH[Number(specificDateFilter.slice(0,2))-1]??31},(_,i)=>i+1).map(day=><option key={day} value={String(day)}>{day}</option>)}
                        </select>
                      </div>
                      {specificDateFilter && <button type="button" onClick={()=>setSpecificDateFilter('')} className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-white">Clear specific date</button>}
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Team</div><div className="mt-1 text-xs text-slate-500">Limit results to performances for one team</div></div>
                  <SearchableFilter value={teamFilter} onChange={setTeamFilter} options={availableTeams} placeholder="Any team" listId="team-options" />
                </div>

                {searchType === 'Player' && <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Player</div><div className="mt-1 text-xs text-slate-500">Search the historical player database</div></div>
                  <SearchableFilter value={playerFilter} onChange={setPlayerFilter} options={availablePlayers} placeholder="Any player" listId="player-options" />
                </div>}

                {searchScope === 'Game' && <>
                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Opponent</div><div className="mt-1 text-xs text-slate-500">Limit results to games against one opponent</div></div>
                  <SearchableFilter value={opponentFilter} onChange={setOpponentFilter} options={availableOpponents} placeholder="Any opponent" listId="opponent-options" />
                </div>
                </>}

                {searchType === 'Player' && <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Position</div><div className="mt-1 text-xs text-slate-500">NBA uses normalized Guard / Forward / Center groups; NFL uses recorded positions and prioritizes the most relevant stat sections</div></div>
                  <select value={positionFilter} onChange={e=>setPositionFilter(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                    <option>Any</option>{availablePositions.map(position=><option key={position} value={position}>{position}</option>)}
                  </select>
                </div>}

                {searchScope === 'Game' && <>
                <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <div><div className="font-semibold">Game Result</div><div className="mt-1 text-xs text-slate-500">Filter by win, loss{sport === 'NFL' ? ', or draw' : ''}</div></div>
                  <select value={resultFilter} onChange={e => setResultFilter(e.target.value as ResultFilter)} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">
                    <option value="Any">Any</option><option value="W">Win</option><option value="L">Loss</option>{sport === 'NFL' && gameStage !== 'Playoffs' && <option value="D">Draw</option>}
                  </select>
                </div>
                </>}
              </div>
            </div>
          </section>

          <aside className="space-y-5"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-5 lg:sticky lg:top-24">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Search Summary</div><div className="mt-2 text-xl font-bold">{sport} • {searchType} • {searchScope}</div>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Season Type</span><span className="float-right font-bold text-cyan-300">{gameStage}</span></div>
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Season</span><span className="float-right font-bold text-cyan-300">{seasonOperator === 'Any' ? 'Any' : `${seasonOperator} ${seasonValue || '?'}`}{seasonOperator === 'Between' ? ` – ${seasonSecondValue || '?'}` : ''}</span></div>
              {searchType === 'Player' && <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Career Year</span><span className="float-right font-bold text-cyan-300">{careerYearOperator === 'Any' ? 'Any' : `${careerYearOperator} ${careerYearValue || '?'}`}{careerYearOperator === 'Between' ? ` – ${careerYearSecondValue || '?'}` : ''}</span></div>}
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Day</span><span className="float-right font-bold text-cyan-300">{dayOfWeekFilter === 'Any' ? 'Any' : DAY_OPTIONS[Number(dayOfWeekFilter)]}</span></div>
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Month</span><span className="float-right font-bold text-cyan-300">{monthFilter === 'Any' ? 'Any' : MONTH_OPTIONS[Number(monthFilter)-1]}</span></div>
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Specific Date</span><span className="float-right font-bold text-cyan-300">{formatMonthDay(specificDateFilter)}</span></div>
              {sport==='NBA'&&<div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Playoff Round</span><span className="float-right font-bold text-cyan-300">{playoffRoundFilter==='Any'?'Any':NBA_PLAYOFF_ROUNDS.find(r=>r.value===playoffRoundFilter)?.label}</span></div>}
              {sport==='NFL'&&<div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Week / Round</span><span className="float-right font-bold text-cyan-300">{nflPeriodFilter}</span></div>}
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Team</span><span className="float-right font-bold text-cyan-300">{teamFilter}</span></div>
              {searchType === 'Player' && <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Player</span><span className="float-right max-w-[170px] truncate font-bold text-cyan-300">{playerFilter}</span></div>}
              {searchScope === 'Game' && <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Opponent</span><span className="float-right font-bold text-cyan-300">{opponentFilter}</span></div>}
              {searchType === 'Player' && <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Position</span><span className="float-right font-bold text-cyan-300">{positionFilter}</span></div>}
              {searchScope === 'Game' && <div className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">Result</span><span className="float-right font-bold text-cyan-300">{resultFilter === 'Any' ? 'Any' : resultFilter === 'W' ? 'Win' : resultFilter === 'L' ? 'Loss' : 'Draw'}</span></div>}
              {sport === 'NBA' && nbaCoverage && <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] px-3 py-3 text-xs leading-5 text-slate-400"><div className="font-bold text-cyan-300">Effective historical coverage: {nbaCoverage.startSeason} – {nbaCoverage.endSeason}</div><div className="mt-1">{nbaCoverage.message}</div></div>}
            </div>
            <div className="mt-4 space-y-2">{activeConditions.length ? activeConditions.map(c => { const def = defs.find(d => d.key === c.statistic); const op = { gte: '≥', eq: '=', lte: '≤', between: 'between', any: '' }[c.operator]; return <div key={c.statistic} className="rounded-xl bg-black/20 px-3 py-2 text-sm"><span className="text-slate-400">{def?.label}</span><span className="float-right font-bold text-cyan-300">{op} {c.value}{c.operator === 'between' ? ` – ${c.secondValue ?? '?'}` : ''}</span></div> }) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-slate-500">No active stat filters yet. You can search now to browse all performances, then narrow the results with any filter.</div>}</div>
            <button disabled={loading || (sport === 'NBA' && !nbaMeta)} onClick={runSearch} className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3.5 font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'SEARCHING…' : hasStatConditions ? `SEARCH ${searchScope.toUpperCase()} PERFORMANCES` : `SEARCH ALL ${searchScope.toUpperCase()} PERFORMANCES`}</button>
            {dataError && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-3 py-3 text-xs leading-5 text-rose-200">{dataError}</div>}
            <div className="mt-4 text-xs leading-5 text-slate-500"><strong className="text-slate-400">Coverage:</strong> {sport === 'NBA' ? (nbaMeta ? `${nbaMeta.seasons.at(-1) ?? '—'} through ${nbaMeta.seasons[0] ?? '—'} • ${nbaMeta.counts.games.toLocaleString()} games • source: ${nbaMeta.source}` : 'Connect and ingest the NBA database to enable real searches.') : nflMeta ? `${nflMeta.seasons.at(-1) ?? '—'} through ${nflMeta.seasons[0] ?? '—'} • ${nflMeta.counts.games.toLocaleString()} games • source: ${nflMeta.source}` : 'Run the NFL schema and ingestion steps to enable real searches.'}</div>
          </div></aside>
        </div>

        {results !== null && <section ref={resultsRef} className="mt-7 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[.035] p-4 md:p-6">
          {results.length > 0 ? <>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-widest text-cyan-300">{hasStatConditions?'Search Results':'Browse Results'}</div><div className="mt-1 flex flex-wrap items-center gap-3"><h2 className="text-3xl font-black">{totalResults.toLocaleString()} {totalResults === 1 ? searchScope : `${searchScope} Performances`} Found</h2>{rarity && <RarityBadge rarityKey={rarity.key} label={rarity.label} />}</div>{!hasStatConditions&&<p className="mt-2 text-sm text-slate-500">Showing all performances that match the selected non-stat filters. Add a stat condition anytime to calculate rarity.</p>}{nbaCoverage && <p className="mt-2 text-sm text-slate-500">Historical coverage for this search: <span className="font-bold text-slate-300">{nbaCoverage.startSeason} – {nbaCoverage.endSeason}</span>.</p>}</div><div className="flex items-center gap-2"><button onClick={()=>setShareOpen(true)} className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.07] px-3 py-2 text-xs font-black text-cyan-200 hover:bg-cyan-400/[.12]">Share Result</button><div className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400">{sport === 'NBA' ? 'NBA Stats database' : 'Historical NFL + nflverse database'}</div></div></div>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Showing</div><div className="mt-1 text-sm font-semibold text-slate-300">{(page*PAGE_SIZE+1).toLocaleString()}–{Math.min((page+1)*PAGE_SIZE,totalResults).toLocaleString()} of {totalResults.toLocaleString()}</div></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="text-xs font-semibold text-slate-400">Sort by<select value={sortBy} onChange={e=>changeSort(e.target.value)} className="mt-1 block min-w-44 rounded-xl border border-white/10 bg-[#0b1424] px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50">{sortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-400">Order<select value={sortDirection} onChange={e=>changeSortDirection(e.target.value as SortDirection)} className="mt-1 block rounded-xl border border-white/10 bg-[#0b1424] px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50"><option value="desc">Highest / Newest</option><option value="asc">Lowest / Oldest</option></select></label>
              </div>
            </div>
            <ActiveFilters conditions={activeConditions} defs={defs} gameStage={gameStage} seasonOperator={seasonOperator} seasonValue={seasonValue} seasonSecondValue={seasonSecondValue} careerYearOperator={searchType==='Player'?careerYearOperator:'Any'} careerYearValue={careerYearValue} careerYearSecondValue={careerYearSecondValue} dayOfWeek={dayOfWeekFilter} month={monthFilter} specificDate={specificDateFilter} playoffRound={sport==='NBA'?playoffRoundFilter:'Any'} periodFilter={sport==='NFL'?nflPeriodFilter:'Any'} team={teamFilter} opponent={opponentFilter} player={searchType==='Player'?playerFilter:'Any'} position={searchType==='Player'?positionFilter:'Any'} result={resultFilter} onClearStat={stat=>setConditions(prev=>prev.filter(c=>c.statistic!==stat))} onClearGameStage={()=>setGameStage('Any')} onClearSeason={()=>{setSeasonOperator('Any');setSeasonValue('');setSeasonSecondValue('')}} onClearCareerYear={()=>{setCareerYearOperator('Any');setCareerYearValue('');setCareerYearSecondValue('')}} onClearDayOfWeek={()=>setDayOfWeekFilter('Any')} onClearMonth={()=>setMonthFilter('Any')} onClearSpecificDate={()=>setSpecificDateFilter('')} onClearPlayoffRound={()=>setPlayoffRoundFilter('Any')} onClearPeriodFilter={()=>setNflPeriodFilter('Any')} onClearTeam={()=>setTeamFilter('Any')} onClearOpponent={()=>setOpponentFilter('Any')} onClearPlayer={()=>setPlayerFilter('Any')} onClearPosition={()=>setPositionFilter('Any')} onClearResult={()=>setResultFilter('Any')} />
            <p className="mt-3 text-sm text-slate-500">Select any performance to view details, then open the full game box score.</p>
            <div className="mt-5 grid gap-3">{results.map(record => <ResultCard key={record.id} record={record} conditions={activeConditions} defs={defs} sortBy={sortBy} sortLabel={sortOptions.find(option => option.value === sortBy)?.label ?? 'Date'} onOpen={setSelectedPerformance} />)}</div>
            {totalResults > PAGE_SIZE && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5"><button disabled={page===0||loading} onClick={()=>changePage(page-1)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-35">← Previous</button><div className="text-sm font-semibold text-slate-400">Page {page+1} of {Math.ceil(totalResults/PAGE_SIZE).toLocaleString()}</div><button disabled={(page+1)*PAGE_SIZE>=totalResults||loading} onClick={()=>changePage(page+1)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-35">Next →</button></div>}
          </> : <>
            {hasStatConditions ? <>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-300/[.06] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-3"><div className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Never Done — Within Search Coverage</div>{rarity && <RarityBadge rarityKey={rarity.key} label={rarity.label} />}</div><h2 className="mt-2 text-3xl font-black">No exact match</h2></div><button onClick={()=>setShareOpen(true)} className="rounded-xl border border-amber-300/20 bg-amber-300/[.07] px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-300/[.12]">Share Result</button></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">No {searchScope.toLowerCase()} {searchType.toLowerCase()} performance in the {sport === 'NBA' ? `valid historical coverage for this search${nbaCoverage ? ` (${nbaCoverage.startSeason} – ${nbaCoverage.endSeason})` : ''}` : `loaded NFL historical coverage${nbaCoverage ? ` (${nbaCoverage.startSeason} – ${nbaCoverage.endSeason})` : ''}`} satisfies every active condition and game filter.</p></div>
              <div className="mt-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-bold">Closest {searchScope} Performances</h3><p className="mt-1 text-sm text-slate-500">Ranked across the full valid search coverage using stat-normalized distance, so misses are scaled to the statistic rather than treated as equal raw-unit differences.</p></div>{closest[0]&&<div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.06] px-3 py-2 text-xs text-slate-400"><span className="font-black text-cyan-300">Best match: {closest[0].similarity}%</span> • {closest[0].conditionsMet}/{closest[0].conditionCount} conditions met</div>}</div><div className="mt-4 grid gap-3">{closest.map(item => <ResultCard key={item.record.id} record={item.record} conditions={activeConditions} defs={defs} closestInfo={item} sortBy={sortBy} sortLabel={sortOptions.find(option => option.value === sortBy)?.label ?? 'Date'} onOpen={setSelectedPerformance} />)}</div></div>
            </> : <div className="rounded-2xl border border-white/10 bg-white/[.035] p-6 text-center"><div className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">No performances found</div><h2 className="mt-2 text-2xl font-black">No records match these filters</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">There are no {searchScope.toLowerCase()} {searchType.toLowerCase()} performances matching the selected non-stat filters. Clear or broaden a filter and search again.</p></div>}
          </>}
        </section>}
        </>}
      </main>

      <ShareResultModal open={shareOpen} data={shareData} onClose={()=>setShareOpen(false)} />
      {selectedPerformance && !selectedBoxScore && <PerformanceDetails record={selectedPerformance} conditions={activeConditions} defs={defs} hasBoxScore={!selectedPerformance.scope || selectedPerformance.scope === 'Game'} onOpenBoxScore={() => openBoxScore(selectedPerformance)} onClose={() => setSelectedPerformance(null)} />}
      {selectedBoxScore && <BoxScoreDetails boxScore={selectedBoxScore} onBack={() => setSelectedBoxScore(null)} onClose={() => { setSelectedBoxScore(null); setSelectedPerformance(null) }} />}
    </div>
  )
}


function ExplorePage({ onTrySearch }: { onTrySearch:(search:ExploreSearch)=>void }) {
  const [category,setCategory]=useState('All')
  const [exploreSport,setExploreSport]=useState<Sport>('NBA')
  const today=new Date()
  const todayMonth=today.getMonth()+1
  const todayDay=today.getDate()
  const [calendarDay,setCalendarDay]=useState<{exact:boolean;month:number;day:number;distanceDays:number|null}|null>(null)

  useEffect(()=>{
    let cancelled=false
    setCalendarDay(null)
    const loader=exploreSport==='NBA'?getNbaNearestCalendarDay:getNflNearestCalendarDay
    loader(todayMonth,todayDay)
      .then(value=>{if(!cancelled)setCalendarDay(value)})
      .catch(()=>{if(!cancelled)setCalendarDay({exact:true,month:todayMonth,day:todayDay,distanceDays:0})})
    return()=>{cancelled=true}
  },[exploreSport,todayMonth,todayDay])

  useEffect(()=>{setCategory('All')},[exploreSport])

  const featuredMonth=calendarDay?.month ?? todayMonth
  const featuredDay=calendarDay?.day ?? todayDay
  const featuredDate=`${String(featuredMonth).padStart(2,'0')}-${String(featuredDay).padStart(2,'0')}`
  const nearby=calendarDay ? !calendarDay.exact : false
  const featured=getFeaturedToday(exploreSport,today,featuredDate,nearby)
  const todayLabel=today.toLocaleDateString([], {month:'long',day:'numeric'})
  const featuredDateLabel=formatMonthDay(featuredDate)
  const sportSearches=exploreSearches.filter(search=>search.sport===exploreSport)
  const categories=['All',...Array.from(new Set(sportSearches.map(search=>search.category)))]
  const visible=category==='All'?sportSearches:sportSearches.filter(search=>search.category===category)

  const conditionText=(search:ExploreSearch)=>search.conditions.map(condition=>{
    const def=statDefinitions[search.sport][search.searchType].find(item=>item.key===condition.statistic)
    const op={gte:'≥',eq:'=',lte:'≤',between:'Between',any:''}[condition.operator]
    return `${def?.label ?? condition.statistic} ${op} ${condition.value ?? ''}${condition.operator==='between'?`–${condition.secondValue ?? ''}`:''}`
  })

  const searchCard=(search:ExploreSearch,featuredCard=false)=><article key={search.id} className={`group flex min-h-64 flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 ${featuredCard?'border-cyan-300/20 bg-gradient-to-br from-cyan-400/[.09] to-violet-400/[.05] hover:border-cyan-300/35':'border-white/10 bg-white/[.035] hover:border-cyan-400/25 hover:bg-white/[.05]'}`}><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${featuredCard?'bg-cyan-300/15 text-cyan-200':'bg-cyan-400/10 text-cyan-300'}`}>{search.featuredLabel ?? search.category}</span><span className="text-xs font-bold text-slate-500">{search.sport} • {search.searchType}</span></div><h2 className="mt-4 text-xl font-black">{search.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{search.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{conditionText(search).map(text=><span key={text} className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs font-bold text-slate-300">{text}</span>)}{search.gameStage&&<span className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs font-bold text-slate-300">{search.gameStage}</span>}{search.specificDate&&<span className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs font-bold text-slate-300">{formatMonthDay(search.specificDate)}</span>}</div><button onClick={()=>onTrySearch(search)} className="mt-auto pt-5 text-left text-sm font-black text-cyan-300 transition group-hover:text-cyan-200">TRY THIS SEARCH →</button></article>

  const databaseName=exploreSport==='NBA'?'NBA':'NFL'
  return <section>
    <div className="mb-8 max-w-3xl"><div className="mb-3 inline-flex rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-300">Explore Stat Finder</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Start with a fascinating <span className="text-cyan-300">question.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Browse today’s featured searches and curated historical ideas, then load any one into Stat Finder and adjust it however you want. Result counts always come from your database when you press Search.</p></div>

    <div className="mb-8 inline-flex rounded-2xl border border-white/10 bg-black/20 p-1.5">
      {(['NBA','NFL'] as Sport[]).map(item=><button key={item} onClick={()=>setExploreSport(item)} className={`rounded-xl px-5 py-2.5 text-sm font-black transition ${exploreSport===item?'bg-cyan-400 text-slate-950':'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{item}</button>)}
    </div>

    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Featured Today • {exploreSport}</div><h2 className="mt-1 text-2xl font-black">{todayLabel} in {databaseName} Stat Finder</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{calendarDay===null?`Checking ${databaseName} history for today’s calendar date…`:calendarDay.exact?`The Daily Spotlight changes every calendar day. “On This Day” searches target ${featuredDateLabel} across the available ${databaseName} database.`:`No ${databaseName} games in the database were played on ${todayLabel}. “Around This Day” uses the nearest historical ${databaseName} calendar date, ${featuredDateLabel}${calendarDay.distanceDays!==null?` (${calendarDay.distanceDays} day${calendarDay.distanceDays===1?'':'s'} away)`:''}.`}</p></div><div className="rounded-xl border border-white/8 bg-white/[.035] px-3 py-2 text-xs font-bold text-slate-400">Updates automatically each day</div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{featured.map(search=>searchCard(search,true))}</div>
    </section>

    <div className="mb-3"><div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">{exploreSport} Explore Library</div><h2 className="mt-1 text-2xl font-black">Curated historical searches</h2></div>
    <div className="mb-6 flex flex-wrap gap-2">{categories.map(item=><button key={item} onClick={()=>setCategory(item)} className={pill(category===item)}>{item}</button>)}</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(search=>searchCard(search))}</div>
    <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 p-5"><div className="text-xs font-bold uppercase tracking-widest text-slate-500">Built for expansion</div><p className="mt-2 text-sm leading-6 text-slate-400">Featured Today is generated from the current date for each sport while the permanent Explore libraries stay configuration-driven. The next step can add automatically discovered rare combinations from the database.</p></div>
  </section>
}

function HistoryPage({entries,onRerun,onEdit,onDelete,onClear,onExplore}:{entries:SearchHistoryEntry[];onRerun:(entry:SearchHistoryEntry)=>void;onEdit:(entry:SearchHistoryEntry)=>void;onDelete:(id:string)=>void;onClear:()=>void;onExplore:()=>void}) {
  const conditionLabel=(entry:SearchHistoryEntry,condition:StatCondition)=>{
    const entryScope=entry.searchScope ?? 'Game'
    const entryDefs=entryScope==='Game'?statDefinitions[entry.sport][entry.searchType]:(entry.sport==='NBA'?(aggregateStatDefinitions[entryScope]?.[entry.searchType]??[]):(nflAggregateStatDefinitions[entryScope]?.[entry.searchType]??[]))
    const def=entryDefs.find(item=>item.key===condition.statistic)
    const op={gte:'≥',eq:'=',lte:'≤',between:'Between',any:''}[condition.operator]
    return `${def?.label ?? condition.statistic} ${op} ${condition.value ?? ''}${condition.operator==='between'?`–${condition.secondValue ?? ''}`:''}`
  }
  const filterLabels=(entry:SearchHistoryEntry)=>{
    const labels:string[]=[]
    if(entry.gameStage!=='Any')labels.push(entry.gameStage)
    if(entry.seasonOperator!=='Any')labels.push(`Season ${entry.seasonOperator} ${entry.seasonValue}${entry.seasonOperator==='Between'?`–${entry.seasonSecondValue}`:''}`)
    if((entry.careerYearOperator??'Any')!=='Any')labels.push(`Career Year ${entry.careerYearOperator} ${entry.careerYearValue??''}${entry.careerYearOperator==='Between'?`–${entry.careerYearSecondValue??''}`:''}`)
    if(entry.dayOfWeek!=='Any')labels.push(DAY_OPTIONS[Number(entry.dayOfWeek)] ?? entry.dayOfWeek)
    if(entry.month!=='Any')labels.push(MONTH_OPTIONS[Number(entry.month)-1] ?? entry.month)
    if(entry.specificDate)labels.push(formatMonthDay(entry.specificDate));if((entry.playoffRound??'Any')!=='Any')labels.push(`Playoff Round: ${NBA_PLAYOFF_ROUNDS.find(r=>r.value===entry.playoffRound)?.label??entry.playoffRound}`);if((entry.periodFilter??'Any')!=='Any')labels.push(entry.periodFilter!)
    if(entry.player!=='Any')labels.push(`Player: ${entry.player}`)
    if(entry.team!=='Any')labels.push(`Team: ${entry.team}`)
    if(entry.opponent!=='Any')labels.push(`Opponent: ${entry.opponent}`)
    if(entry.position!=='Any')labels.push(`Position: ${entry.position}`)
    if(entry.result!=='Any')labels.push(`Result: ${entry.result}`)
    return labels
  }
  const formatSearchedAt=(value:string)=>{
    const date=new Date(value)
    return Number.isNaN(date.getTime())?value:date.toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
  }
  return <section>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div className="max-w-3xl"><div className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">Local Search History</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Pick up where you <span className="text-cyan-300">left off.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Searches are stored only in this browser. Rerun an old search exactly as it was, or load it back into Stat Finder and adjust the filters first.</p></div>{entries.length>0&&<button onClick={onClear} className="rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-4 py-2.5 text-sm font-bold text-rose-200 hover:bg-rose-400/10">Clear history</button>}</div>
    {entries.length===0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-white/[.025] px-6 py-16 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-xl">↺</div><h2 className="mt-5 text-2xl font-black">No searches yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Run a search in Stat Finder and it will appear here automatically with its result count and rarity.</p><button onClick={onExplore} className="mt-6 rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">Explore search ideas</button></div> : <div className="space-y-4">{entries.map(entry=>{const filters=filterLabels(entry);return <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black uppercase tracking-widest text-cyan-300">{entry.sport} • {entry.searchType} • {entry.searchScope ?? 'Game'}</span><RarityBadge rarityKey={entry.rarityKey} label={entry.rarityLabel}/></div><div className="mt-2 text-2xl font-black">{entry.totalResults.toLocaleString()} {entry.totalResults===1?(entry.searchScope??'Game'):`${entry.searchScope??'Game'} Performances`} Found</div><div className="mt-1 text-xs text-slate-500">Searched {formatSearchedAt(entry.searchedAt)}</div>{entry.coverage&&<div className="mt-2 text-xs text-slate-500">Coverage: <span className="font-bold text-slate-300">{entry.coverage.startSeason} – {entry.coverage.endSeason}</span></div>}</div><button onClick={()=>onDelete(entry.id)} className="rounded-lg px-2.5 py-2 text-sm font-bold text-slate-500 hover:bg-rose-400/[.06] hover:text-rose-300" aria-label="Delete history entry">Delete</button></div><div className="mt-4 flex flex-wrap gap-2">{entry.conditions.map(condition=><span key={condition.statistic} className="rounded-lg bg-black/25 px-2.5 py-1.5 text-xs font-bold text-slate-300">{conditionLabel(entry,condition)}</span>)}{filters.map(label=><span key={label} className="rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5 text-xs font-semibold text-slate-400">{label}</span>)}{entry.conditions.length===0&&filters.length===0&&<span className="text-xs text-slate-500">No additional filters</span>}</div><div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>onRerun(entry)} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300">RERUN SEARCH</button><button onClick={()=>onEdit(entry)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">EDIT SEARCH</button></div></article>})}</div>}
  </section>
}

function SearchableFilter({value,onChange,options,placeholder,listId}:{value:string;onChange:(value:string)=>void;options:string[];placeholder:string;listId:string}) {
  const display=value==='Any'?'':value
  return <div className="relative"><input list={listId} value={display} onChange={e=>onChange(e.target.value.trim()===''?'Any':e.target.value)} onBlur={e=>{const v=e.target.value.trim(); if(!v) onChange('Any')}} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-3 py-3 pr-10 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"/><datalist id={listId}>{options.map(option=><option key={option} value={option}/>)}</datalist>{value!=='Any'&&<button type="button" onClick={()=>onChange('Any')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear filter">×</button>}</div>
}

function ActiveFilters({conditions,defs,gameStage,seasonOperator,seasonValue,seasonSecondValue,careerYearOperator,careerYearValue,careerYearSecondValue,dayOfWeek,month,specificDate,playoffRound,periodFilter,team,opponent,player,position,result,onClearStat,onClearGameStage,onClearSeason,onClearCareerYear,onClearDayOfWeek,onClearMonth,onClearSpecificDate,onClearPlayoffRound,onClearPeriodFilter,onClearTeam,onClearOpponent,onClearPlayer,onClearPosition,onClearResult}:{conditions:StatCondition[];defs:{key:string;label:string}[];gameStage:string;seasonOperator:string;seasonValue:string;seasonSecondValue:string;careerYearOperator:string;careerYearValue:string;careerYearSecondValue:string;dayOfWeek:string;month:string;specificDate:string;playoffRound:string;periodFilter:string;team:string;opponent:string;player:string;position:string;result:string;onClearStat:(stat:string)=>void;onClearGameStage:()=>void;onClearSeason:()=>void;onClearCareerYear:()=>void;onClearDayOfWeek:()=>void;onClearMonth:()=>void;onClearSpecificDate:()=>void;onClearPlayoffRound:()=>void;onClearPeriodFilter:()=>void;onClearTeam:()=>void;onClearOpponent:()=>void;onClearPlayer:()=>void;onClearPosition:()=>void;onClearResult:()=>void}) {
  const items:{label:string;clear:()=>void}[]=[]
  const opLabel:Record<string,string>={gte:'≥',eq:'=',lte:'≤',between:'Between'}
  for(const c of conditions){const label=defs.find(d=>d.key===c.statistic)?.label??c.statistic;items.push({label:`${label} ${opLabel[c.operator]??c.operator} ${c.value??''}${c.operator==='between'?`–${c.secondValue??''}`:''}`,clear:()=>onClearStat(c.statistic)})}
  if(gameStage!=='Any')items.push({label:gameStage,clear:onClearGameStage})
  if(seasonOperator!=='Any')items.push({label:`Season ${seasonOperator} ${seasonValue}${seasonOperator==='Between'?`–${seasonSecondValue}`:''}`,clear:onClearSeason})
  if(careerYearOperator!=='Any')items.push({label:`Career Year ${careerYearOperator} ${careerYearValue}${careerYearOperator==='Between'?`–${careerYearSecondValue}`:''}`,clear:onClearCareerYear})
  if(dayOfWeek!=='Any')items.push({label:`Day: ${DAY_OPTIONS[Number(dayOfWeek)] ?? dayOfWeek}`,clear:onClearDayOfWeek})
  if(month!=='Any')items.push({label:`Month: ${MONTH_OPTIONS[Number(month)-1] ?? month}`,clear:onClearMonth})
  if(specificDate)items.push({label:`Date: ${formatMonthDay(specificDate)}`,clear:onClearSpecificDate});if(playoffRound!=='Any')items.push({label:`Playoff Round: ${NBA_PLAYOFF_ROUNDS.find(r=>r.value===playoffRound)?.label??playoffRound}`,clear:onClearPlayoffRound});if(periodFilter!=='Any')items.push({label:periodFilter,clear:onClearPeriodFilter})
  if(team!=='Any')items.push({label:`Team: ${team}`,clear:onClearTeam});if(opponent!=='Any')items.push({label:`Opponent: ${opponent}`,clear:onClearOpponent});if(player!=='Any')items.push({label:`Player: ${player}`,clear:onClearPlayer});if(position!=='Any')items.push({label:`Position: ${position}`,clear:onClearPosition});if(result!=='Any')items.push({label:`Result: ${result}`,clear:onClearResult})
  if(!items.length)return null
  return <div className="mt-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Active filters</div><div className="flex flex-wrap gap-2">{items.map((item,i)=><button type="button" key={`${item.label}-${i}`} onClick={item.clear} title="Clear this filter" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-rose-400/30 hover:text-white">{item.label} <span className="ml-1 text-slate-500">×</span></button>)}</div></div>
}

function ResultCard({ record, conditions, defs, closestInfo, sortBy, sortLabel, onOpen }: { record: GameRecord; conditions: StatCondition[]; defs: { key: string; label: string }[]; closestInfo?: ClosestPerformance; sortBy: string; sortLabel: string; onOpen: (record: GameRecord) => void }) {
  const scope=record.scope ?? 'Game'
  const sortValue = sortBy === 'date' ? record.date : sortBy === 'entity' ? record.entityName : sortBy === 'team' ? record.team : sortBy === 'opponent' ? record.opponent : sortBy === 'season' ? record.season : sortBy === 'result' ? record.result : record.stats[sortBy]
  const careerYearText=record.careerYear?` • Career Year ${record.careerYear}`:'';const subtitle=scope==='Game' ? `${record.team} vs ${record.opponent} • ${record.date} • ${record.season}${careerYearText}` : scope==='Season' ? `${record.team} • ${record.season}${careerYearText} • ${record.gamesPlayed ?? record.stats.gamesPlayed ?? '—'} games` : `${record.team} • ${record.season} • ${record.seasonsPlayed ?? record.stats.seasonsPlayed ?? '—'} seasons • ${record.gamesPlayed ?? record.stats.gamesPlayed ?? '—'} games`
  return <button type="button" onClick={() => onOpen(record)} className="group w-full rounded-2xl border border-white/8 bg-black/20 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[.05] focus:outline-none focus:ring-2 focus:ring-cyan-400/60 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-lg font-bold"><span>{record.entityName}</span><span className="text-sm text-cyan-300 opacity-0 transition group-hover:opacity-100">View details →</span></div><div className="mt-1 text-sm text-slate-400">{subtitle}</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="inline-flex rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{scope}{scope!=='Game'?` • ${record.stageLabel ?? record.gameStage}`:''}</span>{closestInfo && <span className="inline-flex rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300">{closestInfo.similarity}% similarity • {closestInfo.conditionsMet}/{closestInfo.conditionCount} met</span>}</div></div>{scope==='Game'?<div className={`rounded-full px-3 py-1 text-xs font-bold ${record.result === 'W' ? 'bg-emerald-400/10 text-emerald-300' : record.result === 'D' ? 'bg-amber-400/10 text-amber-300' : 'bg-rose-400/10 text-rose-300'}`}>{record.result} • {record.finalScore}</div>:<div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">{scope==='Season'?record.season:'Career'}</div>}</div>
    {sortBy !== 'date' && <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[.06] px-3 py-2 text-sm"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Sorted by {sortLabel}</span><span className="font-black text-cyan-200">{sortValue ?? '—'}</span></div>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{conditions.map(c => { const actual=record.stats[c.statistic]; const met=matchesCondition(actual,c); const explanation=closestInfo?.explanations.find(item=>item.statistic===c.statistic); return <div key={c.statistic} className="rounded-xl bg-white/[.045] px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{defs.find(d=>d.key===c.statistic)?.label}</div><div className="mt-0.5 flex items-center gap-2 font-bold"><span>{actual ?? '—'}</span>{closestInfo && <span className={met?'text-emerald-300':'text-rose-300'}>{met?'✓':'✕'}</span>}</div>{closestInfo && explanation && <div className={`mt-1 text-[11px] leading-4 ${explanation.met?'text-emerald-300/80':'text-rose-300/80'}`}>{explanation.met ? `Met ${explanation.targetText}` : explanation.missText}</div>}</div> })}</div>
  </button>
}

function RarityBadge({ rarityKey, label }: { rarityKey:RarityKey; label:string }) {
  const classes:Record<RarityKey,string>={never:'border-amber-400/25 bg-amber-400/10 text-amber-300',oneOfOne:'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300',extremelyRare:'border-violet-400/25 bg-violet-400/10 text-violet-300',rare:'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',uncommon:'border-sky-400/20 bg-sky-400/[.08] text-sky-300',common:'border-white/10 bg-white/5 text-slate-300'}
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black tracking-[.12em] ${classes[rarityKey]}`}>{label}</span>
}

function PerformanceDetails({ record, conditions, defs, hasBoxScore, onOpenBoxScore, onClose }: { record: GameRecord; conditions: StatCondition[]; defs: { key:string; label:string; section?:string }[]; hasBoxScore:boolean; onOpenBoxScore:()=>void; onClose:()=>void }) {
  const scope=record.scope ?? 'Game'
  const statEntries=Object.entries(record.stats).map(([key,value])=>({key,value,label:defs.find(d=>d.key===key)?.label ?? formatStatKey(key)})).sort((a,b)=>a.label.localeCompare(b.label))
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm md:items-center md:p-6" onMouseDown={onClose}><section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1424] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl md:p-7" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true">
    <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{scope} Performance Details</div><h2 className="mt-2 text-2xl font-black md:text-3xl">{record.entityName}</h2><p className="mt-1 text-sm text-slate-400">{record.sport} • {record.searchType} • {scope}</p></div><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-xl text-slate-400 hover:bg-white/10">×</button></div>
    {scope==='Game'?<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><DetailTile label="Matchup" value={`${record.team} vs ${record.opponent}`} /><DetailTile label="Date" value={record.date} />{record.careerYear&&<DetailTile label="Career Year" value={String(record.careerYear)}/>}<DetailTile label="Season Type" value={record.gameStage} /><DetailTile label="Location" value={record.homeAway} /><DetailTile label="Final" value={`${record.result} • ${record.finalScore}`} /></div>:<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DetailTile label={scope==='Season'?'Season':'Career Span'} value={record.season}/>{record.careerYear&&<DetailTile label="Career Year" value={String(record.careerYear)}/>}<DetailTile label="Team(s)" value={record.team}/><DetailTile label="Games" value={String(record.gamesPlayed ?? record.stats.gamesPlayed ?? '—')}/><DetailTile label="Competition" value={record.stageLabel ?? record.gameStage}/></div>}
    {scope==='Game'&&<button disabled={!hasBoxScore} onClick={onOpenBoxScore} className="mt-5 flex w-full items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-400/[.07] px-4 py-4 text-left transition enabled:hover:border-cyan-400/40 enabled:hover:bg-cyan-400/[.11] disabled:cursor-not-allowed disabled:opacity-40"><div><div className="font-black text-cyan-200">VIEW GAME BOX SCORE</div><div className="mt-1 text-xs text-slate-400">Team comparison + player stats for both teams</div></div><span className="text-xl text-cyan-300">→</span></button>}
    {conditions.length>0 && <div className="mt-7"><h3 className="text-sm font-bold uppercase tracking-[.16em] text-slate-400">Your Search Conditions</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{conditions.map(c=>{const actual=record.stats[c.statistic];const met=matchesCondition(actual,c);return <div key={c.statistic} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-3"><span className="text-sm text-slate-400">{defs.find(d=>d.key===c.statistic)?.label ?? formatStatKey(c.statistic)}</span><span className={`font-bold ${met?'text-emerald-300':'text-rose-300'}`}>{actual ?? '—'} {met?'✓':'✕'}</span></div>})}</div></div>}
    <div className="mt-7"><h3 className="text-sm font-bold uppercase tracking-[.16em] text-slate-400">Complete Available Stat Line</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{statEntries.map(stat=><div key={stat.key} className="rounded-xl border border-white/8 bg-white/[.035] px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</div><div className="mt-1 text-xl font-black">{stat.value}</div></div>)}</div></div>
  </section></div>
}

function BoxScoreDetails({ boxScore, onBack, onClose }: { boxScore:GameBoxScore; onBack:()=>void; onClose:()=>void }) {
  const [tab,setTab]=useState<'teams'|'players'>('teams')
  const [teamFilter,setTeamFilter]=useState<'Both'|string>('Both')
  const players=boxScore.playerStats.filter(p=>teamFilter==='Both'||p.team===teamFilter)
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/90 p-0 backdrop-blur-sm md:items-center md:p-6" onMouseDown={onClose}><section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#08111f] p-5 shadow-2xl md:max-w-5xl md:rounded-3xl md:p-7" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true">
    <div className="flex items-start justify-between gap-4"><div><button onClick={onBack} className="mb-3 text-sm font-bold text-cyan-300 hover:text-cyan-200">← Performance</button><div className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">Game Box Score • {boxScore.gameStage}</div><h2 className="mt-2 text-2xl font-black md:text-3xl">{boxScore.awayTeam} {boxScore.awayScore} <span className="text-slate-600">at</span> {boxScore.homeTeam} {boxScore.homeScore}</h2><p className="mt-1 text-sm text-slate-400">{boxScore.date} • {boxScore.season}</p></div><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-xl text-slate-400 hover:bg-white/10">×</button></div>
    <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1.5"><button onClick={()=>setTab('teams')} className={pill(tab==='teams')}>Team Stats</button><button onClick={()=>setTab('players')} className={pill(tab==='players')}>Player Stats</button></div>
    {tab==='teams' ? <TeamBoxScore boxScore={boxScore}/> : <div className="mt-5"><div className="mb-4 flex flex-wrap gap-2">{['Both',boxScore.awayTeam,boxScore.homeTeam].map(team=><button key={team} onClick={()=>setTeamFilter(team)} className={pill(teamFilter===team)}>{team}</button>)}</div><PlayerBoxScore players={players} sport={boxScore.sport}/></div>}
    <div className="mt-6 rounded-xl border border-cyan-400/10 bg-cyan-400/[.04] px-4 py-3 text-xs leading-5 text-slate-500">NBA box scores come from the ingested NBA Stats data. NFL box scores come from the ingested historical NFL data for 1970–1998 and nflverse weekly player/team statistics from 1999 onward.</div>
  </section></div>
}

function TeamBoxScore({ boxScore }: { boxScore:GameBoxScore }) {
  const keys=Array.from(new Set(boxScore.teamStats.flatMap(t=>Object.keys(t.stats))))
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Statistic</th>{boxScore.teamStats.map(t=><th key={t.team} className="px-3 py-3 text-right">{t.team}</th>)}</tr></thead><tbody>{keys.map(key=><tr key={key} className="border-b border-white/[.06]"><td className="px-3 py-3 font-semibold text-slate-300">{formatStatKey(key)}</td>{boxScore.teamStats.map(t=><td key={t.team} className="px-3 py-3 text-right font-bold">{t.stats[key] ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

function PlayerBoxScore({ players, sport }: { players:GameBoxScore['playerStats']; sport:Sport }) {
  const preferred = sport==='NBA' ? ['minutes','points','rebounds','assists','steals','blocks','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','turnovers'] : ['passingYards','passingTouchdowns','interceptions','rushingYards','rushingTouchdowns','receptions','receivingYards','receivingTouchdowns','sacks']
  const keys=preferred.filter(key=>players.some(p=>key in p.stats))
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="sticky left-0 bg-[#08111f] px-3 py-3">Player</th><th className="px-3 py-3">Team</th><th className="px-3 py-3">Pos</th>{keys.map(k=><th key={k} className="px-3 py-3 text-right">{shortStat(k)}</th>)}</tr></thead><tbody>{players.map(p=><tr key={p.id} className="border-b border-white/[.06]"><td className="sticky left-0 bg-[#08111f] px-3 py-3 font-bold">{p.name}</td><td className="px-3 py-3 text-slate-400">{p.team}</td><td className="px-3 py-3 text-slate-400">{p.position}</td>{keys.map(k=><td key={k} className="px-3 py-3 text-right font-semibold">{p.stats[k] ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

function DetailTile({ label, value }: { label:string; value:string }) { return <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-sm font-bold text-slate-200">{value}</div></div> }
function formatStatKey(key:string){return key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function shortStat(key:string){const labels:Record<string,string>={minutes:'MIN',points:'PTS',rebounds:'REB',assists:'AST',steals:'STL',blocks:'BLK',fieldGoalsMade:'FGM',fieldGoalsAttempted:'FGA',threePointersMade:'3PM',turnovers:'TOV',passingYards:'PASS YDS',passingTouchdowns:'PASS TD',interceptions:'INT',rushingYards:'RUSH YDS',rushingTouchdowns:'RUSH TD',receptions:'REC',receivingYards:'REC YDS',receivingTouchdowns:'REC TD',sacks:'SACK'};return labels[key]??formatStatKey(key)}
