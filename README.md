# 🤖 Bot Autónomo Telegram

Plataforma para conectar un bot de Telegram con IA que gestiona clientes y captura leads automáticamente, sin escribir una sola línea de código.

![Dashboard](public/bot-logo.png)

## ✨ Características

- 🤖 **Bot de Telegram con IA**: Responde automáticamente a los clientes de forma inteligente
- 📊 **Dashboard Web**: Interfaz para gestionar tu bot sin código
- 👥 **Captura de Leads**: Detecta automáticamente nombres y teléfonos
- 🧠 **Sistema de Aprendizaje**: El bot aprende de tus correcciones
- 📈 **Estadísticas**: Métricas en tiempo real de tu bot

## 🚀 Despliegue en Render (Gratis)

### Paso 1: Crear un Bot en Telegram

1. Abre Telegram y busca **@BotFather**
2. Envía el comando `/newbot`
3. Sigue las instrucciones para nombrar tu bot
4. **Copia el token** que te da (formato: `123456789:ABCdefGHI...`)

### Paso 2: Subir a GitHub

```bash
# En tu terminal local
git add .
git commit -m "Bot de Telegram con IA listo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/telegram-bot-ai.git
git push -u origin main
```

### Paso 3: Desplegar en Render

1. Ve a [render.com](https://render.com) y crea una cuenta gratis
2. Haz clic en **"New"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `telegram-bot-ai`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma db push && npm start`
5. Agrega variable de entorno:
   - `DATABASE_URL` = `file:./data/bot.db`
6. Haz clic en **"Create Web Service"**

### Paso 4: Configurar el Webhook

1. Espera a que Render termine de desplegar
2. Copia la URL de tu servicio (ej: `https://telegram-bot-ai.onrender.com`)
3. Abre tu dashboard: `https://tu-app.onrender.com`
4. Ve a **"Configuración"**
5. Pega tu token de Telegram y la URL pública
6. Haz clic en **"Conectar Bot"**

¡Listo! Tu bot ya está funcionando con IA.

## 🛠️ Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/telegram-bot-ai.git
cd telegram-bot-ai

# Instalar dependencias
npm install

# Configurar base de datos
npx prisma db push

# Iniciar servidor
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
├── prisma/
│   └── schema.prisma      # Modelos de base de datos
├── src/
│   ├── app/
│   │   ├── api/           # APIs REST
│   │   │   ├── bot/       # Configuración y estado
│   │   │   ├── leads/     # Gestión de leads
│   │   │   ├── feedback/  # Sistema de aprendizaje
│   │   │   └── telegram/  # Webhook de Telegram
│   │   └── page.tsx       # Dashboard
│   └── components/ui/     # Componentes UI
└── public/                # Archivos estáticos
```

## 🧠 Sistema de Aprendizaje

El bot puede aprender de tus correcciones:

### Desde el Dashboard
1. Ve a la pestaña **"Aprendizaje"**
2. Agrega cuándo y cómo debe responder

### Desde Telegram
Escribe directamente al bot:
```
Bot, no digas eso. En lugar de eso, responde con...
```

## 📊 Modelos de Datos

- **BotConfig**: Configuración del bot (token, prompt, estado)
- **Lead**: Clientes capturados (nombre, teléfono, estado)
- **Message**: Historial de conversaciones
- **Feedback**: Aprendizajes del bot
- **BotStats**: Estadísticas diarias

## 🔒 Seguridad

- El token del bot se guarda en la base de datos, no en variables de entorno
- El token nunca se muestra completo en el dashboard
- Los webhooks solo aceptan peticiones de Telegram

## 💡 Tips

- Personaliza el **System Prompt** para adaptar el bot a tu negocio
- Revisa los leads regularmente y cambia su estado
- Usa el modo aprendizaje para mejorar las respuestas

## 📄 Licencia

MIT - Libre para uso personal y comercial.

---

**Built with ❤️ by GLM AI**
