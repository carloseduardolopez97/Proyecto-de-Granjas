import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FeedPriceFields, { pesosFromFields } from '../components/FeedPriceFields'
import FeedStorageFields from '../components/FeedStorageFields'
import { ClearFiltersButton, FilterField, HistoryFilterBar, inDateRange, uniqueSorted } from '../components/HistoryFilters'
import Modal, { afterSaveReadyForNext, SavedNotice } from '../components/Modal'
import { useFeed, type FeedPurchaseInput } from '../context/FeedContext'
import { feedStorageLabel, formatDop, formatDopUnit, formatUsd, todayIso } from '../lib/calc'
import type { FeedCurrency, FeedProduct, FeedPurchase, FeedStorage } from '../lib/types'
import { useQuickAdd } from '../lib/quickAdd'

export default function FeedPage() {
  const { state, addPurchase, updatePurchase, deletePurchase } = useFeed()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FeedPurchase | null>(null)
  const [removing, setRemoving] = useState<FeedPurchase | null>(null)
  const [feedFilter, setFeedFilter] = useState('')
  const [storageFilter, setStorageFilter] = useState<FeedStorage | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useQuickAdd({
    compra: () => {
      setEditing(null)
      setFormOpen(true)
    },
  })

  const rows = useMemo(
    () =>
      [...state.purchases].sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNumber.localeCompare(a.invoiceNumber)),
    [state.purchases],
  )
  const feedOptions = useMemo(
    () => uniqueSorted([...rows.map((row) => row.feedName), ...state.products.map((item) => item.name)]),
    [rows, state.products],
  )
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!feedFilter || row.feedName === feedFilter) &&
          (!storageFilter || row.storage === storageFilter) &&
          inDateRange(row.date, fromDate, toDate),
      ),
    [rows, feedFilter, fromDate, toDate, storageFilter],
  )
  const filteredQq = useMemo(() => visibleRows.reduce((sum, row) => sum + row.quantityQq, 0), [visibleRows])
  const filteredCost = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.quantityQq * row.pricePerQq, 0),
    [visibleRows],
  )
  const totalQq = useMemo(() => rows.reduce((sum, row) => sum + row.quantityQq, 0), [rows])
  const totalCost = useMemo(() => rows.reduce((sum, row) => sum + row.quantityQq * row.pricePerQq, 0), [rows])
  const qqByFeed = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; qq: number; cost: number; siloQq: number; sacoQq: number }
    >()
    for (const product of state.products) {
      map.set(product.id, { key: product.id, name: product.name, qq: 0, cost: 0, siloQq: 0, sacoQq: 0 })
    }
    for (const row of rows) {
      const key = row.feedId || row.feedName
      const cost = row.quantityQq * row.pricePerQq
      const current = map.get(key) ?? { key, name: row.feedName, qq: 0, cost: 0, siloQq: 0, sacoQq: 0 }
      current.qq += row.quantityQq
      current.cost += cost
      if (row.storage === 'silo') current.siloQq += row.quantityQq
      else current.sacoQq += row.quantityQq
      map.set(key, current)
    }
    for (const use of state.uses ?? []) {
      const key = use.feedId || use.feedName
      const current = map.get(key)
      if (!current) continue
      current.qq = Number((current.qq - use.quantityQq).toFixed(4))
      current.cost = Math.max(0, current.cost - (use.cost || 0))
      if (use.storage === 'silo') current.siloQq = Number((current.siloQq - use.quantityQq).toFixed(4))
      else current.sacoQq = Number((current.sacoQq - use.quantityQq).toFixed(4))
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [rows, state.products, state.uses])

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-3">Compras</p>
          <h2 className="font-display text-4xl">Registro de alimento</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Anota la fecha, el número de factura, cuántos QQ llegaron, si van a silo o a sacos, y el precio. Ese
            precio y el almacenamiento quedan fijos en el historial.
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={state.products.length === 0}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          Registrar compra
        </button>
      </div>

      {state.products.length === 0 && (
        <div className="mb-6 rounded-3xl border border-[var(--clay)] bg-[var(--clay-soft)] p-4">
          <p className="text-sm">
            Primero crea un alimento en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>{' '}
            (la tuerca), con nombre y precio por QQ.
          </p>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <HoverStat label="QQ comprados" value={formatQq(totalQq)} breakdown={qqByFeed.filter((row) => row.qq > 0)} />
        <Stat label="Costo de compras" value={formatDop(totalCost)} />
      </div>

      <h3 className="font-display mb-3 text-2xl">QQ por alimento</h3>
      {qqByFeed.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">Cuando registres un alimento, aquí verás cuántos QQ tiene cada tipo.</p>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {qqByFeed.map((row) => {
            const selected = feedFilter === row.name
            return (
            <button
              key={row.key}
              type="button"
              className={`surface rounded-3xl p-4 text-left ${
                selected ? 'ring-2 ring-[var(--moss)]' : ''
              }`}
              onClick={() => {
                setFeedFilter(row.name)
                historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <h4 className="font-display text-2xl">{row.name}</h4>
              <p className="mt-2 text-sm text-[var(--muted)]">QQ disponibles</p>
              <p className="font-display text-3xl">{formatQq(row.qq)}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Silo {formatQq(row.siloQq)} QQ · Sacos {formatQq(row.sacoQq)} QQ
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">Costo</p>
              <p className="font-display text-2xl">{formatDop(row.cost)}</p>
            </button>
            )
          })}
        </div>
      )}

      <div ref={historyRef} className="surface overflow-x-auto rounded-3xl p-5">
        <h3 className="font-display text-2xl">Historial</h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">Aún no hay compras de alimento.</p>
        ) : (
          <>
            <HistoryFilterBar>
              <FilterField label="Alimento">
                <select className="field" value={feedFilter} onChange={(e) => setFeedFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {feedOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Almacenamiento">
                <select
                  className="field"
                  value={storageFilter}
                  onChange={(e) => setStorageFilter((e.target.value || '') as FeedStorage | '')}
                >
                  <option value="">Todos</option>
                  <option value="silo">Silo</option>
                  <option value="saco">Sacos</option>
                </select>
              </FilterField>
              <FilterField label="Desde">
                <input className="field" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </FilterField>
              <FilterField label="Hasta">
                <input className="field" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </FilterField>
              <ClearFiltersButton
                disabled={!feedFilter && !storageFilter && !fromDate && !toDate}
                onClick={() => {
                  setFeedFilter('')
                  setStorageFilter('')
                  setFromDate('')
                  setToDate('')
                }}
              />
            </HistoryFilterBar>
            {visibleRows.length === 0 ? (
              <p className="mt-3 text-[var(--muted)]">Ninguna compra coincide con esos filtros.</p>
            ) : (
          <table className="mt-4 w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
              <tr>
                <th className="pb-2 font-semibold">Fecha</th>
                <th className="pb-2 font-semibold">Factura</th>
                <th className="pb-2 font-semibold">Alimento</th>
                <th className="pb-2 font-semibold">Almacenamiento</th>
                <th className="pb-2 font-semibold">Cantidad</th>
                <th className="pb-2 font-semibold">Precio / QQ</th>
                <th className="pb-2 font-semibold">Total</th>
                <th className="pb-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="py-3">{row.date}</td>
                  <td className="py-3">{row.invoiceNumber}</td>
                  <td className="py-3">{row.feedName}</td>
                  <td className="py-3">{feedStorageLabel(row.storage)}</td>
                  <td className="py-3">{row.quantityQq} QQ</td>
                  <td className="py-3">
                    <div>{formatDopUnit(row.pricePerQq)}</div>
                    {row.priceCurrency === 'USD' && row.usdAmount != null && row.usdRate ? (
                      <div className="text-xs text-[var(--muted)]">
                        {formatUsd(row.usdAmount)} · tasa {formatDop(row.usdRate)}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3">{formatDop(row.quantityQq * row.pricePerQq)}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label="Editar"
                        onClick={() => {
                          setEditing(row)
                          setFormOpen(true)
                        }}
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton label="Eliminar" onClick={() => setRemoving(row)}>
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--line)]">
                <td className="py-3 font-semibold" colSpan={4}>
                  Total
                </td>
                <td className="py-3 font-semibold">{formatQq(filteredQq)} QQ</td>
                <td className="py-3 font-semibold">
                  {filteredQq > 0 ? `${formatDopUnit(filteredCost / filteredQq)} / QQ` : '—'}
                </td>
                <td className="py-3 font-semibold">{formatDop(filteredCost)}</td>
                <td className="py-3" />
              </tr>
            </tfoot>
          </table>
            )}
          </>
        )}
      </div>

      {formOpen && (
        <FeedPurchaseForm
          title={editing ? 'Editar compra' : 'Registrar compra'}
          products={state.products}
          lastUsdRate={state.lastUsdRate}
          initial={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={(input) => (editing ? updatePurchase(editing.id, input) : addPurchase(input))}
        />
      )}

      {removing && (
        <Modal title="Eliminar compra" onClose={() => setRemoving(null)}>
          <p className="text-[var(--muted)]">
            ¿Eliminar la factura {removing.invoiceNumber} de “{removing.feedName}”?
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                deletePurchase(removing.id)
                setRemoving(null)
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function applyProductMoney(
  product: FeedProduct,
  lastUsdRate: number | undefined,
  setCurrency: (value: FeedCurrency) => void,
  setPrice: (value: string) => void,
  setUsdAmount: (value: string) => void,
  setUsdRate: (value: string) => void,
) {
  const currency = product.priceCurrency ?? 'DOP'
  setCurrency(currency)
  if (currency === 'USD') {
    setUsdAmount(product.usdAmount != null ? String(product.usdAmount) : '')
    setUsdRate(String(product.usdRate ?? lastUsdRate ?? ''))
    setPrice('')
  } else {
    setPrice(String(product.pricePerQq))
    setUsdAmount('')
  }
}

function FeedPurchaseForm({
  title,
  products,
  lastUsdRate,
  initial,
  onClose,
  onSave,
}: {
  title: string
  products: FeedProduct[]
  lastUsdRate?: number
  initial: FeedPurchase | null
  onClose: () => void
  onSave: (input: FeedPurchaseInput) => string | null
}) {
  const first = products[0]
  const [feedId, setFeedId] = useState(initial?.feedId ?? first?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '')
  const [quantity, setQuantity] = useState(initial ? String(initial.quantityQq) : '')
  const [storage, setStorage] = useState<FeedStorage>(initial?.storage ?? 'saco')
  const [currency, setCurrency] = useState<FeedCurrency>(
    initial?.priceCurrency ?? first?.priceCurrency ?? 'DOP',
  )
  const [price, setPrice] = useState(
    initial
      ? initial.priceCurrency !== 'USD'
        ? String(initial.pricePerQq)
        : ''
      : first && first.priceCurrency !== 'USD'
        ? String(first.pricePerQq)
        : '',
  )
  const [usdAmount, setUsdAmount] = useState(
    initial?.priceCurrency === 'USD' && initial.usdAmount != null
      ? String(initial.usdAmount)
      : !initial && first?.priceCurrency === 'USD' && first.usdAmount != null
        ? String(first.usdAmount)
        : '',
  )
  const [usdRate, setUsdRate] = useState(
    initial?.priceCurrency === 'USD' && initial.usdRate
      ? String(initial.usdRate)
      : !initial && first?.priceCurrency === 'USD' && first.usdRate
        ? String(first.usdRate)
        : lastUsdRate
          ? String(lastUsdRate)
          : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const qty = Number(quantity) || 0
  const pesos = pesosFromFields(currency, price, usdAmount, usdRate)

  function pickFeed(id: string) {
    setFeedId(id)
    const product = products.find((item) => item.id === id)
    if (product && !initial) {
      applyProductMoney(product, lastUsdRate, setCurrency, setPrice, setUsdAmount, setUsdRate)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      feedId,
      date,
      invoiceNumber,
      quantityQq: Number(quantity),
      storage,
      priceCurrency: currency,
      pricePerQq: Number(price),
      usdAmount: currency === 'USD' ? Number(usdAmount) : undefined,
      usdRate: currency === 'USD' ? Number(usdRate) : undefined,
    })
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initial) {
      onClose()
      return
    }
    const product = products.find((item) => item.id === feedId)
    setInvoiceNumber('')
    setQuantity('')
    setDate(todayIso())
    if (product) applyProductMoney(product, lastUsdRate, setCurrency, setPrice, setUsdAmount, setUsdRate)
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Alimento</span>
          <select className="field" value={feedId} onChange={(e) => pickFeed(e.target.value)} required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Fecha de entrada</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Número de factura</span>
          <input
            className="field"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Ej. 1234"
            required
          />
        </label>
        <label>
          <span className="label">Cantidad comprada (QQ)</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <FeedStorageFields value={storage} onChange={setStorage} />
        <FeedPriceFields
          currency={currency}
          onCurrency={setCurrency}
          dopPrice={price}
          onDopPrice={setPrice}
          usdAmount={usdAmount}
          onUsdAmount={setUsdAmount}
          usdRate={usdRate}
          onUsdRate={setUsdRate}
        />
        {qty > 0 && pesos >= 0 && (
          <p className="text-sm text-[var(--muted)]">Total: {formatDop(qty * pesos)}</p>
        )}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initial ? 'Guardar cambios' : 'Registrar compra'}
        </button>
      </form>
    </Modal>
  )
}

function formatQq(amount: number): string {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(amount)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-3xl p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  )
}

function HoverStat({
  label,
  value,
  breakdown,
}: {
  label: string
  value: string
  breakdown: Array<{ key: string; name: string; qq: number }>
}) {
  return (
    <div className="group relative">
      <div className="surface cursor-default rounded-3xl p-4">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
        <p className="mt-1 font-display text-2xl">{value}</p>
      </div>
      <div className="pointer-events-none invisible absolute top-full left-0 z-20 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 text-sm shadow-lg group-hover:visible">
        {breakdown.length === 0 ? (
          <p className="text-[var(--muted)]">Aún no hay compras de alimento.</p>
        ) : (
          <ul className="grid gap-1">
            {breakdown.map((row) => (
              <li key={row.key} className="flex justify-between gap-2">
                <span>{row.name}</span>
                <strong>{formatQq(row.qq)} QQ</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button className="btn btn-ghost btn-icon" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
