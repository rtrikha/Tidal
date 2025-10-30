/**
 * Test Figma MCP Connection
 * Verifies connection to Figma Desktop MCP server and fetches design tokens
 */

import { testFigmaMCPConnection, getAuroraDesignTokens, listAuroraComponentsFromFigma, listFigmaTools } from '../tidal_ui/lib/figma-mcp';

async function main() {
  console.log('🧪 Testing Figma MCP Integration\n');
  console.log('='.repeat(60));
  
  // Test 1: Connection
  console.log('\n📡 Test 1: Testing MCP Connection...');
  const isConnected = await testFigmaMCPConnection();
  
  if (!isConnected) {
    console.error('❌ Failed to connect to Figma MCP server');
    console.log('\n💡 Make sure:');
    console.log('   1. Figma Desktop is running');
    console.log('   2. Figma MCP server is enabled');
    console.log('   3. Server is running on http://127.0.0.1:3845/mcp');
    process.exit(1);
  }
  
  // Test 2: List available tools
  console.log('\n🛠️  Test 2: Listing available tools...');
  const tools = await listFigmaTools();
  console.log(`   Found ${tools.length} tools:`);
  tools.forEach(tool => console.log(`   - ${tool}`));
  
  // Test 3: Fetch design tokens
  console.log('\n🎨 Test 3: Fetching Aurora design tokens...');
  const tokens = await getAuroraDesignTokens();
  console.log('   Design tokens:');
  console.log('   ' + tokens.split('\n').slice(0, 15).join('\n   '));
  if (tokens.split('\n').length > 15) {
    console.log(`   ... and ${tokens.split('\n').length - 15} more lines`);
  }
  
  // Test 4: List components
  console.log('\n🧩 Test 4: Listing Aurora components...');
  const components = await listAuroraComponentsFromFigma();
  console.log(`   Found ${components.length} components:`);
  components.slice(0, 10).forEach(comp => console.log(`   - ${comp}`));
  if (components.length > 10) {
    console.log(`   ... and ${components.length - 10} more`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests passed!\n');
  console.log('🎉 Figma MCP is ready to use with Tidal Generator!');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

