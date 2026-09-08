import { useState, type FormEvent, type ReactNode } from 'react'
import FeedPriceFields from '../components/FeedPriceFields'
import Modal, { afterSaveReadyForNext, SavedNotice } from '../components/Modal'
import { useCepa } from '../context/CepaContext'
import { useFeed, type FeedProductInput } from '../context/FeedContext'
import { formatDopUnit, formatUsd } from '../lib/calc'
import type { CepaLocation, FeedCurrency, FeedProduct } from '../lib/types'
import { useQuickAdd } from '../lib/quickAdd'

export default function SettingsPage() {
  const { state, addProduct, updateProduct, deleteProduct } = useFeed()
  const {
    state: cepaState,
    addLocation,
    updateLocation,
    deleteLocation,
    addEngordeLocation,
    updateEngordeLocation,
    deleteEngordeLocation,
  } = useCepa()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FeedProduct | null>(null)
  const [removing, setRemoving] = useState<FeedProduct | null>(null)
  const [locationFormOpen, setLocationFormOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<CepaLocation | null>(null)
  const [removingLocation, setRemovingLocation] = useState<CepaLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [engordeFormOpen, setEngordeFormOpen] = useState(false)
  const [editingEngorde, setEditingEngorde] = useState<CepaLocation | null>(null)
  const [removingEngorde, setRemovingEngorde] = useState<CepaLocation | null>(null)
  const [engordeError, setEngordeError] = useState<string | null>(null)
  const locations = cepaState.locations ?? []
  const engordeLocations = cepaState.engordeLocations ?? []

  useQuickAdd({
    catalogo: () => {
      setEditing(null)
      setFormOpen(true)
    },
    ubicacion: () => {
      setEditingLocation(null)
      setLocationFormOpen(true)
    },
    sala: () => {
      setEditingEngorde(null)
      setEngordeFormOpen(true)
    },
  })

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-3">Configuración</p>
          <h2 className="font-display text-4xl">Ajustes</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Prepara aquí el catálogo: alimentos, jaulas de destete y salas de engorde. Así el registro
            solo elige lo que ya está creado. Si luego cambias el precio de un alimento, las compras ya
            registradas no se modifican.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setEditingLocation(null)
              setLocationFormOpen(true)
            }}
          >
            Crear ubicación destete
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setEditingEngorde(null)
              setEngordeFormOpen(true)
            }}
          >
            Crear sala de engorde
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Crear alimento
          </button>
        </div>
      </div>

      <div className="surface rounded-3xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Ubicaciones de destete</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Jaulas o galpones de la etapa Cepa. Indica la capacidad para avisar si hay sobrepoblación.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditingLocation(null)
              setLocationFormOpen(true)
            }}
          >
            Crear ubicación destete
          </button>
        </div>
        {locations.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">Todavía no hay jaulas de destete. Créalas antes de registrar cepas.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {locations.map((item) => {
              const used = cepaState.cepas.filter((row) => row.locationId === item.id).length
              return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {item.capacity > 0 ? `Capacidad ${item.capacity} · ` : 'Sin capacidad · '}
                    {used === 0 ? 'Sin cepas aún' : `${used} ${used === 1 ? 'cepa' : 'cepas'}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <IconButton
                    label="Editar"
                    onClick={() => {
                      setEditingLocation(item)
                      setLocationFormOpen(true)
                    }}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    label="Eliminar"
                    onClick={() => {
                      setLocationError(null)
                      setRemovingLocation(item)
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-8 surface rounded-3xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Salas de engorde</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Opcional: habitaciones aparte de las jaulas de destete. El traslado ya puede usar las jaulas
              que creaste para Cepa.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditingEngorde(null)
              setEngordeFormOpen(true)
            }}
          >
            Crear sala de engorde
          </button>
        </div>
        {engordeLocations.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">
            No hay habitaciones extra. El traslado usa las jaulas de destete. Añade una aquí solo si
            engorde tiene salas aparte.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {engordeLocations.map((item) => {
              const used = (cepaState.engordeLots ?? []).filter((row) => row.locationId === item.id).length
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {item.capacity > 0 ? `Capacidad ${item.capacity} · ` : 'Sin capacidad · '}
                      {used === 0 ? 'Sin traslados aún' : `${used} ${used === 1 ? 'traslado' : 'traslados'}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton
                      label="Editar"
                      onClick={() => {
                        setEditingEngorde(item)
                        setEngordeFormOpen(true)
                      }}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label="Eliminar"
                      onClick={() => {
                        setEngordeError(null)
                        setRemovingEngorde(item)
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-8 surface rounded-3xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Alimentos</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Catálogo con nombre y precio por QQ. Ese precio se usa al registrar compras.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Crear alimento
          </button>
        </div>
        {state.products.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">Todavía no hay alimentos. Crea el primero para poder registrar compras.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {state.products.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {formatDopUnit(product.pricePerQq)} por QQ
                    {product.priceCurrency === 'USD' && product.usdAmount != null
                      ? ` · ${formatUsd(product.usdAmount)}`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <IconButton
                    label="Editar"
                    onClick={() => {
                      setEditing(product)
                      setFormOpen(true)
                    }}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton label="Eliminar" onClick={() => setRemoving(product)}>
                    <TrashIcon />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {formOpen && (
        <FeedProductForm
          title={editing ? 'Editar alimento' : 'Crear alimento'}
          initial={editing}
          lastUsdRate={state.lastUsdRate}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={(input) => (editing ? updateProduct(editing.id, input) : addProduct(input))}
        />
      )}

      {removing && (
        <Modal title="Eliminar alimento" onClose={() => setRemoving(null)}>
          <p className="text-[var(--muted)]">
            ¿Eliminar “{removing.name}”? Las compras ya registradas se conservan.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                deleteProduct(removing.id)
                setRemoving(null)
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}

      {locationFormOpen && (
        <LocationForm
          title={editingLocation ? 'Editar ubicación de destete' : 'Crear ubicación de destete'}
          initial={editingLocation}
          namePlaceholder="Ej. Jaula 3"
          capacityLabel="Capacidad (lechones)"
          capacityHint="Si se pasa este número, la ficha de Cepa avisa sobrepoblación."
          createLabel="Crear ubicación"
          onClose={() => {
            setLocationFormOpen(false)
            setEditingLocation(null)
          }}
          onSave={(name, capacity) => {
            if (editingLocation) return updateLocation(editingLocation.id, name, capacity)
            const result = addLocation(name, capacity)
            return 'error' in result ? result.error : null
          }}
        />
      )}

      {removingLocation && (
        <Modal title="Eliminar ubicación" onClose={() => setRemovingLocation(null)}>
          <p className="text-[var(--muted)]">¿Eliminar “{removingLocation.name}”?</p>
          {locationError && <p className="mt-2 text-sm text-[var(--danger)]">{locationError}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemovingLocation(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                const message = deleteLocation(removingLocation.id)
                if (message) {
                  setLocationError(message)
                  return
                }
                setRemovingLocation(null)
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}

      {engordeFormOpen && (
        <LocationForm
          title={editingEngorde ? 'Editar sala de engorde' : 'Crear sala de engorde'}
          initial={editingEngorde}
          namePlaceholder="Ej. Sala 1"
          capacityLabel="Capacidad (cerdos)"
          capacityHint="Si se pasa este número, la ficha de Engorde avisa sobrepoblación."
          createLabel="Crear sala"
          onClose={() => {
            setEngordeFormOpen(false)
            setEditingEngorde(null)
          }}
          onSave={(name, capacity) => {
            if (editingEngorde) return updateEngordeLocation(editingEngorde.id, name, capacity)
            const result = addEngordeLocation(name, capacity)
            return 'error' in result ? result.error : null
          }}
        />
      )}

      {removingEngorde && (
        <Modal title="Eliminar sala de engorde" onClose={() => setRemovingEngorde(null)}>
          <p className="text-[var(--muted)]">¿Eliminar “{removingEngorde.name}”?</p>
          {engordeError && <p className="mt-2 text-sm text-[var(--danger)]">{engordeError}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemovingEngorde(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                const message = deleteEngordeLocation(removingEngorde.id)
                if (message) {
                  setEngordeError(message)
                  return
                }
                setRemovingEngorde(null)
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

function FeedProductForm({
  title,
  initial,
  lastUsdRate,
  onClose,
  onSave,
}: {
  title: string
  initial: FeedProduct | null
  lastUsdRate?: number
  onClose: () => void
  onSave: (input: FeedProductInput) => string | null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [currency, setCurrency] = useState<FeedCurrency>(initial?.priceCurrency ?? 'DOP')
  const [price, setPrice] = useState(
    initial && initial.priceCurrency !== 'USD' ? String(initial.pricePerQq) : '',
  )
  const [usdAmount, setUsdAmount] = useState(
    initial?.priceCurrency === 'USD' && initial.usdAmount != null ? String(initial.usdAmount) : '',
  )
  const [usdRate, setUsdRate] = useState(
    initial?.priceCurrency === 'USD' && initial.usdRate
      ? String(initial.usdRate)
      : lastUsdRate
        ? String(lastUsdRate)
        : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      name,
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
    setName('')
    setPrice('')
    setUsdAmount('')
    if (currency === 'USD') setUsdRate(usdRate || (lastUsdRate ? String(lastUsdRate) : ''))
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Engorde 1" required />
        </label>
        <FeedPriceFields
          currency={currency}
          onCurrency={setCurrency}
          dopPrice={price}
          onDopPrice={setPrice}
          usdAmount={usdAmount}
          onUsdAmount={setUsdAmount}
          usdRate={usdRate}
          onUsdRate={setUsdRate}
          hint="Este precio se usa al registrar una compra nueva. No cambia facturas anteriores."
        />
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initial ? 'Guardar cambios' : 'Crear alimento'}
        </button>
      </form>
    </Modal>
  )
}

function LocationForm({
  title,
  initial,
  namePlaceholder,
  capacityLabel,
  capacityHint,
  createLabel,
  onClose,
  onSave,
}: {
  title: string
  initial: CepaLocation | null
  namePlaceholder: string
  capacityLabel: string
  capacityHint: string
  createLabel: string
  onClose: () => void
  onSave: (name: string, capacity?: number) => string | null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(
    initial?.capacity && initial.capacity > 0 ? String(initial.capacity) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = capacity.trim() ? Number.parseInt(capacity, 10) : 0
    const message = onSave(name, parsed)
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initial) {
      onClose()
      return
    }
    setName('')
    setCapacity('')
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder} required />
        </label>
        <label>
          <span className="label">{capacityLabel}</span>
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Opcional"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">{capacityHint}</span>
        </label>
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initial ? 'Guardar cambios' : createLabel}
        </button>
      </form>
    </Modal>
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
