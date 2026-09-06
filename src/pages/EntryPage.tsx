import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFarm } from '../context/FarmContext'
import { formatAgeWeeks, lotAgeDays, supplierAvgWeightKg, todayIso, uid } from '../lib/calc'

type VaccineDraft = { key: string; name: string; dueDate: string }
type SupplierDraft = {
  key: string
  name: string
  headcount: number
  totalWeightKg: number
  vaccines: VaccineDraft[]
}

function emptyVaccine(): VaccineDraft {
  return { key: uid(), name: '', dueDate: todayIso() }
}

function emptySupplier(): SupplierDraft {
  return {
    key: uid(),
    name: '',
    headcount: 0,
    totalWeightKg: 0,
    vaccines: [emptyVaccine()],
  }
}

export default function EntryPage() {
  const { addLot } = useFarm()
  const navigate = useNavigate()
  const [cageOrName, setCageOrName] = useState('')
  const [entryDate, setEntryDate] = useState(todayIso())
  const [ageAtEntryDays, setAge] = useState(21)
  const [notes, setNotes] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierDraft[]>([emptySupplier()])
  const [error, setError] = useState<string | null>(null)

  const ageLabel = useMemo(
    () => formatAgeWeeks(entryDate, ageAtEntryDays),
    [entryDate, ageAtEntryDays],
  )
  const ageDaysNow = useMemo(
    () => lotAgeDays(entryDate, ageAtEntryDays),
    [entryDate, ageAtEntryDays],
  )
  const totalHeads = suppliers.reduce((n, s) => n + (Number(s.headcount) || 0), 0)

  function updateSupplier(key: string, patch: Partial<SupplierDraft>) {
    setSuppliers((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!cageOrName.trim()) {
      setError('Indica el número de jaula o el nombre de la cepa.')
      return
    }
    const valid = suppliers.filter((s) => s.name.trim() && s.headcount > 0)
    if (valid.length === 0) {
      setError('Agrega al menos un suplidor con cantidad de lechones.')
      return
    }
    addLot({
      cageOrName: cageOrName.trim(),
      entryDate,
      ageAtEntryDays,
      notes,
      suppliers: valid.map((s) => ({
        name: s.name.trim(),
        headcount: s.headcount,
        totalWeightKg: s.totalWeightKg,
        vaccines: s.vaccines.filter((v) => v.name.trim()),
      })),
    })
    navigate('/')
  }

  return (
    <section className="mx-auto max-w-3xl">
      <p className="chip mb-3">Primera digitación</p>
      <h2 className="font-display text-4xl">Entrada de cepa</h2>
      <p className="mt-2 mb-6 text-[var(--muted)]">
        Fecha, jaula o nombre, suplidores con cantidad y peso, vacunas con fecha y edad al ingreso.
      </p>

      <form className="surface grid gap-4 rounded-3xl p-5" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Fecha de entrada</span>
            <input
              className="field"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="label">No. jaula o nombre</span>
            <input
              className="field"
              value={cageOrName}
              onChange={(e) => setCageOrName(e.target.value)}
              placeholder="Ej. Jaula 8"
              required
            />
          </label>
        </div>

        <label>
          <span className="label">Edad de la cepa al llegar (días)</span>
          <input
            className="field"
            type="number"
            min={0}
            value={ageAtEntryDays}
            onChange={(e) => setAge(Number(e.target.value))}
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          Hoy tendrían {ageDaysNow} días · <strong>{ageLabel}</strong> en la ficha técnica.
        </p>

        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl">Suplidores</h3>
          <button className="btn btn-ghost" type="button" onClick={() => setSuppliers((s) => [...s, emptySupplier()])}>
            Añadir suplidor
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">Total lechones: {totalHeads}</p>

        {suppliers.map((supplier, index) => {
          const avg = supplierAvgWeightKg({
            id: supplier.key,
            name: supplier.name,
            headcount: supplier.headcount,
            totalWeightKg: supplier.totalWeightKg,
            vaccines: [],
          })
          return (
            <fieldset key={supplier.key} className="rounded-2xl border border-[var(--line)] p-4">
              <legend className="px-1 text-sm font-semibold">Suplidor {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="sm:col-span-3">
                  <span className="label">Nombre del suplidor</span>
                  <input
                    className="field"
                    value={supplier.name}
                    onChange={(e) => updateSupplier(supplier.key, { name: e.target.value })}
                  />
                </label>
                <label>
                  <span className="label">Lechones comprados</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={supplier.headcount || ''}
                    onChange={(e) => updateSupplier(supplier.key, { headcount: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="label">Peso total (kg)</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step="0.1"
                    value={supplier.totalWeightKg || ''}
                    onChange={(e) => updateSupplier(supplier.key, { totalWeightKg: Number(e.target.value) })}
                  />
                </label>
                <div>
                  <span className="label">Peso promedio</span>
                  <p className="field flex items-center">{avg ? `${avg.toFixed(2)} kg` : '—'}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <h4 className="font-semibold">Vacunas de este suplidor</h4>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() =>
                    updateSupplier(supplier.key, {
                      vaccines: [...supplier.vaccines, emptyVaccine()],
                    })
                  }
                >
                  Añadir vacuna
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                {supplier.vaccines.map((vaccine) => (
                  <div key={vaccine.key} className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="field"
                      placeholder="Nombre de la vacuna"
                      value={vaccine.name}
                      onChange={(e) =>
                        updateSupplier(supplier.key, {
                          vaccines: supplier.vaccines.map((v) =>
                            v.key === vaccine.key ? { ...v, name: e.target.value } : v,
                          ),
                        })
                      }
                    />
                    <input
                      className="field"
                      type="date"
                      value={vaccine.dueDate}
                      onChange={(e) =>
                        updateSupplier(supplier.key, {
                          vaccines: supplier.vaccines.map((v) =>
                            v.key === vaccine.key ? { ...v, dueDate: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              {suppliers.length > 1 && (
                <button
                  className="btn btn-ghost mt-3"
                  type="button"
                  onClick={() => setSuppliers((rows) => rows.filter((row) => row.key !== supplier.key))}
                >
                  Quitar suplidor
                </button>
              )}
            </fieldset>
          )
        })}

        <label>
          <span className="label">Notas</span>
          <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Guardar entrada
        </button>
      </form>
    </section>
  )
}
