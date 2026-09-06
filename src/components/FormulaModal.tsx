import { useState, type FormEvent } from 'react'
import { formulaCost, formatMoney } from '../lib/calc'
import type { Formula, FormulaLine, Medication } from '../lib/types'
import Modal from './Modal'

export default function FormulaModal({
  medications,
  currency,
  initial,
  onClose,
  onSave,
}: {
  medications: Medication[]
  currency: string
  initial?: Formula
  onClose: () => void
  onSave: (payload: { name: string; indication: string; lines: FormulaLine[] }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [indication, setIndication] = useState(initial?.indication ?? '')
  const [lines, setLines] = useState<FormulaLine[]>(
    initial?.lines.length
      ? initial.lines
      : [{ medicationId: medications[0].id, quantity: 1 }],
  )

  const preview = formulaCost({ id: 'tmp', name, indication, lines }, medications, 1)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ name, indication, lines: lines.filter((l) => l.quantity > 0) })
  }

  return (
    <Modal title={initial ? 'Editar fórmula' : 'Nueva fórmula'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          <span className="label">Indicación</span>
          <input className="field" value={indication} onChange={(e) => setIndication(e.target.value)} />
        </label>
        <div className="space-y-2">
          <span className="label">Componentes</span>
          {lines.map((line, index) => (
            <div key={`${line.medicationId}-${index}`} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <select
                className="field"
                value={line.medicationId}
                onChange={(e) => {
                  const next = [...lines]
                  next[index] = { ...line, medicationId: e.target.value }
                  setLines(next)
                }}
              >
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines]
                  next[index] = { ...line, quantity: Number(e.target.value) }
                  setLines(next)
                }}
              />
              <button
                className="btn btn-ghost px-3"
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setLines([...lines, { medicationId: medications[0].id, quantity: 1 }])}
          >
            Añadir componente
          </button>
        </div>
        <p className="font-semibold">Costo por aplicación: {formatMoney(preview, currency)}</p>
        <button className="btn btn-primary" type="submit">
          Guardar fórmula
        </button>
      </form>
    </Modal>
  )
}
