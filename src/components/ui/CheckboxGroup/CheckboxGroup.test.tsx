import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckboxGroup } from './CheckboxGroup'

const options = [
  { value: 'MP4', label: 'MP4' },
  { value: 'MOV', label: 'MOV' },
]

describe('CheckboxGroup', () => {
  it('adds a value when an unchecked option is clicked', () => {
    const onChange = vi.fn()
    render(<CheckboxGroup options={options} value={['MP4']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /MOV/ }))

    expect(onChange).toHaveBeenCalledWith(['MP4', 'MOV'])
  })

  it('removes a value when a checked option is clicked', () => {
    const onChange = vi.fn()
    render(<CheckboxGroup options={options} value={['MP4', 'MOV']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /MP4/ }))

    expect(onChange).toHaveBeenCalledWith(['MOV'])
  })
})
