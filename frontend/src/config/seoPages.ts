/**
 * SEO Page Configuration Examples
 * Shows how to implement SEO metadata across different pages
 */

import type { SEOMetadata } from '../utils/seoConfig';

/**
 * Landing Page SEO
 */
export const landingPageSEO: SEOMetadata = {
  title: 'SysLab - System Design Simulator | Learn Interactive System Architecture',
  description: 'Master system design with SysLab\'s interactive platform. Build, simulate, and analyze distributed systems with drag-and-drop components, real-time performance metrics, and hands-on learning scenarios.',
  keywords: [
    'system design',
    'learning platform',
    'simulator',
    'architecture',
    'distributed systems',
    'engineering education'
  ],
  ogUrl: 'https://syslab.io',
  canonicalUrl: 'https://syslab.io',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Components/Library Page SEO
 */
export const componentLibrarySEO: SEOMetadata = {
  title: 'Component Library - SysLab | Database, Cache, Load Balancer & More',
  description: 'Explore SysLab\'s comprehensive component library including databases, load balancers, caches, message queues, and more for building realistic distributed systems. Learn how each component works in practice.',
  keywords: [
    'component library',
    'database design',
    'load balancer',
    'cache',
    'message queue',
    'system design',
    'architecture components'
  ],
  ogUrl: 'https://syslab.io/components',
  canonicalUrl: 'https://syslab.io/components',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Pricing Page SEO
 */
export const pricingSEO: SEOMetadata = {
  title: 'Pricing - SysLab | Plans for Every Learner',
  description: 'Explore SysLab pricing plans. Free tier with full features, Pro for professionals, and Enterprise for teams. No credit card required. Start learning system design today.',
  keywords: [
    'pricing',
    'subscription plans',
    'cost',
    'free trial',
    'system design course'
  ],
  ogUrl: 'https://syslab.io/pricing',
  canonicalUrl: 'https://syslab.io/pricing',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Getting Started Guide SEO
 */
export const gettingStartedSEO: SEOMetadata = {
  title: 'Getting Started with SysLab | Step-by-Step Tutorial',
  description: 'Get started with SysLab in minutes with our comprehensive tutorial. Create your first system design simulation, learn the interface, and practice with guided scenarios.',
  keywords: [
    'getting started',
    'tutorial',
    'beginner guide',
    'system design basics',
    'how to'
  ],
  ogUrl: 'https://syslab.io/getting-started',
  canonicalUrl: 'https://syslab.io/getting-started',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Learning Scenarios Page SEO
 */
export const scenariosSEO: SEOMetadata = {
  title: 'Learning Scenarios - SysLab | System Design Challenges & Exercises',
  description: 'Practice system design with guided scenarios. Real-world challenges with performance objectives, expert feedback, and progressive difficulty levels. Learn from mistakes and improve your skills.',
  keywords: [
    'learning scenarios',
    'challenges',
    'exercises',
    'practice',
    'system design problems'
  ],
  ogUrl: 'https://syslab.io/scenarios',
  canonicalUrl: 'https://syslab.io/scenarios',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * About Page SEO
 */
export const aboutPageSEO: SEOMetadata = {
  title: 'About SysLab | Democratizing System Design Education',
  description: 'Learn about SysLab\'s mission to make system design education accessible to everyone. Discover our story, team, and commitment to helping engineers master distributed systems.',
  keywords: [
    'about us',
    'mission',
    'team',
    'education',
    'system design learning'
  ],
  ogUrl: 'https://syslab.io/about',
  canonicalUrl: 'https://syslab.io/about',
  ogType: 'website',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Authentication Pages (Non-Indexed)
 */
export const loginPageSEO: SEOMetadata = {
  title: 'Login - SysLab',
  description: 'Login to your SysLab account to access your workspaces and learning progress.',
  ogUrl: 'https://syslab.io/login',
  canonicalUrl: 'https://syslab.io/login',
  robots: 'noindex, follow',
};

export const signupPageSEO: SEOMetadata = {
  title: 'Sign Up - SysLab | Start Learning System Design Today',
  description: 'Create a free SysLab account and start learning system design immediately. Full access to component library and learning scenarios.',
  keywords: ['sign up', 'register', 'free account'],
  ogUrl: 'https://syslab.io/signup',
  canonicalUrl: 'https://syslab.io/signup',
  robots: 'index, follow, max-snippet:-1, max-image-preview:large',
};

/**
 * Dashboard Pages (Non-Indexed)
 */
export const dashboardSEO: SEOMetadata = {
  title: 'Dashboard - SysLab Workspace',
  description: 'Your personal SysLab dashboard. Access your workspaces, scenarios, and learning progress.',
  ogUrl: 'https://syslab.io/dashboard',
  canonicalUrl: 'https://syslab.io/dashboard',
  robots: 'noindex, follow',
};

export const workspacesSEO: SEOMetadata = {
  title: 'My Workspaces - SysLab',
  description: 'Manage your system design workspaces and simulations.',
  ogUrl: 'https://syslab.io/workspaces',
  canonicalUrl: 'https://syslab.io/workspaces',
  robots: 'noindex, follow',
};

/**
 * User Profile Pages (Non-Indexed)
 */
export const profilePageSEO: SEOMetadata = {
  title: 'My Profile - SysLab',
  description: 'View and edit your SysLab profile, progress statistics, and learning achievements.',
  ogUrl: 'https://syslab.io/profile',
  canonicalUrl: 'https://syslab.io/profile',
  robots: 'noindex, follow',
};

export const settingsPageSEO: SEOMetadata = {
  title: 'Settings - SysLab',
  description: 'Manage your SysLab settings, preferences, and account options.',
  ogUrl: 'https://syslab.io/settings',
  canonicalUrl: 'https://syslab.io/settings',
  robots: 'noindex, follow',
};

export const subscriptionPageSEO: SEOMetadata = {
  title: 'Subscription - SysLab | Manage Your Plan',
  description: 'Manage your SysLab subscription, view your current plan, and explore upgrade options.',
  keywords: ['subscription', 'plan', 'upgrade', 'account'],
  ogUrl: 'https://syslab.io/subscription',
  canonicalUrl: 'https://syslab.io/subscription',
  robots: 'noindex, follow',
};

/**
 * Admin Pages (Non-Indexed)
 */
export const adminPanelSEO: SEOMetadata = {
  title: 'Admin Panel - SysLab',
  description: 'SysLab administration panel for user management and system monitoring.',
  ogUrl: 'https://syslab.io/admin',
  canonicalUrl: 'https://syslab.io/admin',
  robots: 'noindex, nofollow',
};

/**
 * Legal Pages
 */
export const privacyPageSEO: SEOMetadata = {
  title: 'Privacy Policy - SysLab',
  description: 'SysLab\'s privacy policy. Learn how we protect your data and respect your privacy.',
  ogUrl: 'https://syslab.io/privacy',
  canonicalUrl: 'https://syslab.io/privacy',
  robots: 'index, follow',
};

export const termsPageSEO: SEOMetadata = {
  title: 'Terms of Service - SysLab',
  description: 'SysLab\'s terms of service. Review the conditions and policies that govern your use of our platform.',
  ogUrl: 'https://syslab.io/terms',
  canonicalUrl: 'https://syslab.io/terms',
  robots: 'index, follow',
};

/**
 * Blog/Article Page Template
 * Use for any blog posts or articles
 */
export function createArticleSEO(article: {
  title: string;
  description: string;
  slug: string;
  publishedDate: string;
  modifiedDate: string;
  author: string;
  image: string;
}): SEOMetadata {
  return {
    title: `${article.title} - SysLab Blog`,
    description: article.description,
    ogUrl: `https://syslab.io/blog/${article.slug}`,
    canonicalUrl: `https://syslab.io/blog/${article.slug}`,
    ogImage: article.image,
    ogType: 'article',
    publishedDate: article.publishedDate,
    modifiedDate: article.modifiedDate,
    author: article.author,
    robots: 'index, follow, max-snippet:-1, max-image-preview:large',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.description,
      image: article.image,
      datePublished: article.publishedDate,
      dateModified: article.modifiedDate,
      author: {
        '@type': 'Person',
        name: article.author,
      },
    },
  };
}
