// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyLinkButton } from './CopyLinkButton'

const url = 'http://localhost:3000/join?code=PART'

afterEach(() => {
  vi.useRealTimers()
})

describe('CopyLinkButton', () => {
  it('copies the join url and confirms, then resets after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<CopyLinkButton url={url} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await act(async () => {}) // flush the clipboard promise
    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })

  it('stays quiet when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    render(<CopyLinkButton url={url} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })
})
