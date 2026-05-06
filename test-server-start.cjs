const http = require('http');

// Simple test to check if server is responding
const testServer = () => {
  console.log('🧪 Testing server connectivity...');

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/dashboard/stats',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test'
    }
  }, (res) => {
    console.log('✅ Server responded with status:', res.statusCode);
    process.exit(0);
  });

  req.on('error', (err) => {
    console.error('❌ Server connection failed:', err.message);
    process.exit(1);
  });

  req.setTimeout(5000, () => {
    console.error('❌ Server timeout');
    req.destroy();
    process.exit(1);
  });

  req.end();
};

// Start server in background and test
const { spawn } = require('child_process');
const server = spawn('node', ['server.cjs'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore'
});

console.log('🚀 Starting server...');
setTimeout(testServer, 3000); // Wait 3 seconds for server to start