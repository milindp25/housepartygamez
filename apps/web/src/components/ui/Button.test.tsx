// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders an accessible button and forwards clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Start game</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire clicks when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Start game
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
