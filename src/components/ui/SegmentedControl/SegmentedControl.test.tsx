import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'CATEGORY', label: 'Category' },
]

describe('SegmentedControl', () => {
  it('marks the active option as checked', () => {
    render(<SegmentedControl options={options} value="CATEGORY" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: 'Category' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Global' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('calls onChange with the selected option value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="GLOBAL" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Category' }))

    expect(onChange).toHaveBeenCalledWith('CATEGORY')
  })
})
