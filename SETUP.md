# CodePath - Guía de Instalación y Ejecución

Este proyecto tiene dos partes: **Backend** (Node.js/Express) y **Frontend** (Next.js).

## 📋 Requisitos Previos

- Node.js 18+ instalado
- npm, yarn o pnpm
- MongoDB (local o Atlas)
- Git (opcional)

## 🚀 Instalación Rápida

### Backend

1. Ir a la carpeta backend:
```bash
cd backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env`:
```bash
cp .env.example .env
```

4. Editar `.env` (cambiar `MONGODB_URI` si es necesario):
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/codepath
JWT_SECRET=cambiar_esto_en_produccion
JWT_EXPIRATION=7d
CORS_ORIGIN=http://localhost:3002
```

5. Ejecutar en desarrollo:
```bash
npm run dev
```

El backend estará en `http://localhost:8000`

### Frontend

1. Abrir otra terminal y ir a la carpeta el frontend:
```bash
cd fronted
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

4. Ejecutar en desarrollo:
```bash
npm run dev -- -p 3002
```

El frontend iniciará en `http://localhost:3002`

## 📝 Credenciales Demo

### Estudiante:
- Email: `carlos@universidad.edu`
- Password: `estudiante123`

### Otro Estudiante:
- Email: `maria@universidad.edu`
- Password: `estudiante123`

### Administrador:
- Email: `admin@universidad.edu`
- Password: `admin123`

## 🗄️ Base de datos

### Usar MongoDB local

**Windows:**
1. Descargar desde [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Instalar y ejecutar el servicio
3. Usar `mongodb://localhost:27017/codepath` en `.env`

**Mac:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

### O usar MongoDB Atlas (nube)

1. Crear cuenta en [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Crear cluster
3. Copiar connection string
4. Reemplazar en `.env`:
```
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/codepath
```

## 🎯 Flujo de Trabajo

1. **Backend primero:**
   - cd backend → npm install → npm run dev
   - Esperar "🚀 Servidor ejecutándose en puerto 5000"

2. **Frontend segundo:**
   - Nueva terminal: cd fronted → npm install → npm run dev
   - Ir a http://localhost:3002

3. **Usar la aplicación:**
   - Hacer login con credenciales demo arriba
   - Explorar dashboard
   - Acceder a admin dashboard si usas credenciales admin

## 📚 Estructura

```
tesis_desarrollo/
├── backend/
│   ├── src/
│   ├── package.json
│   ├── .env.example
│   └── README.md
└── fronted/
    ├── app/
    ├── components/
    ├── package.json
    ├── .env.local (crear)
    └── README.md
```

## 🔍 Verificar que funciona

### Health check del backend:
```bash
    curl http://localhost:8000/health

Debe retornar: `{"status":"OK"}`

### Verificar base de datos:
```bash
mongosh
> use codepath
> db.users.find()
```

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Cannot find module" | Ejecutar `npm install` |
| "Port 5000 already in use" | Cambiar PORT en `.env` |
| "MongoDB connection error" | Verificar que MongoDB esté corriendo |
| "CORS error" | Verificar `CORS_ORIGIN` en `.env` backend |
| "API 404" | Verificar `NEXT_PUBLIC_API_URL` en frontend |

## 📦 Scripts Disponibles

### Backend

```bash
npm run dev      # Desarrollo con hot reload
npm run build    # Compilar TypeScript
npm start        # Ejecutar producción
npm run lint     # Linting
```

### Frontend

```bash
npm run dev      # Desarrollo
npm run build    # Compilar para producción
npm start        # Ejecutar producción
npm run lint     # Linting
```

## 🔐 Seguridad

Para producción:
1. Cambiar `JWT_SECRET` a algo seguro y aleatorio
2. Cambiar `CORS_ORIGIN` a URL real
3. Usar MongoDB Atlas en lugar de local
4. Https en frontend
5. Environment variables seguros

## 📖 Documentación Adicional

- Backend: Ver [backend/README.md](backend/README.md)
- Frontend: Ver [fronted/README.md](fronted/README.md)
- API Endpoints: Ver backend/README.md

## ✨ Próximas Mejoras

- [ ] Agregar reproductor de video
- [ ] Chatbot integrado
- [ ] Sistema de logros
- [ ] Notificaciones en tiempo real
- [ ] Mobile app
- [ ] Analytics

---

**Nota:** Si encuentras problemas, revisa que:
1. Node.js versión 18+ esté instalado
2. Ambos servidores están corriendo (backend + frontend)
3. MongoDB esté accesible
4. Los puertos 5000 y 3000 estén libres
