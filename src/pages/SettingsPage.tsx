import { useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { useFarm } from '../context/FarmContext'
import { formatMoney, unitCost } from '../lib/calc'
import type { FeedStorage } from '../lib/types'

export default function SettingsPage() {
  const { state, updateMedication, updateFeed, addMedication, addFeed, setFarmName } = useFarm()
  const [tab, setTab] = useState<'medicamentos' | 'alimentos'>('medicamentos')
  const [farmName, setName] = useState(state.farmName)
  const [openMed, setOpenMed] = useState(false)
  const [openFeed, setOpenFeed] = useState(false)

  return (
    <section>
      <div className="mb-6">
        <p className="chip mb-2">Precios de referencia</p>
        <h2 className="font-display text-4xl">Ajustes</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Aquí se fijan los precios que usa el programa para costear fórmulas y el consumo de
          alimento. El inventario se sigue moviendo en Farmacia y Alimento.
        </p>
      </div>

      <div className="surface mb-5 rounded-3xl p-5">
        <label className="block max-w-md">
          <span className="label">Nombre de la granja</span>
          <div className="flex gap-2">
            <input className="field" value={farmName} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary shrink-0" type="button" onClick={() => setFarmName(farmName.trim() || state.farmName)}>
              Guardar
            </button>
          </div>
        </label>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            className={`btn ${tab === 'medicamentos' ? 'btn-primary' : 'btn-ghost'}`}
            type="button"
            onClick={() => setTab('medicamentos')}
          >
            Medicamentos
          </button>
          <button
            className={`btn ${tab === 'alimentos' ? 'btn-primary' : 'btn-ghost'}`}
            type="button"
            onClick={() => setTab('alimentos')}
          >
            Alimentos
          </button>
        </div>
        {tab === 'medicamentos' ? (
          <button className="btn btn-primary" onClick={() => setOpenMed(true)}>
            Añadir medicamento
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setOpenFeed(true)}>
            Añadir alimento
          </button>
        )}
      </div>

      {tab === 'medicamentos' ? (
        <div className="surface overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Medicamento</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3">Precio por unidad</th>
                <th className="px-4 py-3">Costo fórmula (1 u)</th>
              </tr>
            </thead>
            <tbody>
              {state.medications.map((med) => (
                <tr key={med.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{med.name}</td>
                  <td className="px-4 py-3">{med.unit}</td>
                  <td className="px-4 py-3">
                    <input
                      className="field max-w-40"
                      type="number"
                      min={0}
                      step="0.01"
                      value={med.unitPrice}
                      onChange={(e) => updateMedication(med.id, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-4 py-3">{formatMoney(unitCost(med), state.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.medications.length === 0 && (
            <p className="p-6 text-[var(--muted)]">Aún no hay medicamentos. Añádelos aquí o en Farmacia.</p>
          )}
        </div>
      ) : (
        <div className="surface overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Alimento</th>
                <th className="px-4 py-3">Almacén</th>
                <th className="px-4 py-3">Precio (saco o qq)</th>
                <th className="px-4 py-3">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {state.feeds.map((feed) => (
                <tr key={feed.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{feed.name}</td>
                  <td className="px-4 py-3">
                    {feed.storage === 'saco' ? `Saco ${feed.sackWeightKg} kg` : `Silo · qq ${feed.quintalKg} kg`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="field max-w-40"
                        type="number"
                        min={0}
                        value={feed.unitPrice}
                        onChange={(e) => updateFeed(feed.id, { unitPrice: Number(e.target.value) })}
                      />
                      <span className="text-[var(--muted)]">/ {feed.storage === 'saco' ? 'saco' : 'qq'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatMoney(feed.lastUnitCost, state.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.feeds.length === 0 && (
            <p className="p-6 text-[var(--muted)]">Aún no hay alimentos. Añádelos aquí o en Alimento.</p>
          )}
        </div>
      )}

      {openMed && (
        <AddMedModal
          onClose={() => setOpenMed(false)}
          onSave={(payload) => {
            addMedication(payload)
            setOpenMed(false)
          }}
        />
      )}
      {openFeed && (
        <AddFeedPriceModal
          onClose={() => setOpenFeed(false)}
          onSave={(payload) => {
            addFeed(payload)
            setOpenFeed(false)
          }}
        />
      )}
    </section>
  )
}

function AddMedModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: {
    name: string
    presentation: string
    unit: string
    packageQty: number
    packageCost: number
    unitPrice: number
    stock: number
    minStock: number
    notes: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('ml')
  const [unitPrice, setUnitPrice] = useState(0)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      name: name.trim(),
      presentation: '',
      unit,
      packageQty: 1,
      packageCost: unitPrice,
      unitPrice,
      stock: 0,
      minStock: 0,
      notes: '',
    })
  }

  return (
    <Modal title="Añadir medicamento" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Unidad</span>
            <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label>
            <span className="label">Precio por unidad</span>
            <input
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
            />
          </label>
        </div>
        <button className="btn btn-primary" type="submit">
          Guardar
        </button>
      </form>
    </Modal>
  )
}

function AddFeedPriceModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: {
    name: string
    storage: FeedStorage
    sackWeightKg: number
    quintalKg: number
    unitPrice: number
    minStock: number
    notes: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [storage, setStorage] = useState<FeedStorage>('saco')
  const [sackWeightKg, setSack] = useState(40)
  const [quintalKg, setQq] = useState(50)
  const [unitPrice, setUnitPrice] = useState(0)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      name: name.trim(),
      storage,
      sackWeightKg,
      quintalKg,
      unitPrice,
      minStock: 0,
      notes: '',
    })
  }

  return (
    <Modal title="Añadir alimento" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
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
          <span className="label">{storage === 'saco' ? 'Precio por saco' : 'Precio por quintal (qq)'}</span>
          <input
            className="field"
            type="number"
            min={0}
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Guardar
        </button>
      </form>
    </Modal>
  )
}
