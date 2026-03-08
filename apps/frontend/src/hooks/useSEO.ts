/**
 * React Hook for managing page SEO metadata
 * Automatically updates document head when component mounts or metadata changes
 */

import { useEffect } from 'react';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  twitterCard?: string;
  canonicalUrl?: string;
  robots?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  structuredData?: Record<string, any>;
}

/**
 * useSEO Hook - Update document head metadata for better SEO
 * @param metadata - SEO metadata object
 * 
 * Example usage:
 * useSEO({
 *   title: 'Page Title',
 *   description: 'Page description',
 *   keywords: ['keyword1', 'keyword2'],
 *   canonicalUrl: 'https://example.com/page'
 * });
 */
export function useSEO(metadata: SEOMetadata): void {
  useEffect(() => {
    // Update title
    document.title = metadata.title;

    // Helper function to update or create meta tag
    const updateMetaTag = (name: string, content: string, isProperty = false): void => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let metaTag = document.querySelector(selector) as HTMLMetaElement;

      if (!metaTag) {
        metaTag = document.createElement('meta');
        isProperty ? metaTag.setAttribute('property', name) : metaTag.setAttribute('name', name);
        document.head.appendChild(metaTag);
      }
      metaTag.content = content;
    };

    // Update standard meta tags
    updateMetaTag('description', metadata.description);

    if (metadata.keywords && metadata.keywords.length > 0) {
      updateMetaTag('keywords', metadata.keywords.join(', '));
    }

    if (metadata.robots) {
      updateMetaTag('robots', metadata.robots);
    }

    if (metadata.author) {
      updateMetaTag('author', metadata.author);
    }

    // Update Open Graph tags
    updateMetaTag('og:title', metadata.title, true);
    updateMetaTag('og:description', metadata.description, true);

    if (metadata.ogImage) {
      updateMetaTag('og:image', metadata.ogImage, true);
    }

    if (metadata.ogType) {
      updateMetaTag('og:type', metadata.ogType, true);
    }

    if (metadata.ogUrl) {
      updateMetaTag('og:url', metadata.ogUrl, true);
    }

    // Update Twitter Card tags
    if (metadata.twitterCard) {
      updateMetaTag('twitter:card', metadata.twitterCard);
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

    // Update structured data (JSON-LD)
    if (metadata.structuredData) {
      let scriptTag = document.querySelector('script[data-seo-structured="true"]') as HTMLScriptElement;
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.type = 'application/ld+json';
        scriptTag.setAttribute('data-seo-structured', 'true');
        document.head.appendChild(scriptTag);
      }
      scriptTag.innerHTML = JSON.stringify(metadata.structuredData);
    }

    // Update published/modified dates if provided
    if (metadata.publishedDate) {
      updateMetaTag('article:published_time', metadata.publishedDate, true);
    }

    if (metadata.modifiedDate) {
      updateMetaTag('article:modified_time', metadata.modifiedDate, true);
    }

    // Cleanup function (optional - maintains one instance of dynamic meta tags)
    return () => {
      // You could optionally reset to defaults here if needed
    };
  }, [metadata]);
}

/**
 * Helper function to create breadcrumb structured data
 */
export function createBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): Record<string, any> {
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
 * Helper function to create FAQ structured data
 */
export function createFAQSchema(faqs: Array<{ question: string; answer: string }>): Record<string, any> {
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
 * Helper function to create article schema
 */
export function createArticleSchema(article: {
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
  author: string;
  articleBody: string;
}): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.headline,
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    description: article.description,
    articleBody: article.articleBody,
  };
}
