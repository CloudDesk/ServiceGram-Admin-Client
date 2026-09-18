import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

describe('Switch', () => {
  it('reflects the checked state via aria-checked', () => {
    render(<Switch checked label="Publish automatically" onChange={vi.fn()} />)

    expect(screen.getByRole('switch', { name: 'Publish automatically' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('calls onChange with the toggled value on click', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} label="Auto submit" onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Auto submit' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not fire onChange while disabled', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} disabled label="Auto submit" onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Auto submit' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
