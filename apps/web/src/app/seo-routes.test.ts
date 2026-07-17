import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import robots from './robots'
import { SITE_URL, marketingRoutes } from '../lib/seo'

describe('sitemap', () => {
  it('emits one absolute-URL entry per marketing route', () => {
    const entries = sitemap()
    expect(entries).toHaveLength(marketingRoutes().length)
    for (const entry of entries) {
      expect(entry.url === SITE_URL || entry.url.startsWith(`${SITE_URL}/`)).toBe(true)
      expect(entry.lastModified).toBeDefined()
    }
  })

  it('maps the home route to the bare origin (no trailing slash)', () => {
    const home = sitemap().find((entry) => entry.url === SITE_URL)
    expect(home).toBeDefined()
    expect(home!.priority).toBe(1)
  })
})

describe('robots', () => {
  it('allows crawling the root and disallows the app controllers', () => {
    const policy = robots()
    const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules
    expect(rule.allow).toBe('/')
    expect(rule.disallow).toEqual(['/host', '/join'])
  })

  it('points crawlers at the absolute sitemap URL', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
