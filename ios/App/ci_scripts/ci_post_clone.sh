#!/bin/sh

# =============================================================================
# Xcode Cloud - ci_post_clone.sh
# Runs automatically after the repo is cloned in Xcode Cloud.
# Purpose: Install Node, build Ionic/Angular app, sync Capacitor to iOS.
# =============================================================================

set -e  # Exit immediately on any error

echo "========================================"
echo "▶ Xcode Cloud Post-Clone Script Starting"
echo "========================================"

# ------------------------------------------------------------------------------
# 1. Install Node.js 24 via nvm
#    (brew is blocked in Xcode Cloud sandbox; nvm downloads from nodejs.org)
# ------------------------------------------------------------------------------
echo "\n▶ [1/6] Installing Node.js 24 via nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"   # load nvm
nvm install 24
nvm use 24
node -v
npm -v

# ------------------------------------------------------------------------------
# 2. Navigate to project root (3 levels up from ios/App/ci_scripts/)
# ------------------------------------------------------------------------------
PROJECT_ROOT="$(dirname "$0")/../../../"
echo "\n▶ [2/6] Moving to project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ------------------------------------------------------------------------------
# 3. Write .env file from Xcode Cloud Environment Variables
#    Add each of these as Environment Variables in your Xcode Cloud workflow:
#    Xcode → Workflow Editor → Environment → Environment Variables
# ------------------------------------------------------------------------------
echo "\n▶ [3/6] Writing .env file from Xcode Cloud environment variables..."

cat > .env <<EOF
# api config
API_URL="${API_URL}"
SOCKET_URL="${SOCKET_URL}"
FRONTEND_URL="${FRONTEND_URL}"
DASHBOARD_URL="${DASHBOARD_URL}"
TENOR_API_KEY="${TENOR_API_KEY}"
MAPTILER_API_KEY="${MAPTILER_API_KEY}"
UNSPLASH_API_KEY="${UNSPLASH_API_KEY}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"

# firebase config
FIREBASE_APP_ID="${FIREBASE_APP_ID}"
FIREBASE_API_KEY="${FIREBASE_API_KEY}"
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}"
FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}"
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}"
FIREBASE_MEASUREMENT_ID="${FIREBASE_MEASUREMENT_ID}"
FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}"
EOF

echo ".env file written successfully ✅"

# ------------------------------------------------------------------------------
# 4. Install npm dependencies
# ------------------------------------------------------------------------------
echo "\n▶ [4/6] Installing npm dependencies..."
npm install

# ------------------------------------------------------------------------------
# 5. Build Ionic Angular app & sync Capacitor to iOS
# ------------------------------------------------------------------------------
echo "\n▶ [5/6] Building Ionic Angular app..."
npm run build

echo "\n▶ Syncing Capacitor to iOS..."
npx cap sync ios

# ------------------------------------------------------------------------------
# 6. Delete .env file — remove secrets from the CI runner filesystem
# ------------------------------------------------------------------------------
echo "\n▶ [6/6] Cleaning up .env file..."
rm -f .env
echo ".env file deleted ✅"

echo "\n========================================"
echo "✅ Post-clone script complete!"
echo "   Xcode Cloud will now build the native iOS app."
echo "========================================"
