// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CodeInput } from './CodeInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [code, setCode] = useState(initial)
  return <CodeInput value={code} onChange={setCode} />
}

function input(): HTMLInputElement {
  return screen.getByPlaceholderText('ROOM CODE') as HTMLInputElement
}

describe('CodeInput', () => {
  it('normalizes typed and pasted text to four uppercase letters', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: ' pa-rt99y ' } })
    expect(input().value).toBe('PART')
  })

  it('renders a prefilled value into the tiles', () => {
    const { container } = render(<Harness initial="WXYZ" />)
    const tiles = [...container.querySelectorAll('[data-tile]')].map((t) => t.textContent)
    expect(tiles).toEqual(['W', 'X', 'Y', 'Z'])
  })

  it('leaves remaining tiles empty for partial codes', () => {
    const { container } = render(<Harness initial="PA" />)
    const tiles = [...container.querySelectorAll('[data-tile]')].map((t) => t.textContent)
    expect(tiles).toEqual(['P', 'A', '', ''])
  })
})
