import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function migrate() {
  console.log('Running migrations for reservations...');
  
  try {
    // Crear tabla de reservas
    await client.execute(`
      CREATE TABLE IF NOT EXISTS Reservation (
        id TEXT PRIMARY KEY,
        leadId TEXT NOT NULL,
        leadName TEXT NOT NULL,
        leadEmail TEXT,
        leadPhone TEXT,
        dateTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        title TEXT,
        description TEXT,
        googleEventId TEXT,
        googleEventLink TEXT,
        status TEXT DEFAULT 'confirmed',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Reservation table created');
    
    // Agregar columnas de Google Calendar a BotConfig
    const columns = [
      { name: 'googleClientId', type: 'TEXT' },
      { name: 'googleClientSecret', type: 'TEXT' },
      { name: 'googleRefreshToken', type: 'TEXT' },
      { name: 'googleCalendarId', type: 'TEXT' },
      { name: 'emailProvider', type: 'TEXT DEFAULT "resend"' },
      { name: 'resendApiKey', type: 'TEXT' },
      { name: 'smtpHost', type: 'TEXT' },
      { name: 'smtpPort', type: 'INTEGER' },
      { name: 'smtpUser', type: 'TEXT' },
      { name: 'smtpPassword', type: 'TEXT' },
      { name: 'emailFrom', type: 'TEXT' },
    ];
    
    for (const col of columns) {
      try {
        await client.execute(`ALTER TABLE BotConfig ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✓ Added column ${col.name}`);
      } catch (e: unknown) {
        const error = e as { message?: string };
        if (error.message?.includes('duplicate column')) {
          console.log(`  Column ${col.name} already exists`);
        } else {
          throw e;
        }
      }
    }
    
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
