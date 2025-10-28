#!/usr/bin/env tsx
/**
 * Test GitHub MCP Connection
 * Run this to verify your GitHub MCP server is set up correctly
 */

import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from both locations
dotenv.config({ path: path.join(__dirname, '../rag_system/.env') });
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORIES?.split(',')[0];

console.log('\n' + '='.repeat(60));
console.log('🧪 GitHub MCP Connection Test');
console.log('='.repeat(60) + '\n');

// Test 1: Check Environment Variables
console.log('📋 Test 1: Environment Variables');
console.log('-'.repeat(60));

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not found');
  console.log('   Add GITHUB_TOKEN to rag_system/.env\n');
} else if (GITHUB_TOKEN.startsWith('ghp_')) {
  console.log('✅ GITHUB_TOKEN found (starts with ghp_)');
} else {
  console.warn('⚠️  GITHUB_TOKEN might be invalid (should start with ghp_)');
}

if (!GITHUB_REPO) {
  console.error('❌ GITHUB_REPOSITORIES not found');
  console.log('   Add GITHUB_REPOSITORIES to rag_system/.env\n');
} else {
  console.log(`✅ GITHUB_REPOSITORIES set to: ${GITHUB_REPO}`);
}

console.log();

// Test 2: Test GitHub API Connection
console.log('📋 Test 2: GitHub API Connection');
console.log('-'.repeat(60));

async function testGitHubConnection() {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Tidal-MCP-Test',
      },
    });

    if (!response.ok) {
      console.error(`❌ GitHub API error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(`   Details: ${error.substring(0, 100)}`);
      return false;
    }

    const user = await response.json() as any;
    console.log(`✅ Connected to GitHub as: @${user.login}`);
    return true;
  } catch (err) {
    console.error(`❌ Connection failed: ${err}`);
    return false;
  }
}

// Test 3: Test Repository Access
console.log('📋 Test 3: Repository Access');
console.log('-'.repeat(60));

async function testRepoAccess() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Tidal-MCP-Test',
      },
    });

    if (!response.ok) {
      console.error(`❌ Cannot access repo: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.error(`   Repository not found: ${GITHUB_REPO}`);
      } else if (response.status === 403) {
        console.error(`   Access denied - check token permissions`);
      }
      return false;
    }

    const repo = await response.json() as any;
    console.log(`✅ Repository found: ${repo.full_name}`);
    console.log(`   Visibility: ${repo.private ? 'Private' : 'Public'}`);
    console.log(`   Stars: ${repo.stargazers_count}`);
    return true;
  } catch (err) {
    console.error(`❌ Repo access failed: ${err}`);
    return false;
  }
}

// Test 4: Test File Reading
console.log('📋 Test 4: File Reading');
console.log('-'.repeat(60));

async function testFileReading() {
  try {
    // Try multiple common paths for Aurora components
    const possiblePaths = [
      'src/components/Button.tsx',
      'components/Button.tsx',
      'src/Button.tsx',
      'packages/components/src/Button.tsx',
      'lib/components/Button.tsx',
    ];

    let found = false;
    for (const filePath of possiblePaths) {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'Tidal-MCP-Test',
          },
        }
      );

      if (response.ok) {
        const content = await response.text();
        console.log(`✅ File reading works!`);
        console.log(`   File: ${filePath}`);
        console.log(`   Size: ${content.length} bytes`);
        console.log(`   Preview: ${content.substring(0, 100)}...`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn(`⚠️  No component files found in common paths`);
      console.log(`   Checked: ${possiblePaths.join(', ')}`);
      console.log(`   (Repository structure might be different)`);
    }
    return true;
  } catch (err) {
    console.error(`❌ File reading failed: ${err}`);
    return false;
  }
}

// Test 5: Test Component Search
console.log('📋 Test 5: Component Search');
console.log('-'.repeat(60));

async function testComponentSearch() {
  try {
    // Search for TypeScript/React files
    const queries = [
      `repo:${GITHUB_REPO} extension:tsx`,
      `repo:${GITHUB_REPO} extension:ts path:component`,
      `repo:${GITHUB_REPO} extension:ts path:src`,
    ];

    let totalFound = 0;
    let foundFiles: any[] = [];

    for (const query of queries) {
      const response = await fetch(
        `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=5`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Tidal-MCP-Test',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as any;
        if (data.total_count > 0) {
          totalFound = data.total_count;
          foundFiles = data.items || [];
          break;
        }
      }
    }

    console.log(`✅ Component search works!`);
    console.log(`   Found ${totalFound} TypeScript files`);
    if (foundFiles.length > 0) {
      console.log(`   First 5:`);
      foundFiles.slice(0, 5).forEach((item: any, i: number) => {
        console.log(`      ${i + 1}. ${item.path}`);
      });
    } else {
      console.log(`   (No files found - repository might use different extension)`);
    }
    return true;
  } catch (err) {
    console.error(`❌ Search failed: ${err}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error('\n❌ Missing required environment variables\n');
    process.exit(1);
  }

  console.log();
  const test2 = await testGitHubConnection();
  console.log();

  if (test2) {
    const test3 = await testRepoAccess();
    console.log();

    if (test3) {
      await testFileReading();
      console.log();
      await testComponentSearch();
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log('✅ If all tests passed, your GitHub MCP is connected!');
  console.log('❌ If any tests failed, check the error messages above.\n');
}

runAllTests().catch(console.error);
