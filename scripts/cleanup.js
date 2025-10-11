#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const CONFIG = {
  localDocsDir: join(repoRoot, 'local_docs'),
  patternsFile: join(repoRoot, 'scripts', 'cleanup-patterns.txt'),
  filesToMove: [
    { src: 'plan.md', dest: 'plans/plan.md' },
    { src: 'plan2.md', dest: 'plans/plan2.md' },
    { src: 'todo-list.md', dest: 'notes/todo-list.md' },
    { src: 'CLAUDE.md', dest: 'instructions/CLAUDE.md' },
    { src: 'DEPLOYMENT_SUMMARY.md', dest: 'deployment/DEPLOYMENT_SUMMARY.md' },
    { src: 'FINAL_SUCCESS_REPORT.md', dest: 'test-results/FINAL_SUCCESS_REPORT.md' },
    { src: 'OUR_TOOL_TEST_RESULTS.md', dest: 'test-results/OUR_TOOL_TEST_RESULTS.md' },
    { src: 'TEST_RESULTS.md', dest: 'test-results/TEST_RESULTS.md' },
    { src: 'SCHEMA_FIXES_COMPLETE.md', dest: 'test-results/SCHEMA_FIXES_COMPLETE.md' }
  ],
  testFilesToArchive: [
    'debug-api.js',
    'demo-usage.js', 
    'test-cli-simple.js',
    'test-demo.js',
    'test-direct-api.js',
    'test-droid-integration.js',
    'test-exa-api.js',
    'test-our-tool.js'
  ]
};

function ensureLocalDocsDir() {
  const dirs = [
    CONFIG.localDocsDir,
    join(CONFIG.localDocsDir, 'instructions'),
    join(CONFIG.localDocsDir, 'plans'),
    join(CONFIG.localDocsDir, 'roadmaps'),
    join(CONFIG.localDocsDir, 'notes'),
    join(CONFIG.localDocsDir, 'test-results'),
    join(CONFIG.localDocsDir, 'deployment'),
    join(CONFIG.localDocsDir, 'archived-tests')
  ];
  
  dirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }
  });
}

function updateGitExclude() {
  const excludeFile = join(repoRoot, '.git', 'info', 'exclude');
  let content = '';
  
  if (existsSync(excludeFile)) {
    content = readFileSync(excludeFile, 'utf-8');
  }
  
  if (!content.includes('local_docs/')) {
    content += '\n# Local-only documentation (never pushed to remote)\nlocal_docs/\n';
    writeFileSync(excludeFile, content);
    console.log('✓ Updated .git/info/exclude');
  }
}

function moveFilesToLocalDocs() {
  console.log('Moving files to local_docs...');
  
  CONFIG.filesToMove.forEach(({ src, dest }) => {
    const srcPath = join(repoRoot, src);
    const destPath = join(CONFIG.localDocsDir, dest);
    
    if (existsSync(srcPath)) {
      // Ensure destination directory exists
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      
      renameSync(srcPath, destPath);
      console.log(`✓ Moved ${src} → local_docs/${dest}`);
    }
  });
  
  // Archive test files
  CONFIG.testFilesToArchive.forEach(file => {
    const srcPath = join(repoRoot, file);
    const destPath = join(CONFIG.localDocsDir, 'archived-tests', file);
    
    if (existsSync(srcPath)) {
      renameSync(srcPath, destPath);
      console.log(`✓ Archived ${file} → local_docs/archived-tests/${file}`);
    }
  });
}

function removeFromGitIndex() {
  console.log('Removing moved files from Git index...');
  
  const allMovedFiles = [
    ...CONFIG.filesToMove.map(f => f.src),
    ...CONFIG.testFilesToArchive
  ];
  
  allMovedFiles.forEach(file => {
    try {
      execSync(`git rm --cached ${file}`, { cwd: repoRoot, stdio: 'pipe' });
      console.log(`✓ Removed ${file} from Git index`);
    } catch (error) {
      // File might not be tracked, which is fine
      console.log(`- ${file} not tracked or already removed`);
    }
  });
}

function createPatternsFile() {
  const patterns = `# Git filter-repo patterns to remove from history
# Remove all .md files except README.md
--path-glob '*.md'
--path README.md
--invert-paths

# Remove instruction directories
--path llm/
--path instructions/
--path prompts/
--path docs/private/

# Remove planning directories  
--path plans/
--path roadmap/
--path roadmaps/

# Remove test artifacts and legacy
--path tests/legacy/
--path tests/fixtures/large/
--path debug-*.js
--path demo-*.js
--path test-*.js

# Remove result files
--path *-RESULTS.md
--path *-REPORT.md
--path *-SUMMARY.md
`;

  if (!existsSync(CONFIG.patternsFile)) {
    writeFileSync(CONFIG.patternsFile, patterns);
    console.log(`✓ Created patterns file: ${CONFIG.patternsFile}`);
  }
}

function runHistoryCleanup() {
  console.log('Running history cleanup with git-filter-repo...');
  console.log('⚠️  This will rewrite Git history!');
  console.log('⚠️  Make sure you have a backup!');
  
  try {
    execSync(`git filter-repo --config ${CONFIG.patternsFile}`, { 
      cwd: repoRoot, 
      stdio: 'inherit' 
    });
    console.log('✓ History cleanup completed');
  } catch (error) {
    console.error('❌ History cleanup failed:', error.message);
    console.log('💡 Make sure git-filter-repo is installed: pip install git-filter-repo');
  }
}

function showUsage() {
  console.log(`
Repository Cleanup Tool

Usage:
  node scripts/cleanup.js          # Move files and clean current index
  node scripts/cleanup.js --history # Full history rewrite (maintainer only)

What it does:
  1. Creates local_docs/ directory structure
  2. Updates .git/info/exclude to prevent tracking local docs
  3. Moves non-README .md files to local_docs/
  4. Archives test files locally
  5. Removes moved files from Git index
  6. (with --history) Rewrites repository history to remove patterns

After running with --history:
  git push origin --force --all
  git push origin --force --tags
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  console.log('🧹 Repository Cleanup Tool');
  console.log('================================');
  
  ensureLocalDocsDir();
  updateGitExclude();
  createPatternsFile();
  moveFilesToLocalDocs();
  removeFromGitIndex();
  
  console.log('\n✅ Daily cleanup completed!');
  console.log('📚 Documentation preserved in local_docs/');
  console.log('🚫 Files removed from Git tracking but kept locally');
  
  if (args.includes('--history')) {
    console.log('\n🔥 Running history cleanup...');
    runHistoryCleanup();
    console.log('\n⚠️  History rewritten! Collaborators must re-clone or reset.');
    console.log('💡 Force push to update remote: git push origin --force --all --tags');
  }
}

main();
