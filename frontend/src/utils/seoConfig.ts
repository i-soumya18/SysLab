/**
 * SEO Configuration and Utilities
 * Centralized SEO metadata management for SysLab
 */

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  twitterCardType?: string;
  canonicalUrl?: string;
  robots?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  structuredData?: Record<string, any>;
}

export const DEFAULT_SEO: SEOMetadata = {
  title: 'SysLab - System Design Simulator | Learn Interactive System Architecture',
  description: 'Master system design with SysLab\'s interactive platform. Build, simulate, and analyze distributed systems with drag-and-drop components, real-time performance metrics, and hands-on learning scenarios.',
  keywords: [
    'system design',
    'distributed systems',
    'learning platform',
    'simulation',
    'architecture',
    'database design',
    'scalability',
    'performance analytics',
    'microservices',
    'engineering education'
  ],
  ogImage: 'https://syslab.io/og-image.png',
  ogType: 'website',
  ogUrl: 'https://syslab.io',
  twitterCardType: 'summary_large_image',
  canonicalUrl: 'https://syslab.io',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  author: 'SysLab Team',
};

export const PAGE_SEO_CONFIG: Record<string, SEOMetadata> = {
  home: {
    title: 'SysLab - System Design Simulator | Learn Interactive System Architecture',
    description: 'Master system design with SysLab\'s interactive platform. Build, simulate, and analyze distributed systems with drag-and-drop components, real-time performance metrics, and hands-on learning scenarios.',
    keywords: ['system design', 'learning platform', 'simulator', 'architecture'],
    ogUrl: 'https://syslab.io',
    canonicalUrl: 'https://syslab.io',
  },
  about: {
    title: 'About SysLab - System Design Learning Reimagined',
    description: 'Learn about SysLab\'s mission to democratize system design education through interactive, hands-on learning experiences.',
    keywords: ['about', 'mission', 'education', 'system design'],
    ogUrl: 'https://syslab.io/about',
    canonicalUrl: 'https://syslab.io/about',
  },
  components: {
    title: 'Component Library - SysLab System Design Simulator',
    description: 'Explore SysLab\'s comprehensive component library including databases, load balancers, caches, message queues, and more for building distributed systems.',
    keywords: ['components', 'library', 'databases', 'load balancers', 'system design'],
    ogUrl: 'https://syslab.io/components',
    canonicalUrl: 'https://syslab.io/components',
  },
  pricing: {
    title: 'Pricing - SysLab | Affordable System Design Learning',
    description: 'Choose the perfect SysLab plan for your learning needs. Free, Pro, and Enterprise tiers available with comprehensive features.',
    keywords: ['pricing', 'plans', 'subscription', 'cost'],
    ogUrl: 'https://syslab.io/pricing',
    canonicalUrl: 'https://syslab.io/pricing',
  },
  gettingStarted: {
    title: 'Getting Started - Start Learning System Design Today',
    description: 'Get started with SysLab in minutes. Step-by-step guide to creating your first system design simulation.',
    keywords: ['getting started', 'tutorial', 'guide', 'beginner'],
    ogUrl: 'https://syslab.io/getting-started',
    canonicalUrl: 'https://syslab.io/getting-started',
  },
  scenarios: {
    title: 'Learning Scenarios - SysLab System Design Challenges',
    description: 'Practice system design with guided scenarios. Real-world challenges, performance objectives, and expert feedback.',
    keywords: ['scenarios', 'challenges', 'practice', 'exercises'],
    ogUrl: 'https://syslab.io/scenarios',
    canonicalUrl: 'https://syslab.io/scenarios',
  },
  dashboard: {
    title: 'Dashboard - SysLab Workspace',
    description: 'Your SysLab dashboard. Access your workspaces, scenarios, and learning progress.',
    keywords: ['dashboard', 'workspace', 'projects'],
    robots: 'noindex, follow',
  },
  workspaces: {
    title: 'My Workspaces - SysLab',
    description: 'Manage your system design workspaces and simulations.',
    keywords: ['workspaces', 'projects', 'designs'],
    robots: 'noindex, follow',
  },
};

/**
 * Generate structured data for WebApplication schema
 */
export function generateWebApplicationSchema(): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'SysLab',
    alternateName: 'System Design Simulator',
    description: 'Interactive platform to learn, practice, and experiment with system design components',
    url: 'https://syslab.io',
    image: 'https://syslab.io/og-image.png',
    applicationCategory: 'EducationalApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '250',
      reviewCount: '120',
    },
  };
}

/**
 * Generate structured data for BreadcrumbList schema
 */
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Generate structured data for FAQPage schema
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Update page metadata dynamically
 * Use this in your page components with useEffect
 */
export function updatePageMetadata(metadata: SEOMetadata): void {
  // Update title
  document.title = metadata.title;

  // Update or create meta tags
  const updateMetaTag = (name: string, content: string): void => {
    let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', name);
      document.head.appendChild(metaTag);
    }
    metaTag.content = content;
  };

  const updateOGTag = (property: string, content: string): void => {
    let metaTag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }
    metaTag.content = content;
  };

  // Update standard meta tags
  updateMetaTag('description', metadata.description);
  if (metadata.keywords) {
    updateMetaTag('keywords', metadata.keywords.join(', '));
  }
  if (metadata.robots) {
    updateMetaTag('robots', metadata.robots);
  }
  if (metadata.author) {
    updateMetaTag('author', metadata.author);
  }

  // Update Open Graph tags
  updateOGTag('og:title', metadata.title);
  updateOGTag('og:description', metadata.description);
  if (metadata.ogImage) {
    updateOGTag('og:image', metadata.ogImage);
  }
  if (metadata.ogType) {
    updateOGTag('og:type', metadata.ogType);
  }
  if (metadata.ogUrl) {
    updateOGTag('og:url', metadata.ogUrl);
  }

  // Update canonical URL
  if (metadata.canonicalUrl) {
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = metadata.canonicalUrl;
  }

  // Update structured data if provided
  if (metadata.structuredData) {
    let scriptTag = document.querySelector('script[type="application/ld+json"][data-seo="true"]') as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.setAttribute('data-seo', 'true');
      document.head.appendChild(scriptTag);
    }
    scriptTag.innerHTML = JSON.stringify(metadata.structuredData);
  }
}

/**
 * React Hook for managing page metadata
 * Usage: useSEO(PAGE_SEO_CONFIG.home);
 */
export function useSEO(metadata: SEOMetadata): void {
  React.useEffect(() => {
    updatePageMetadata(metadata);
  }, [metadata]);
}

// Export for use in React
import React from 'react';
