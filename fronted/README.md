# CodePath - Frontend

Frontend de CodePath, una plataforma educativa de programación con IA.

## Requisitos

- Node.js 18+
- npm, yarn o pnpm

## Instalación

### 1. Instalar dependencias

```bash
cd fronted
npm install
# o
pnpm install
# o
yarn install
```

### 2. Configurar variables de entorno

Crear archivo `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Ejecución

### Desarrollo

```bash
npm run dev
```

El frontend iniciará en `http://localhost:3002`

**Con puerto específico:**
```bash
npm run dev -- -p 3002
```

### Producción

```bash
npm run build
npm start
```

## Estructura del Proyecto

```
fronted/
├── app/
│   ├── layout.tsx           # Layout principal
│   ├── page.tsx             # Página home/landing
│   ├── login/
│   │   └── page.tsx         # Página de login
│   ├── register/
│   │   └── page.tsx         # Página de registro
│   └── dashboard/
│       ├── student/
│       │   └── page.tsx     # Dashboard de estudiante
│       └── admin/
│           └── page.tsx     # Dashboard de admin
├── components/
│   ├── theme-provider.tsx   # Proveedor de tema
│   ├── landing/             # Componentes de landing
│   ├── ui/                  # Componentes UI reutilizables
│   └── ...
├── contexts/
│   └── auth-context.tsx     # Contexto de autenticación
├── hooks/
│   ├── use-mobile.ts        # Hook para mobile
│   └── use-toast.ts         # Hook para notificaciones
├── lib/
│   └── utils.ts             # Utilidades
└── styles/
    └── globals.css          # Estilos globales
```

## Características

- 🎓 Gestión de cursos y tópicos
- 👥 Sistema de roles (estudiante/admin)
- 📊 Dashboard con progreso y estadísticas
- 🎮 Sistema de gamificación (XP, niveles, logros)
- 📹 Integración con videos
- 🤖 Soporte para chatbot
- 🎨 Tema oscuro/claro
- 📱 Responsive design

## Credenciales Demo

### Estudiante
- Email: carlos@universidad.edu
- Password: estudiante123

### Admin
- Email: admin@universidad.edu
- Password: admin123

## Integración con Backend

Este frontend se conecta con el backend en `http://localhost:8000/api`.

Asegurar que:
1. El backend está corriendo en el puerto 5000
2. `NEXT_PUBLIC_API_URL` está correctamente configurado
3. CORS está habilitado en el backend

## Desarrollo

### Usar componentes UI

Los componentes están en `components/ui/` y están listos para usar.

### Agregar nuevas páginas

Crear nuevas rutas en `app/` siguiendo la estructura de Next.js 13+ App Router.

### Estilos

Proyecto usa Tailwind CSS. Ver `globals.css` para estilos globales.

## Build y Deploy

### Compilar para producción

```bash
npm run build
```

### Servir en producción

```bash
npm start
```

### Deploy en Vercel (recomendado para Next.js)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Troubleshooting

### Backend no responde
- Verificar que backend está corriendo en puerto 5000
- Verificar `NEXT_PUBLIC_API_URL` en `.env.local`
- Ver consola del navegador (F12) para error específico

### 404 en rutas
- Asegurar que las páginas existen en la estructura `app/`
- Next.js requiere `page.tsx` para cada ruta

### Build error
- Limpiar `.next/`: `rm -rf .next`
- Reinstalar dependencias: `npm install`
- Ejecutar build nuevamente: `npm run build`

## Próximos Pasos

1. Implementar reproductor de video
2. Implementar chatbot
3. Agregar gamificación visual
4. Mejorar dashboard
5. Agregar más contenido educativo
