import { Input } from '../../../components/ui/Input'
import { cn } from '../../../utils/cn'
import type { CommissionRateType } from '../utils/commissionFormatting'

interface CommissionRateFieldsProps {
  rateType: CommissionRateType
  onRateTypeChange: (type: CommissionRateType) => void
  percentText: string
  onPercentTextChange: (value: string) => void
  fixedText: string
  onFixedTextChange: (value: string) => void
  /** Field group label — defaults to "Commission rate" for the commission forms. */
  label?: string
  /** Locks the Percentage/Fixed toggle — e.g. once a record has been created. */
  disabled?: boolean
}

const TOGGLE_BUTTON_CLASS =
  'flex-1 rounded-[0.55rem] border px-3 py-1.5 text-sm font-medium transition'

/**
 * Shared "what's the rate" control for both the vendor commission rule form
 * and the influencer commission setting form, so the two look and behave
 * like one feature instead of two different editors.
 */
export function CommissionRateFields({
  rateType,
  onRateTypeChange,
  percentText,
  onPercentTextChange,
  fixedText,
  onFixedTextChange,
  label = 'Commission rate',
  disabled = false,
}: CommissionRateFieldsProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="flex gap-2">
        <button
          className={cn(
            TOGGLE_BUTTON_CLASS,
            rateType === 'PERCENTAGE'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          disabled={disabled}
          type="button"
          onClick={() => onRateTypeChange('PERCENTAGE')}
        >
          Percentage
        </button>
        <button
          className={cn(
            TOGGLE_BUTTON_CLASS,
            rateType === 'FIXED'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          disabled={disabled}
          type="button"
          onClick={() => onRateTypeChange('FIXED')}
        >
          Fixed amount
        </button>
      </div>
      {rateType === 'PERCENTAGE' ? (
        <label className="block space-y-1">
          <span className="text-xs text-muted">Rate (%)</span>
          <Input
            inputMode="decimal"
            placeholder="15"
            value={percentText}
            onChange={(event) => onPercentTextChange(event.target.value)}
          />
        </label>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs text-muted">Amount (₹)</span>
          <Input
            inputMode="decimal"
            placeholder="50"
            value={fixedText}
            onChange={(event) => onFixedTextChange(event.target.value)}
          />
        </label>
      )}
    </div>
  )
}
