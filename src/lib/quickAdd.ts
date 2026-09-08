import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export const QUICK_ADD_PARAM = 'alta'

export type QuickAddGroup = {
  label: string
  items: Array<{ id: string; label: string; to: string }>
}

export const QUICK_ADD_GROUPS: QuickAddGroup[] = [
  {
    label: 'Farmacia',
    items: [
      { id: 'medicamento', label: 'Añadir medicamento', to: '/' },
      { id: 'inyeccion', label: 'Añadir inyección', to: '/' },
      { id: 'uso', label: 'Registrar uso de inyección', to: '/' },
    ],
  },
  {
    label: 'Destete',
    items: [
      { id: 'cepa', label: 'Registrar cepa', to: '/cepa' },
      { id: 'alimento-destete', label: 'Alimentar destete', to: '/cepa' },
      { id: 'peso', label: 'Actualizar peso', to: '/cepa' },
      { id: 'muerte', label: 'Registrar muerte', to: '/cepa' },
    ],
  },
  {
    label: 'Engorde',
    items: [
      { id: 'traslado', label: 'Trasladar a engorde', to: '/engorde' },
      { id: 'alimento-engorde', label: 'Alimentar engorde', to: '/engorde' },
    ],
  },
  {
    label: 'Alimento',
    items: [{ id: 'compra', label: 'Registrar compra de alimento', to: '/alimento' }],
  },
  {
    label: 'Ajustes',
    items: [
      { id: 'catalogo', label: 'Crear alimento', to: '/ajustes' },
      { id: 'ubicacion', label: 'Crear ubicación destete', to: '/ajustes' },
      { id: 'sala', label: 'Crear sala de engorde', to: '/ajustes' },
    ],
  },
]

export function useQuickAdd(handlers: Record<string, () => void>): void {
  const [params, setParams] = useSearchParams()
  const alta = params.get(QUICK_ADD_PARAM)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!alta) return
    const run = handlersRef.current[alta]
    if (!run) return
    run()
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(QUICK_ADD_PARAM)
        return next
      },
      { replace: true },
    )
  }, [alta, setParams])
}
