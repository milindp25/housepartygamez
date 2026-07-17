import type { MetadataRoute } from 'next'
import { LAST_MODIFIED, SITE_URL, marketingRoutes } from '../lib/seo'

/** Generate `/sitemap.xml` from the shared indexable route registry. */
export default function sitemap(): MetadataRoute.Sitemap {
  return marketingRoutes().map((route) => ({
    url: route.path === '/' ? SITE_URL : `${SITE_URL}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
