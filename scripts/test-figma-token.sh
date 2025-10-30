#!/bin/bash
# Test Figma Access Token

echo "🧪 Testing Figma Access Token"
echo "================================"
echo ""

# Check if .env.local exists
if [ ! -f "../tidal_ui/.env.local" ]; then
    echo "❌ .env.local not found"
    echo "💡 Create it at: tidal_ui/.env.local"
    exit 1
fi

# Extract token
TOKEN=$(grep FIGMA_ACCESS_TOKEN ../tidal_ui/.env.local | cut -d'=' -f2 | tr -d ' "' | tr -d "'")

if [ -z "$TOKEN" ]; then
    echo "❌ FIGMA_ACCESS_TOKEN not found in .env.local"
    echo ""
    echo "📝 Add this to tidal_ui/.env.local:"
    echo "FIGMA_ACCESS_TOKEN=figd_your_token_here"
    exit 1
fi

echo "🔑 Token found: ${TOKEN:0:20}..."
echo ""

# Test 1: Check if token is valid
echo "Test 1: Validating token..."
RESPONSE=$(curl -s -H "X-Figma-Token: $TOKEN" https://api.figma.com/v1/me)

if echo "$RESPONSE" | grep -q '"id"'; then
    NAME=$(echo "$RESPONSE" | grep -o '"handle":"[^"]*' | cut -d'"' -f4)
    EMAIL=$(echo "$RESPONSE" | grep -o '"email":"[^"]*' | cut -d'"' -f4)
    echo "✅ Token is valid!"
    echo "   User: $NAME"
    echo "   Email: $EMAIL"
else
    echo "❌ Token is invalid"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""

# Test 2: Check if Aurora file URL is set
FILE_URL=$(grep FIGMA_AURORA_FILE_URL ../tidal_ui/.env.local | cut -d'=' -f2 | tr -d ' "' | tr -d "'")

if [ -z "$FILE_URL" ]; then
    echo "⚠️  FIGMA_AURORA_FILE_URL not set"
    echo ""
    echo "📝 Add your Aurora file URL to .env.local:"
    echo "FIGMA_AURORA_FILE_URL=https://www.figma.com/file/YOUR_FILE_KEY/Aurora"
    echo ""
    echo "✅ Token test passed! Add file URL to complete setup."
    exit 0
fi

# Extract file key from URL (supports both /file/ and /design/ formats)
FILE_KEY=$(echo "$FILE_URL" | grep -oE '/(file|design)/[^/?]*' | cut -d'/' -f3)

if [ -z "$FILE_KEY" ]; then
    echo "❌ Invalid file URL format"
    echo "Should be: https://www.figma.com/file/ABC123/Aurora"
    echo "       or: https://www.figma.com/design/ABC123/Aurora"
    exit 1
fi

echo "Test 2: Accessing Aurora file..."
echo "   File key: $FILE_KEY"

FILE_RESPONSE=$(curl -s -H "X-Figma-Token: $TOKEN" "https://api.figma.com/v1/files/$FILE_KEY")

if echo "$FILE_RESPONSE" | grep -q '"name"'; then
    FILE_NAME=$(echo "$FILE_RESPONSE" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "✅ Can access file!"
    echo "   File name: $FILE_NAME"
else
    echo "❌ Cannot access file"
    echo "   Make sure you have access to this file"
    exit 1
fi

echo ""
echo "================================"
echo "✅ All tests passed!"
echo ""
echo "🚀 Next steps:"
echo "1. Restart Tidal: cd tidal_ui && npm run dev"
echo "2. Try: 'Create a button using Aurora'"
echo "3. Look for: '✅ Aurora design tokens extracted from Figma'"

