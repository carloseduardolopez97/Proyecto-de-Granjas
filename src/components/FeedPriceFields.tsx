import type { FeedCurrency } from '../lib/types'
import { formatDop, usdToPesos } from '../lib/calc'

export default function FeedPriceFields({
  currency,
  onCurrency,
  dopPrice,
  onDopPrice,
  usdAmount,
  onUsdAmount,
  usdRate,
  onUsdRate,
  hint,
  priceUnit = 'QQ',
}: {
  currency: FeedCurrency
  onCurrency: (value: FeedCurrency) => void
  dopPrice: string
  onDopPrice: (value: string) => void
  usdAmount: string
  onUsdAmount: (value: string) => void
  usdRate: string
  onUsdRate: (value: string) => void
  hint?: string
  priceUnit?: string
}) {
  const pesos =
    currency === 'USD' ? usdToPesos(Number(usdAmount) || 0, Number(usdRate) || 0) : Number(dopPrice) || 0

  return (
    <>
      <label>
        <span className="label">Moneda</span>
        <select className="field" value={currency} onChange={(e) => onCurrency(e.target.value as FeedCurrency)}>
          <option value="DOP">Pesos (DOP)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </label>
      {currency === 'USD' ? (
        <>
          <label>
            <span className="label">Precio por {priceUnit} en dólares</span>
            <input
              className="field"
              type="number"
              min={0}
              step="any"
              value={usdAmount}
              onChange={(e) => onUsdAmount(e.target.value)}
              placeholder={`Precio en USD / ${priceUnit}`}
              required
            />
          </label>
          <label>
            <span className="label">Tasa del dólar (pesos por 1 USD)</span>
            <input
              className="field"
              type="number"
              min={0.01}
              step="any"
              value={usdRate}
              onChange={(e) => onUsdRate(e.target.value)}
              placeholder="Ej. 60"
              required
            />
          </label>
        </>
      ) : (
        <label>
          <span className="label">Precio por {priceUnit}</span>
          <input
            className="field"
            type="number"
            min={0}
            step="any"
            value={dopPrice}
            onChange={(e) => onDopPrice(e.target.value)}
            placeholder={`Precio de un ${priceUnit}`}
            required
          />
        </label>
      )}
      {pesos > 0 && (
        <p className="text-sm text-[var(--muted)]">
          En pesos: {formatDop(pesos)} por {priceUnit}
        </p>
      )}
      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </>
  )
}

export function pesosFromFields(currency: FeedCurrency, dopPrice: string, usdAmount: string, usdRate: string): number {
  if (currency === 'USD') return usdToPesos(Number(usdAmount) || 0, Number(usdRate) || 0)
  return Number(dopPrice) || 0
}
