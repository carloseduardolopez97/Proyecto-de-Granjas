import { useId } from 'react'
import { FEED_STORAGES, type FeedStorage } from '../lib/types'

export default function FeedStorageFields({
  value,
  onChange,
}: {
  value: FeedStorage
  onChange: (value: FeedStorage) => void
}) {
  const group = useId()
  return (
    <fieldset>
      <legend className="label">Almacenamiento</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {FEED_STORAGES.map((item) => (
          <label key={item.value} className="btn btn-ghost">
            <input
              className="mr-2"
              type="radio"
              name={group}
              checked={value === item.value}
              onChange={() => onChange(item.value)}
            />
            {item.label}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {FEED_STORAGES.find((item) => item.value === value)?.hint}
      </p>
    </fieldset>
  )
}

