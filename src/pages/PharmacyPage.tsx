import { useState, type FormEvent } from 'react'
import FormulaModal from '../components/FormulaModal'
import Modal from '../components/Modal'
import { useFarm } from '../context/FarmContext'
import { formatMoney, formatQty, formulaCost, unitCost } from '../lib/calc'
import type { Formula } from '../lib/types'

export default function PharmacyPage() {
  const { state, addMedication, addStock, addFormula, updateFormula, deleteFormula } = useFarm()
  const [tab, setTab] = useState<'medicamentos' | 'formulas'>('medicamentos')
  const [openMed, setOpenMed] = useState(false)
  const [restockId, setRestockId] = useState<string | null>(null)
  const [formulaModal, setFormulaModal] = useState<'new' | Formula | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-2">Inventario sanitario</p>
          <h2 className="font-display text-4xl">Farmacia</h2>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Medicamentos en existencia y fórmulas de acceso rápido. Al aplicar una fórmula a una
            cepa se descuenta el inventario.
          </p>
        </div>
        {tab === 'medicamentos' ? (
          <button className="btn btn-primary" onClick={() => setOpenMed(true)}>
            Nuevo medicamento
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setFormulaModal('new')}
            disabled={state.medications.length === 0}
          >
            Crear fórmula
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-2">
        <button
          className={`btn ${tab === 'medicamentos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('medicamentos')}
          type="button"
        >
          Medicamentos
        </button>
        <button
          className={`btn ${tab === 'formulas' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('formulas')}
          type="button"
        >
          Fórmulas
        </button>
      </div>

      {tab === 'medicamentos' ? (
        state.medications.length === 0 ? (
          <div className="surface rounded-3xl p-8 text-[var(--muted)]">La farmacia está vacía.</div>
        ) : (
          <div className="grid gap-3">
            {state.medications.map((med) => {
              const cost = unitCost(med)
              const low = med.stock <= med.minStock
              return (
                <article key={med.id} className="surface rounded-3xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl">{med.name}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {med.presentation} · unidad {med.unit}
                      </p>
                    </div>
                    {low && (
                      <span className="chip bg-[var(--clay-soft)] text-[var(--clay)]">Stock bajo</span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <Mini label="Existencia" value={formatQty(med.stock, med.unit)} />
                    <Mini label="Precio / unidad" value={formatMoney(cost, state.currency)} />
                    <Mini label="Costo envase" value={formatMoney(med.packageCost, state.currency)} />
                    <Mini label="Mínimo" value={formatQty(med.minStock, med.unit)} />
                  </div>
                  <button className="btn btn-ghost mt-4" onClick={() => setRestockId(med.id)}>
                    Entrada de stock
                  </button>
                </article>
              )
            })}
          </div>
        )
      ) : state.formulas.length === 0 ? (
        <div className="surface rounded-3xl p-8 text-[var(--muted)]">
          No hay fórmulas. Primero carga medicamentos y luego arma la receta.
        </div>
      ) : (
        <div className="grid gap-3">
          {state.formulas.map((formula) => {
            const cost = formulaCost(formula, state.medications, 1)
            return (
              <article key={formula.id} className="surface rounded-3xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">{formula.name}</h3>
                    <p className="text-sm text-[var(--muted)]">{formula.indication || 'Sin indicación'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => setFormulaModal(formula)}>
                      Editar
                    </button>
                    <button className="btn btn-ghost" onClick={() => setDeleteId(formula.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {formula.lines.map((line) => {
                    const med = state.medications.find((m) => m.id === line.medicationId)
                    if (!med) return <li key={line.medicationId}>Medicamento no disponible</li>
                    return (
                      <li key={line.medicationId} className="flex justify-between gap-3">
                        <span>{med.name}</span>
                        <span>
                          {formatQty(line.quantity, med.unit)} ·{' '}
                          {formatMoney(unitCost(med) * line.quantity, state.currency)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 font-semibold">
                  Costo por aplicación: {formatMoney(cost, state.currency)}
                </p>
              </article>
            )
          })}
        </div>
      )}

      {openMed && (
        <MedicationModal
          onClose={() => setOpenMed(false)}
          onSave={(payload) => {
            addMedication(payload)
            setOpenMed(false)
          }}
        />
      )}
      {restockId && (
        <RestockModal
          unit={state.medications.find((m) => m.id === restockId)?.unit ?? ''}
          onClose={() => setRestockId(null)}
          onSave={(qty, cost) => {
            addStock(restockId, qty, cost)
            setRestockId(null)
          }}
        />
      )}
      {formulaModal && state.medications.length > 0 && (
        <FormulaModal
          medications={state.medications}
          currency={state.currency}
          initial={formulaModal === 'new' ? undefined : formulaModal}
          onClose={() => setFormulaModal(null)}
          onSave={(payload) => {
            if (formulaModal === 'new') addFormula(payload)
            else updateFormula(formulaModal.id, payload)
            setFormulaModal(null)
          }}
        />
      )}
      {deleteId && (
        <Modal title="Eliminar fórmula" onClose={() => setDeleteId(null)}>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Se quitará de la farmacia. Los registros ya aplicados en las cepas se conservan.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-clay"
              onClick={() => {
                deleteFormula(deleteId)
                setDeleteId(null)
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function MedicationModal({
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
  const [presentation, setPresentation] = useState('Frasco')
  const [unit, setUnit] = useState('ml')
  const [packageQty, setPackageQty] = useState(100)
  const [packageCost, setPackageCost] = useState(0)
  const [stock, setStock] = useState(0)
  const [minStock, setMinStock] = useState(0)
  const [notes, setNotes] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ name, presentation, unit, packageQty, packageCost, unitPrice: preview, stock, minStock, notes })
  }

  const preview = packageQty ? packageCost / packageQty : 0

  return (
    <Modal title="Alta de medicamento" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Presentación</span>
            <input className="field" value={presentation} onChange={(e) => setPresentation(e.target.value)} />
          </label>
          <label>
            <span className="label">Unidad de medida</span>
            <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Cantidad del envase</span>
            <input
              className="field"
              type="number"
              min={0.01}
              step="0.01"
              value={packageQty}
              onChange={(e) => setPackageQty(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Costo del envase</span>
            <input
              className="field"
              type="number"
              min={0}
              value={packageCost}
              onChange={(e) => setPackageCost(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Costo por {unit}: {preview.toFixed(2)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Stock inicial</span>
            <input
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Stock mínimo</span>
            <input
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={minStock}
              onChange={(e) => setMinStock(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          <span className="label">Notas</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          Guardar
        </button>
      </form>
    </Modal>
  )
}

function RestockModal({
  unit,
  onClose,
  onSave,
}: {
  unit: string
  onClose: () => void
  onSave: (qty: number, cost?: number) => void
}) {
  const [qty, setQty] = useState(0)
  const [cost, setCost] = useState<number | ''>('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(qty, cost === '' ? undefined : Number(cost))
  }

  return (
    <Modal title="Entrada de stock" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Cantidad ({unit})</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="0.01"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">Nuevo costo de envase (opcional)</span>
          <input
            className="field"
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <button className="btn btn-primary" type="submit">
          Sumar al inventario
        </button>
      </form>
    </Modal>
  )
}
