import { initRepository } from './repo';
import { startServer } from './server';
import { startBot } from './bot';

async function main() {
  try {
    console.log('🚀 Starting Neiropsy Bot...');

    // Initialize database connection
    console.log('📦 Connecting to database...');
    await initRepository();
    console.log('✅ Database connected');

    // Start REST API server
    console.log('🌐 Starting REST API server...');
    await startServer();
    console.log('✅ REST API server started');

    // Start Telegram bot
    console.log('🤖 Starting Telegram bot...');
    await startBot();
    console.log('✅ Telegram bot started');

    console.log('🎉 All services started successfully!');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
