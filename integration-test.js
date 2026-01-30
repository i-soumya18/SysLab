#!/usr/bin/env node

/**
 * Integration test to verify project setup
 * This script checks that all components are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running System Design Simulator integration test...\n');

const checks = [
  {
    name: 'Root package.json exists',
    check: () => fs.existsSync('package.json'),
  },
  {
    name: 'Frontend directory exists',
    check: () => fs.existsSync('frontend') && fs.statSync('frontend').isDirectory(),
  },
  {
    name: 'Backend directory exists', 
    check: () => fs.existsSync('backend') && fs.statSync('backend').isDirectory(),
  },
  {
    name: 'Frontend package.json exists',
    check: () => fs.existsSync('frontend/package.json'),
  },
  {
    name: 'Backend package.json exists',
    check: () => fs.existsSync('backend/package.json'),
  },
  {
    name: 'Docker Compose configuration exists',
    check: () => fs.existsSync('docker-compose.yml'),
  },
  {
    name: 'Database initialization script exists',
    check: () => fs.existsSync('database/init.sql'),
  },
  {
    name: 'Backend TypeScript configuration exists',
    check: () => fs.existsSync('backend/tsconfig.json'),
  },
  {
    name: 'Frontend Vite configuration exists',
    check: () => fs.existsSync('frontend/vite.config.ts'),
  },
  {
    name: 'Backend source directory exists',
    check: () => fs.existsSync('backend/src') && fs.statSync('backend/src').isDirectory(),
  },
  {
    name: 'Backend routes directory exists',
    check: () => fs.existsSync('backend/src/routes') && fs.statSync('backend/src/routes').isDirectory(),
  },
  {
    name: 'Backend config directory exists',
    check: () => fs.existsSync('backend/src/config') && fs.statSync('backend/src/config').isDirectory(),
  },
  {
    name: 'Development setup script exists',
    check: () => fs.existsSync('scripts/setup-dev.sh'),
  },
  {
    name: 'README file exists',
    check: () => fs.existsSync('README.md'),
  },
  {
    name: 'Environment example file exists',
    check: () => fs.existsSync('backend/.env.example'),
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  try {
    if (check()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name} (Error: ${error.message})`);
    failed++;
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All integration tests passed! Project setup is complete.');
  process.exit(0);
} else {
  console.log('❌ Some integration tests failed. Please check the project setup.');
  process.exit(1);
}