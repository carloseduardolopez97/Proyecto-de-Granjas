import { useMemo, useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { useFarm } from '../context/FarmContext'
import {
  feedCostPerKg,
  feedNativeStock,
  feedNativeUnit,
  feedStockKg,
  feedUnitPrice,
  formatMoney,
  formatQty,
  todayIso,
} from '../lib/calc'
import type { FeedStorage } from '../lib/types'

export default function FeedPage() {
  const { state, addFeed, addFeedEntry } = useFarm()
  const [openFeed, setOpenFeed] = useState(false)
  const [entryFeedId, setEntryFeedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = state.feeds.find((f) => f.id === entryFeedId)

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-2">Bodega</p>
          <h2 className="font-display text-4xl">Alimento</h2>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Cada alimento se guarda en saco o en silo. Según eso, la compra se registra en sacos o
            en quintales (qq).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => setOpenFeed(true)}>
            Nuevo alimento
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setEntryFeedId(state.feeds[0].id)}
            disabled={state.feeds.length === 0}
          >
            Registrar entrada
          </button>
        </div>
      </div>

      {state.feeds.length === 0 ? (
        <div className="surface rounded-3xl p-8 text-[var(--muted)]">
          Aún no hay alimentos. Crea uno y elige si se almacena en saco o en silo.
        </div>
      ) : (
        <div className="grid gap-3">
          {state.feeds.map((feed) => {
            const native = feedNativeStock(feed)
            const unit = feedNativeUnit(feed)
            const low = feed.minStock > 0 && native <= feed.minStock
            return (
              <article key={feed.id} className="surface rounded-3xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">{feed.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {feed.storage === 'saco'
                        ? `Saco de ${feed.sackWeightKg} kg`
                        : `Silo · quintal de ${feed.quintalKg} kg`}
                    </p>
                  </div>
                  <span className="chip">{feed.storage === 'saco' ? 'Saco' : 'Silo'}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Mini label="Existencia" value={formatQty(native, unit)} />
                  <Mini label="Equivalente" value={formatQty(feedStockKg(feed), 'kg')} />
                  <Mini
                    label={feed.storage === 'saco' ? 'Precio / saco' : 'Precio / qq'}
                    value={formatMoney(feedUnitPrice(feed), state.currency)}
                  />
                  <Mini label="Costo / kg" value={formatMoney(feedCostPerKg(feed), state.currency)} />
                </div>
                {low && (
                  <p className="mt-3 text-sm text-[var(--clay)]">
                    Stock bajo: mínimo {formatQty(feed.minStock, unit)}.
                  </p>
                )}
                <button className="btn btn-ghost mt-4" onClick={() => setEntryFeedId(feed.id)}>
                  Registrar entrada
                </button>
              </article>
            )
          })}
        </div>
      )}

      {state.feedEntries.length > 0 && (
        <div className="surface mt-6 overflow-x-auto rounded-3xl">
          <h3 className="font-display px-4 pt-4 text-2xl">Entradas</h3>
          <table className="mt-2 w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Alimento</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Costo</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              {state.feedEntries.map((entry) => {
                const feed = state.feeds.find((f) => f.id === entry.feedId)
                return (
                  <tr key={entry.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3">{entry.date}</td>
                    <td className="px-4 py-3 font-semibold">{feed?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {feed
                        ? formatQty(entry.quantity, feedNativeUnit(feed))
                        : formatQty(entry.quantity)}
                    </td>
                    <td className="px-4 py-3">{formatMoney(entry.totalCost, state.currency)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{entry.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openFeed && (
        <NewFeedModal
          onClose={() => setOpenFeed(false)}
          onSave={(payload) => {
            addFeed(payload)
            setOpenFeed(false)
          }}
        />
      )}
      {entryFeedId && selected && (
        <FeedEntryModal
          feed={selected}
          feeds={state.feeds}
          currency={state.currency}
          error={error}
          onChangeFeed={setEntryFeedId}
          onClose={() => {
            setEntryFeedId(null)
            setError(null)
          }}
          onSave={(payload) => {
            const err = addFeedEntry(payload)
            if (err) {
              setError(err)
              return
            }
            setEntryFeedId(null)
            setError(null)
          }}
        />
      )}
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function NewFeedModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: {
    name: string
    storage: FeedStorage
    sackWeightKg: number
    quintalKg: number
    minStock: number
    notes: string
    unitPrice: number
  }) => void
}) {
  const [name, setName] = useState('')
  const [storage, setStorage] = useState<FeedStorage>('saco')
  const [sackWeightKg, setSack] = useState(40)
  const [quintalKg, setQq] = useState(50)
  const [minStock, setMin] = useState(0)
  const [notes, setNotes] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ name: name.trim(), storage, sackWeightKg, quintalKg, minStock, notes, unitPrice: 0 })
  }

  return (
    <Modal title="Nuevo alimento" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <fieldset>
          <legend className="label">Almacenamiento</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`btn ${storage === 'saco' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStorage('saco')}
            >
              Saco
            </button>
            <button
              type="button"
              className={`btn ${storage === 'silo' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStorage('silo')}
            >
              Silo
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {storage === 'saco'
              ? 'Las compras se registrarán en cantidad de sacos.'
              : 'Las compras se registrarán en quintales (qq) descargados al silo.'}
          </p>
        </fieldset>
        {storage === 'saco' ? (
          <label>
            <span className="label">Peso del saco (kg)</span>
            <input
              className="field"
              type="number"
              min={1}
              value={sackWeightKg}
              onChange={(e) => setSack(Number(e.target.value))}
            />
          </label>
        ) : (
          <label>
            <span className="label">Peso del quintal (kg)</span>
            <input
              className="field"
              type="number"
              min={1}
              value={quintalKg}
              onChange={(e) => setQq(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          <span className="label">Stock mínimo ({storage === 'saco' ? 'sacos' : 'qq'})</span>
          <input
            className="field"
            type="number"
            min={0}
            value={minStock}
            onChange={(e) => setMin(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">Notas</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          Guardar alimento
        </button>
      </form>
    </Modal>
  )
}

function FeedEntryModal({
  feed,
  feeds,
  currency,
  error,
  onChangeFeed,
  onClose,
  onSave,
}: {
  feed: ReturnType<typeof useFarm>['state']['feeds'][number]
  feeds: ReturnType<typeof useFarm>['state']['feeds']
  currency: string
  error: string | null
  onChangeFeed: (id: string) => void
  onClose: () => void
  onSave: (payload: {
    feedId: string
    date: string
    quantity: number
    totalCost: number
    notes: string
  }) => void
}) {
  const [date, setDate] = useState(todayIso())
  const [quantity, setQuantity] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [notes, setNotes] = useState('')
  const kg = useMemo(() => {
    if (feed.storage === 'saco') return quantity * feed.sackWeightKg
    return quantity * feed.quintalKg
  }, [feed, quantity])

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ feedId: feed.id, date, quantity, totalCost, notes })
  }

  return (
    <Modal title="Entrada de alimento" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <label>
          <span className="label">Alimento</span>
          <select className="field" value={feed.id} onChange={(e) => onChangeFeed(e.target.value)}>
            {feeds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.storage === 'saco' ? 'saco' : 'silo'})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Fecha</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span className="label">
            {feed.storage === 'saco' ? 'Sacos comprados' : 'Quintales comprados (qq)'}
          </span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          Equivale a {formatQty(kg, 'kg')}
          {quantity > 0 && totalCost > 0
            ? ` · ${formatMoney(totalCost / quantity, currency)} por ${feed.storage === 'saco' ? 'saco' : 'qq'}`
            : ''}
        </p>
        <label>
          <span className="label">Costo total de la compra</span>
          <input
            className="field"
            type="number"
            min={0}
            value={totalCost}
            onChange={(e) => setTotalCost(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">Notas</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          Sumar al inventario
        </button>
      </form>
    </Modal>
  )
}
