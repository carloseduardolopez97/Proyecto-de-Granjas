import { farmStageLabel } from '../lib/calc'
import type { FarmStage } from '../lib/types'

export default function FarmStageFields({
  value,
  onChange,
}: {
  value: FarmStage
  onChange: (value: FarmStage) => void
}) {
  return (
    <fieldset>
      <legend className="label">Etapa</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {(['destete', 'engorde'] as const).map((item) => (
          <label key={item} className="btn btn-ghost">
            <input
              className="mr-2"
              type="radio"
              checked={value === item}
              onChange={() => onChange(item)}
            />
            {farmStageLabel(item)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
