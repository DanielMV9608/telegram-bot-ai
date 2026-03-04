import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://telegram-bot-danielmv9608.aws-us-east-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI2MzM1NDcsImlkIjoiMDE5Y2I5MmYtYzkwMS03ZGU4LWEzZjMtNzk3YTU4MWNlNDdlIiwicmlkIjoiMmVkOGE3NzMtZTMxMy00ZmVhLWI2YmUtNzRmZWMwN2M0MzJiIn0.VIKLz7BrnFk427VQoxDH7NGCipvw8FI08qrpK-6btX1fESyMzejpCq8YJE8dA_j31CZBJl76o_AiqOWpEJKsCA',
});

async function setupKnowledge() {
  console.log('Creando tabla KnowledgeBase...');
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS KnowledgeBase (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT,
      sourceUrl TEXT,
      fileName TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ Tabla KnowledgeBase creada');
}

setupKnowledge().catch(console.error);
