import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DualRangeSlider } from './DualRangeSlider'

describe('DualRangeSlider', () => {
  it('renders the formatted low/high labels', () => {
    render(
      <DualRangeSlider
        aria-label="Reel duration"
        formatLabel={(value) => `${value} sec`}
        max={60}
        min={1}
        value={[1, 60]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('1 sec')).toBeInTheDocument()
    expect(screen.getByText('60 sec')).toBeInTheDocument()
  })

  it('keeps the minimum from exceeding the current maximum', () => {
    const onChange = vi.fn()
    render(
      <DualRangeSlider aria-label="Reel duration" max={60} min={1} value={[10, 30]} onChange={onChange} />,
    )

    fireEvent.change(screen.getByRole('slider', { name: 'Reel duration minimum' }), {
      target: { value: '45' },
    })

    expect(onChange).toHaveBeenCalledWith([30, 30])
  })

  it('keeps the maximum from going below the current minimum', () => {
    const onChange = vi.fn()
    render(
      <DualRangeSlider aria-label="Reel duration" max={60} min={1} value={[10, 30]} onChange={onChange} />,
    )

    fireEvent.change(screen.getByRole('slider', { name: 'Reel duration maximum' }), {
      target: { value: '5' },
    })

    expect(onChange).toHaveBeenCalledWith([10, 10])
  })
})
