import { useFarm } from '../context/FarmContext'
import { formatMoney, lineagePnl, lotAgeDays, originLot } from '../lib/calc'

export default function ReportsPage() {
  const { state } = useFarm()
  const lineageIds = [...new Set(state.lots.map((l) => l.lineageId))]

  const rows = lineageIds.map((lineageId) => {
    const members = state.lots.filter((l) => l.lineageId === lineageId)
    const origin = originLot(state.lots, lineageId)
    const destete = members.find((l) => l.stage === 'destete')
    const engorde = members.find((l) => l.stage === 'engorde')
    const pnl = lineagePnl(state.lots, state.events, lineageId)
    const live = engorde ?? destete
    return {
      lineageId,
      name: origin?.name ?? live?.name ?? 'Cepa',
      desteteHeads: destete?.currentHeadcount ?? 0,
      engordeHeads: engorde?.currentHeadcount ?? 0,
      age: live ? lotAgeDays(live.entryDate, live.ageAtEntryDays) : 0,
      pnl,
      purchase: origin?.purchaseCost ?? 0,
    }
  })

  return (
    <section>
      <div className="mb-6">
        <p className="chip mb-2">Linaje</p>
        <h2 className="font-display text-4xl">Reportes por cepa</h2>
        <p className="mt-2 max-w-xl text-[var(--muted)]">
          Cada fila es una cepa desde destete hasta engorde: precio de entrada, costos de patio y
          beneficio.
        </p>
      </div>
      <div className="surface overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Cepa</th>
              <th className="px-4 py-3">Destete</th>
              <th className="px-4 py-3">Engorde</th>
              <th className="px-4 py-3">Compra</th>
              <th className="px-4 py-3">Patio destete</th>
              <th className="px-4 py-3">Patio engorde</th>
              <th className="px-4 py-3">Venta</th>
              <th className="px-4 py-3">Beneficio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lineageId} className="border-t border-[var(--line)]">
                <td className="px-4 py-3 font-semibold">{row.name}</td>
                <td className="px-4 py-3">{row.desteteHeads}</td>
                <td className="px-4 py-3">{row.engordeHeads}</td>
                <td className="px-4 py-3">{formatMoney(row.purchase, state.currency)}</td>
                <td className="px-4 py-3">{formatMoney(row.pnl.destetePatio, state.currency)}</td>
                <td className="px-4 py-3">{formatMoney(row.pnl.engordePatio, state.currency)}</td>
                <td className="px-4 py-3">
                  {row.pnl.revenue > 0
                    ? formatMoney(row.pnl.revenue, state.currency)
                    : formatMoney(row.pnl.projected, state.currency)}
                </td>
                <td className="px-4 py-3">
                  {formatMoney(
                    row.pnl.revenue > 0 ? row.pnl.benefit : row.pnl.projected - row.pnl.totalCost,
                    state.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-[var(--muted)]">Todavía no hay cepas para comparar.</p>
        )}
      </div>
    </section>
  )
}
