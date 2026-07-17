// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pill } from './Pill'

describe('Pill', () => {
  it('renders a button with its label and forwards clicks', () => {
    const onClick = vi.fn()
    render(<Pill onClick={onClick}>Mafia</Pill>)
    fireEvent.click(screen.getByRole('button', { name: 'Mafia' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('marks the selected state for assistive tech', () => {
    render(<Pill selected>Spicy</Pill>)
    expect(screen.getByRole('button', { name: 'Spicy' }).getAttribute('aria-pressed')).toBe('true')
  })
})
