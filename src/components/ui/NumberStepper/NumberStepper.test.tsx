import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberStepper } from './NumberStepper'

describe('NumberStepper', () => {
  it('increments and decrements by the step size', () => {
    const onChange = vi.fn()
    render(
      <NumberStepper aria-label="Daily uploads" max={20} min={0} step={5} value={10} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenLastCalledWith(15)

    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('clamps typed values to min and max', () => {
    const onChange = vi.fn()
    render(<NumberStepper aria-label="Limit" max={10} min={0} value={5} onChange={onChange} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Limit' }), {
      target: { value: '999' },
    })
    expect(onChange).toHaveBeenLastCalledWith(10)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Limit' }), {
      target: { value: '-5' },
    })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})
