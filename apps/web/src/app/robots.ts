import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/seo'

/** Allow public content while excluding transient host and join controllers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/host', '/join'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
