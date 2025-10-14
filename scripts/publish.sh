#!/bin/bash
# Publishing script for ExaFlow

set -e

echo "🚀 ExaFlow Publishing Script"
echo "=============================="

# Check if we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "❌ Error: Must be on main/master branch to publish"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is not clean"
    echo "Please commit or stash changes first"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "📦 Publishing version: $VERSION"

# Ask for confirmation
echo
read -p "Are you sure you want to publish version $VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publishing cancelled"
    exit 0
fi

# Run tests
echo "🧪 Running tests..."
bun test

# Build project
echo "🔨 Building project..."
bun run build

# Check if npm is logged in
echo "🔐 Checking npm authentication..."
if ! npm whoami >/dev/null 2>&1; then
    echo "❌ Error: Not logged in to npm"
    echo "Please run: npm login"
    exit 1
fi

# Publish to npm
echo "📤 Publishing to npm..."
npm publish --access public

# Create git tag
echo "🏷️ Creating git tag..."
git tag "v$VERSION"
git push origin "v$VERSION"

echo
echo "✅ Successfully published ExaFlow v$VERSION!"
echo "📊 Package available at: https://www.npmjs.com/package/exaflow"
echo "🏷️ Tag created: v$VERSION"