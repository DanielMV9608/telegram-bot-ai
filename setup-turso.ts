import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://telegram-bot-danielmv9608.aws-us-east-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI2MzM1NDcsImlkIjoiMDE5Y2I5MmYtYzkwMS03ZGU4LWEzZjMtNzk3YTU4MWNlNDdlIiwicmlkIjoiMmVkOGE3NzMtZTMxMy00ZmVhLWI2YmUtNzRmZWMwN2M0MzJiIn0.VIKLz7BrnFk427VQoxDH7NGCipvw8FI08qrpK-6btX1fESyMzejpCq8YJE8dA_j31CZBJl76o_AiqOWpEJKsCA',
});

async function setupDatabase() {
  console.log('Creando tablas en Turso...\n');

  // Crear tabla BotConfig
  await client.execute(`
    CREATE TABLE IF NOT EXISTS BotConfig (
      id TEXT PRIMARY KEY,
      token TEXT,
      botUsername TEXT,
      systemPrompt TEXT DEFAULT 'Eres un asistente de atención al cliente amable y profesional.',
      isActive INTEGER DEFAULT 0,
      webhookUrl TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabla BotConfig creada');

  // Crear tabla Lead
  await client.execute(`
    CREATE TABLE IF NOT EXISTS Lead (
      id TEXT PRIMARY KEY,
      telegramId TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      username TEXT,
      phone TEXT,
      email TEXT,
      status TEXT DEFAULT 'new',
      notes TEXT,
      conversation TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabla Lead creada');

  // Crear tabla Message
  await client.execute(`
    CREATE TABLE IF NOT EXISTS Message (
      id TEXT PRIMARY KEY,
      leadId TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      messageType TEXT DEFAULT 'text',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES Lead(id)
    )
  `);
  console.log('✅ Tabla Message creada');

  // Crear tabla Feedback
  await client.execute(`
    CREATE TABLE IF NOT EXISTS Feedback (
      id TEXT PRIMARY KEY,
      triggerText TEXT NOT NULL,
      badResponse TEXT,
      correction TEXT NOT NULL,
      category TEXT DEFAULT 'response_style',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabla Feedback creada');

  // Crear tabla BotStats
  await client.execute(`
    CREATE TABLE IF NOT EXISTS BotStats (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE,
      messagesIn INTEGER DEFAULT 0,
      messagesOut INTEGER DEFAULT 0,
      leadsCaptured INTEGER DEFAULT 0,
      uniqueUsers INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabla BotStats creada');

  // Insertar configuración inicial
  const existing = await client.execute('SELECT * FROM BotConfig LIMIT 1');
  if (existing.rows.length === 0) {
    await client.execute(`
      INSERT INTO BotConfig (id, systemPrompt, isActive)
      VALUES ('default', 'Eres un asistente de atención al cliente amable y profesional. Tu objetivo es ayudar a los clientes y capturar sus datos (nombre y número de teléfono) cuando muestren interés en los servicios. Sé cordial, útil y nunca presiones demasiado. Si el cliente te da su nombre y teléfono, agradécele y confírmale que te pondrás en contacto pronto.', 0)
    `);
    console.log('✅ Configuración inicial insertada');
  }

  console.log('\n🎉 ¡Base de datos configurada correctamente!');
}

setupDatabase().catch(console.error);
