import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://telegram-bot-danielmv9608.aws-us-east-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI2MzM1NDcsImlkIjoiMDE5Y2I5MmYtYzkwMS03ZGU4LWEzZjMtNzk3YTU4MWNlNDdlIiwicmlkIjoiMmVkOGE3NzMtZTMxMy00ZmVhLWI2YmUtNzRmZWMwN2M0MzJiIn0.VIKLz7BrnFk427VQoxDH7NGCipvw8FI08qrpK-6btX1fESyMzejpCq8YJE8dA_j31CZBJl76o_AiqOWpEJKsCA',
});

async function addAIFields() {
  console.log('Agregando campos de configuración de IA...');
  
  try {
    // Agregar columnas a BotConfig
    await client.execute(`ALTER TABLE BotConfig ADD COLUMN aiProvider TEXT DEFAULT 'zai'`);
    console.log('✅ Columna aiProvider agregada');
  } catch (e) {
    console.log('⚠️ aiProvider ya existe o error:', String(e));
  }
  
  try {
    await client.execute(`ALTER TABLE BotConfig ADD COLUMN aiApiKey TEXT`);
    console.log('✅ Columna aiApiKey agregada');
  } catch (e) {
    console.log('⚠️ aiApiKey ya existe o error:', String(e));
  }
  
  try {
    await client.execute(`ALTER TABLE BotConfig ADD COLUMN aiModel TEXT DEFAULT 'gpt-4o-mini'`);
    console.log('✅ Columna aiModel agregada');
  } catch (e) {
    console.log('⚠️ aiModel ya existe o error:', String(e));
  }
  
  console.log('\n🎉 ¡Configuración de IA actualizada!');
}

addAIFields().catch(console.error);
