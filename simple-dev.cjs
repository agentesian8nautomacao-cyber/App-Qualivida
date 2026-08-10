const { createServer } = require('vite');

async function startServer() {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    server: {
      port: 3008,
      host: 'localhost'
    },
    plugins: []
  });

  await server.listen();
  console.log('Server running at http://localhost:3008');
}

startServer().catch(console.error);