# CodePath - Backend API

Backend para CodePath, una plataforma educativa de programación con IA.

## Requisitos

- Node.js 18+
- npm, yarn o pnpm
- MongoDB local o conexión a MongoDB Atlas

## Instalación

### 1. Instalar dependencias

```bash
cd backend
npm install
# o
pnpm install
# o
yarn install
```

### 2. Configurar variables de entorno

Crear un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Editar `.env` con tus valores (especialmente `MONGODB_URI` y `JWT_SECRET`):

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/codepath
JWT_SECRET=tu_clave_secreta_super_segura_aqui
JWT_EXPIRATION=7d
CORS_ORIGIN=http://localhost:3002
```

### 3. Asegurar que MongoDB está corriendo

Si usas MongoDB local:
- Windows: Descargar desde [mongodb.com](https://www.mongodb.com/try/download/community)
- Mac: `brew install mongodb-community`
- Linux: Ver documentación oficial de MongoDB

O usar MongoDB Atlas (nube):
- Crear cuenta en [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Reemplazar `MONGODB_URI` con tu connection string

## Ejecución

### Desarrollo

```bash
npm run dev
```

El servidor iniciará en `http://localhost:8000`

### Producción

```bash
npm run build
npm start
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts       # Configuración de MongoDB
│   ├── controllers/
│   │   ├── authController.ts # Lógica de autenticación
│   │   ├── studentController.ts # Gestión de estudiantes
│   │   └── topicController.ts # Gestión de tópicos
│   ├── middleware/
│   │   └── auth.ts           # Middlewares JWT
│   ├── models/
│   │   ├── User.ts           # Schema de Usuario
│   │   ├── StudentProgress.ts # Schema de Progreso
│   │   └── Topic.ts          # Schema de Tópicos
│   ├── routes/
│   │   ├── auth.ts           # Rutas de autenticación
│   │   ├── students.ts       # Rutas de estudiantes
│   │   └── topics.ts         # Rutas de tópicos
│   └── server.ts             # Servidor principal
├── dist/                      # Código compilado
├── package.json
├── tsconfig.json
└── .env.example
```

## Endpoints Principales

### Autenticación

- `POST /api/auth/register` - Registrar nuevo estudiante
- `POST /api/auth/login` - Login de estudiante
- `POST /api/auth/login/admin` - Login de admin
- `GET /api/auth/me` - Obtener usuario actual

### Estudiantes

- `GET /api/students` - Listar todos los estudiantes (admin)
- `GET /api/students/:studentId/progress` - Obtener progreso
- `PUT /api/students/:studentId/progress` - Actualizar progreso
- `POST /api/students/:studentId/topics/:topicId/complete` - Completar desafío
- `GET /api/students/:studentId/stats` - Obtener estadísticas

### Tópicos

- `GET /api/topics` - Listar todos los tópicos
- `GET /api/topics/:topicId` - Obtener un tópico
- `POST /api/topics` - Crear tópico (admin)
- `PUT /api/topics/:topicId` - Actualizar tópico (admin)
- `DELETE /api/topics/:topicId` - Eliminar tópico (admin)

## Credenciales Demo

### Estudiante
- Email: carlos@universidad.edu
- Password: estudiante123

### Admin
- Email: admin@universidad.edu
- Password: admin123

## Integración con Frontend

El frontend debe apuntar a este backend.  
Variables de entorno del frontend (`.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Desarrollo

### Ejecutar TypeScript en desarrollo

```bash
npm run dev
```

### Compilar a JavaScript

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Notas Importantes

1. **JWT_SECRET**: Cambiar en producción a una cadena segura y aleatoria
2. **CORS_ORIGIN**: Actualizar con la URL del frontend en producción
3. **MongoDB**: Asegurar que la base de datos esté correctamente configurada y accesible
4. **Validaciones**: Los endpoints incluyen validaciones básicas - agregar más según necesidad

## Troubleshooting

### MongoDB no se conecta
- Verificar que MongoDB esté corriendo: `mongosh` o verificar servicios en Windows
- Verificar la cadena de conexión en `.env`
- Si usas MongoDB Atlas, asegurar que la IP esté whitelisted

### Puerto 5000 ya en uso
```bash
# Cambiar PORT en .env o
lsof -i :5000  # Mac/Linux para ver qué ocupa el puerto
```

### CORS errors
- Verificar que `CORS_ORIGIN` corresponde a la URL del frontend
- Asegurar que cors está correctamente configurado en server.ts

## Próximos Pasos

1. Agregar validaciones más robustas
2. Implementar rate limiting
3. Agregar logs estructurados
4. Agregar tests unitarios
5. Implementar refresh tokens
6. Agregar endpoints para videos y chatbot
