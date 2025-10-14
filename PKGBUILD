# Maintainer: ExaFlow Team <support@exaflow.dev>
# Contributor: Your Name <your.email@example.com>

pkgname=exaflow
pkgver=2.1.0
pkgrel=1
pkgdesc="🚀 Advanced semantic search & AI integration toolkit with Exa API and MCP server support"
arch=('x86_64' 'aarch64' 'armv7h')
url="https://github.com/codewithkenzo/exa-personal-tool"
license=('MIT')
depends=('nodejs>=18.0.0')
makedepends=('npm' 'git')
optdepends=('bun: Faster JavaScript runtime (recommended)')
provides=('exaflow' 'exaflow-mcp')
conflicts=('exaflow-bin')
source=(
  "$pkgname-$pkgver.tar.gz::$url/archive/v$pkgver.tar.gz"
  "exaflow.sh"
  "exaflow-mcp.sh"
)
sha256sums=(
  'SKIP'  # Will be populated automatically
  'SKIP'  # exaflow.sh
  'SKIP'  # exaflow-mcp.sh
)

prepare() {
  cd "$pkgname-$pkgver"

  # Setup npm configuration
  npm config set cache "$srcdir/.npm"

  # Install dependencies
  npm install --production=false

  # Build the project
  npm run build
}

package() {
  cd "$pkgname-$pkgver"

  # Install package in production mode
  npm install --production=true --prefix="$pkgdir"

  # Install wrapper scripts
  install -Dm755 ../exaflow.sh "$pkgdir/usr/bin/exaflow"
  install -Dm755 ../exaflow-mcp.sh "$pkgdir/usr/bin/exaflow-mcp"

  # Install documentation
  install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
  install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
  install -Dm644 CHANGELOG.md "$pkgdir/usr/share/doc/$pkgname/CHANGELOG.md"
  install -Dm644 API.md "$pkgdir/usr/share/doc/$pkgname/API.md"

  # Install package.json for reference
  install -Dm644 package.json "$pkgdir/usr/share/doc/$pkgname/package.json"

  # Remove npm installation artifacts that aren't needed
  rm -rf "$pkgdir"/{node_modules/.cache,node_modules/.bin}
}

check() {
  cd "$pkgname-$pkgver"

  # Run tests if they exist
  if [ -f "package.json" ] && npm run test --if-present; then
    npm test
  fi
}

post_install() {
  echo
  echo "🚀 ExaFlow v$pkgver has been installed successfully!"
  echo
  echo "Quick start:"
  echo "  export EXA_API_KEY=your_api_key_here"
  echo "  exaflow --version"
  echo "  exaflow context 'test query' --tokens 100"
  echo
  echo "For MCP server:"
  echo "  exaflow-mcp"
  echo
  echo "Documentation:"
  echo "  man exaflow"
  echo "  https://github.com/codewithkenzo/exa-personal-tool"
  echo
}

post_upgrade() {
  post_install
}

post_remove() {
  echo
  echo "ExaFlow has been removed."
  echo "Your configuration files in ~/.config/exaflow/ remain."
  echo
}