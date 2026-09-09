import { useEffect, useState } from 'react'
import { getNbaQa, type NbaQaReport } from '../services/nbaApi'
import { getNflQa, type NflQaReport } from '../services/nflApi'

function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string | number
  note?: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black">
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </div>

      {note && (
        <div className="mt-1 text-xs leading-5 text-slate-500">
          {note}
        </div>
      )}
    </div>
  )
}

export function DataQaPage() {
  const [league, setLeague] = useState<'NBA' | 'NFL'>('NBA')
  const [nba, setNba] = useState<NbaQaReport | null>(null)
  const [nfl, setNfl] = useState<NflQaReport | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError('')

    const task =
      league === 'NBA'
        ? getNbaQa().then(setNba)
        : getNflQa().then(setNfl)

    task
      .catch(e =>
        setError(
          e instanceof Error
            ? e.message
            : 'QA lookup failed',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [league])

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Data Quality
          </div>

          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Know what the database{' '}
            <span className="text-cyan-300">
              actually contains.
            </span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
            Review inventory, linkage health, coverage boundaries,
            and stat-field presence before making historical claims.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          {loading ? 'Checking…' : 'Refresh QA'}
        </button>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-white/[.035] p-1">
        {(['NBA', 'NFL'] as const).map(x => (
          <button
            key={x}
            onClick={() => setLeague(x)}
            className={`rounded-lg px-5 py-2 text-sm font-black ${
              league === x
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[.06] p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {league === 'NBA' && nba && (
        <NbaReport report={nba} />
      )}

      {league === 'NFL' && nfl && (
        <NflReport report={nfl} />
      )}
    </div>
  )
}

function NbaReport({
  report,
}: {
  report: NbaQaReport
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="NBA Games"
          value={report.overview.games}
        />

        <Metric
          label="Seasons"
          value={report.overview.seasons}
          note={`${report.overview.earliestSeason} – ${report.overview.latestSeason}`}
        />

        <Metric
          label="Playable Player Games"
          value={report.overview.playedPlayerGames}
        />

        <Metric
          label="Team Game Rows"
          value={report.overview.teamGames}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Integrity Checks
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Games without 2 team rows"
            value={report.integrity.gamesMissingTwoTeamRows}
          />

          <Metric
            label="Games without player rows"
            value={report.integrity.gamesWithoutPlayerRows}
          />

          <Metric
            label="Games without played players"
            value={report.integrity.gamesWithoutPlayedPlayers}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Season Inventory
          </div>

          <div className="mt-4 max-h-[540px] overflow-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-[#0b1424]">
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-3">Season</th>
                  <th className="px-2 py-3 text-right">Games</th>
                  <th className="px-2 py-3 text-right">Regular</th>
                  <th className="px-2 py-3 text-right">Playoffs</th>
                  <th className="px-2 py-3 text-right">Played rows</th>
                </tr>
              </thead>

              <tbody>
                {report.seasons.map(row => (
                  <tr
                    key={row.season}
                    className="border-b border-white/[.06]"
                  >
                    <td className="px-2 py-2.5 font-bold">
                      {row.season}
                    </td>

                    <td className="px-2 py-2.5 text-right">
                      {row.games.toLocaleString()}
                    </td>

                    <td className="px-2 py-2.5 text-right text-slate-400">
                      {row.regularSeason.toLocaleString()}
                    </td>

                    <td className="px-2 py-2.5 text-right text-slate-400">
                      {row.playoffs.toLocaleString()}
                    </td>

                    <td className="px-2 py-2.5 text-right text-slate-400">
                      {row.playedPlayerGames.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Coverage Registry
          </div>

          <h2 className="mt-1 text-xl font-black">
            Earliest searchable seasons
          </h2>

          <div className="mt-4 space-y-2">
            {report.coverage.player.map(rule => (
              <div
                key={rule.statistic}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"
              >
                <span className="text-sm text-slate-400">
                  {rule.label}
                </span>

                <span className="text-sm font-black text-cyan-300">
                  {rule.startSeason}+
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function NflReport({
  report,
}: {
  report: NflQaReport
}) {
  const healthy =
    report.integrity.gamesMissingTwoTeamRows === 0 &&
    report.integrity.gamesWithoutPlayerRows === 0

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="NFL Games"
          value={report.overview.games}
        />

        <Metric
          label="Seasons"
          value={report.overview.seasons}
          note={`${report.overview.earliestSeason} – ${report.overview.latestSeason}`}
        />

        <Metric
          label="Player Game Rows"
          value={report.overview.playerGames}
        />

        <Metric
          label="Team Game Rows"
          value={report.overview.teamGames}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Integrity Checks
            </div>

            <h2 className="mt-1 text-xl font-black">
              NFL linkage health
            </h2>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-black ${
              healthy
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-amber-400/10 text-amber-300'
            }`}
          >
            {healthy
              ? 'TEAM LINKAGE COMPLETE'
              : 'REVIEW FLAGS'}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Games without 2 team rows"
            value={report.integrity.gamesMissingTwoTeamRows}
            note="Every NFL game should have one row for each team."
          />

          <Metric
            label="Unexpected team gaps"
            value={report.integrity.unexpectedTeamGaps}
            note="Any value above zero should be investigated."
          />

          <Metric
            label="Games without player rows"
            value={report.integrity.gamesWithoutPlayerRows}
            note="Some historical or source-limited games may lack player-level data."
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.05] p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          Coverage Boundaries
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Historical coverage"
            value={`${report.overview.earliestSeason}+`}
            note="Core NFL searches use historical game-level data beginning in 1970, with field availability varying by statistic."
          />

          <Metric
            label="Standardized nflverse stats"
            value={`${report.coverage.standardizedStartSeason}+`}
            note="Standardized nflverse weekly player/team statistics begin in 1999."
          />

          <Metric
            label="PFR advanced stats"
            value={`${report.coverage.advancedStartSeason}+`}
            note="Available through nflreadpy, but not yet mixed into core historical filters because coverage is narrower."
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Season Inventory
        </div>

        <div className="mt-4 max-h-[540px] overflow-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="sticky top-0 bg-[#0b1424]">
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-3">Season</th>
                <th className="px-2 py-3 text-right">Games</th>
                <th className="px-2 py-3 text-right">Regular</th>
                <th className="px-2 py-3 text-right">Playoffs</th>
                <th className="px-2 py-3 text-right">Player rows</th>
                <th className="px-2 py-3 text-right">Team rows</th>
              </tr>
            </thead>

            <tbody>
              {report.seasons.map(row => (
                <tr
                  key={row.season}
                  className="border-b border-white/[.06]"
                >
                  <td className="px-2 py-2.5 font-bold">
                    {row.season}
                  </td>

                  <td className="px-2 py-2.5 text-right">
                    {row.games.toLocaleString()}
                  </td>

                  <td className="px-2 py-2.5 text-right text-slate-400">
                    {row.regularSeason.toLocaleString()}
                  </td>

                  <td className="px-2 py-2.5 text-right text-slate-400">
                    {row.playoffs.toLocaleString()}
                  </td>

                  <td className="px-2 py-2.5 text-right text-slate-400">
                    {row.playerRows.toLocaleString()}
                  </td>

                  <td className="px-2 py-2.5 text-right text-slate-400">
                    {row.teamRows.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Presence
          title="Player-field presence"
          rows={report.coverage.playerPresence}
        />

        <Presence
          title="Team-field presence"
          rows={report.coverage.teamPresence}
        />
      </div>

      <div className="mt-4 text-xs leading-5 text-slate-600">
        {report.coverage.note} Generated{' '}
        {new Date(report.generatedAt).toLocaleString()}.
      </div>
    </>
  )
}

function Presence({
  title,
  rows,
}: {
  title: string
  rows: {
    statistic: string
    label: string
    firstSeason: string | null
    rowsWithData: number
  }[]
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </div>

      <div className="mt-4 space-y-2">
        {rows.map(row => (
          <div
            key={row.statistic}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-black/20 px-3 py-2"
          >
            <span className="text-sm text-slate-400">
              {row.label}
            </span>

            <span className="text-right text-xs">
              <strong className="text-cyan-300">
                {row.firstSeason ?? '—'}
              </strong>

              <span className="ml-2 text-slate-600">
                {row.rowsWithData.toLocaleString()} rows
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}