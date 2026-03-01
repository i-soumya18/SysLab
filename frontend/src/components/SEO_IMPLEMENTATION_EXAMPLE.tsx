/**
 * Example Component: How to Use SEO Utilities
 * 
 * This file demonstrates how to implement the SEO utilities in your page components.
 * Copy this pattern to apply SEO metadata to any page in SysLab.
 */

import { useSEO, createBreadcrumbSchema } from '../hooks/useSEO';
import { landingPageSEO } from '../config/seoPages';

/**
 * Example 1: Simple Page with Basic SEO
 */
export function ExampleBasicPage() {
  useSEO({
    title: 'Example Page Title',
    description: 'This is a clear, concise description of the page content (150-160 characters).',
    keywords: ['keyword1', 'keyword2', 'keyword3'],
    canonicalUrl: 'https://syslab.io/example',
  });

  return (
    <div>
      <h1>Example Page</h1>
      <p>Your page content goes here...</p>
    </div>
  );
}

/**
 * Example 2: Page with Structured Data and Breadcrumbs
 */
export function ExampleStructuredDataPage() {
  useSEO({
    title: 'Learning Scenarios - SysLab System Design Challenges',
    description: 'Practice system design with guided scenarios and real-world challenges.',
    keywords: ['scenarios', 'challenges', 'exercises', 'practice'],
    canonicalUrl: 'https://syslab.io/scenarios',
    // Add breadcrumb structured data
    structuredData: createBreadcrumbSchema([
      { name: 'Home', url: 'https://syslab.io' },
      { name: 'Learning', url: 'https://syslab.io/learning' },
      { name: 'Scenarios', url: 'https://syslab.io/scenarios' },
    ]),
  });

  return (
    <div>
      <nav aria-label="breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/learning">Learning</a></li>
          <li aria-current="page">Scenarios</li>
        </ol>
      </nav>
      
      <h1>Learning Scenarios</h1>
      <p>Choose a scenario to practice system design...</p>
    </div>
  );
}

/**
 * Example 3: Page with Predefined SEO Config
 * Using seoPages.ts configuration files
 */
export function ExampleLandingPage() {
  // Using predefined SEO config from seoPages.ts
  useSEO(landingPageSEO);

  return (
    <div>
      <h1>Welcome to SysLab</h1>
      <p>Your system design learning platform...</p>
    </div>
  );
}

/**
 * Example 4: Page with Social Media Optimization
 */
export function ExampleSocialPage() {
  useSEO({
    title: 'System Design Components - SysLab Library',
    description: 'Explore 50+ system design components with interactive examples.',
    keywords: ['components', 'library', 'system design'],
    canonicalUrl: 'https://syslab.io/components',
    // Social sharing meta tags
    ogImage: 'https://syslab.io/images/components-og.png',
    ogType: 'website',
    ogUrl: 'https://syslab.io/components',
    twitterCard: 'summary_large_image',
  });

  return (
    <div>
      <h1>Component Library</h1>
      <p>Explore all available system design components...</p>
    </div>
  );
}

/**
 * Example 5: Page with Dynamic Metadata
 * For pages where metadata depends on dynamic data
 */
export function ExampleDynamicPage({ pageTitle, pageDescription, slug }: any) {
  useSEO({
    title: `${pageTitle} - SysLab`,
    description: pageDescription,
    canonicalUrl: `https://syslab.io/${slug}`,
    keywords: ['dynamic', 'content'],
  });

  return (
    <div>
      <h1>{pageTitle}</h1>
      <p>{pageDescription}</p>
    </div>
  );
}

/**
 * SEO BEST PRACTICES CHECKLIST
 * 
 * When implementing SEO on a page, ensure:
 * 
 * ✓ Title
 *   - 50-60 characters (optimal)
 *   - Include primary keyword
 *   - Include brand name
 *   - Be compelling and descriptive
 * 
 * ✓ Description
 *   - 150-160 characters (optimal)
 *   - Include primary keyword naturally
 *   - Include call-to-action if appropriate
 *   - Make it compelling (influences CTR)
 * 
 * ✓ Keywords
 *   - 3-5 main keywords
 *   - Include long-tail keywords
 *   - Use naturally in content
 *   - Avoid keyword stuffing
 * 
 * ✓ Canonical URL
 *   - Use absolute URLs
 *   - Point to self (for current page)
 *   - Prevent duplicate content issues
 * 
 * ✓ Open Graph Tags
 *   - ogImage: 1200x630px recommended
 *   - ogTitle: Same as page title
 *   - ogDescription: Same as meta description
 *   - ogUrl: Absolute URL
 * 
 * ✓ Heading Hierarchy
 *   - One H1 per page
 *   - Logical H2, H3 structure
 *   - Include keywords naturally
 * 
 * ✓ Content
 *   - 300+ words for main pages
 *   - Unique, original content
 *   - Semantic HTML elements
 *   - Natural keyword usage
 * 
 * ✓ Links
 *   - Descriptive anchor text
 *   - Internal links (3-5 per page)
 *   - External links to authoritative sites
 *   - No broken links
 * 
 * ✓ Images
 *   - Descriptive alt text
 *   - Proper file names
 *   - Compressed for performance
 *   - Responsive sizing
 */

/**
 * SEO IMPLEMENTATION CHECKLIST FOR DEVELOPERS
 * 
 * Before deploying a new page:
 * 
 * [ ] Add useSEO hook with complete metadata
 * [ ] Create semantic HTML structure (h1, h2, nav, etc.)
 * [ ] Add descriptive alt text to all images
 * [ ] Internal linking strategy implemented
 * [ ] Content is 300+ words (if applicable)
 * [ ] No duplicate content with other pages
 * [ ] Page loads under 3 seconds
 * [ ] Mobile responsive and tested
 * [ ] No broken internal or external links
 * [ ] Structured data added (if applicable)
 * [ ] Tested with Google's Rich Results Test
 * [ ] Added to sitemap.xml
 * [ ] robots.txt updated if restrictive
 * [ ] Canonical URL is correct
 * [ ] OG images are optimized (1200x630)
 */

export default ExampleBasicPage;
