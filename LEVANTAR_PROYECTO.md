# Levantar el proyecto (datos reales de la base, sin demo ni json-server)

Son 3 piezas y se levantan en este orden: **base de datos → backend → frontend**.
Cada servidor queda corriendo en su propia terminal (no cerrarla).

## 0. Docker Desktop

Abrir **Docker Desktop** y esperar a que diga "Engine running".
(Si `docker ps` da error de `dockerDesktopLinuxEngine`, es que Docker no está abierto.)

## 1. Base de datos (PostgreSQL + PostGIS en Docker)

```powershell
cd "C:\Users\tiin-\OneDrive\Escritorio\Sistemas de la DRH\Nuevo-Sistema-Back-y-Front\backend"
docker compose up -d
```

- Contenedor: `drh-postgres`, puerto **5433** (el 5432 lo usa un PostgreSQL local).
- La base que usa el backend la define `backend/.env` → `DB_NAME=pruebas_de_cargas`.
- Los datos quedan en el volumen de Docker: **no** usar `docker compose down -v` (borra todo).

## 2. Backend (NestJS, puerto 3000) — terminal 1

```powershell
cd "C:\Users\tiin-\OneDrive\Escritorio\Sistemas de la DRH\Nuevo-Sistema-Back-y-Front\backend"
npm run start:dev
```

Está listo cuando aparece `Found 0 errors. Watching for file changes.`
Si responde 401 en http://localhost:3000/api/dominio está bien: pide login.

## 3. Frontend (React + Vite, puerto 5173) — terminal 2

```powershell
cd "C:\Users\tiin-\OneDrive\Escritorio\Sistemas de la DRH\Nuevo-Sistema-Back-y-Front\Proyecto En React - Full"
npm run dev
```

Abrir **http://localhost:5173** e ingresar con un usuario de la base
(las claves de desarrollo están en `backend/.env`: `ADMIN_CLAVE_INICIAL` y `CLAVE_USUARIOS_PRUEBA`).

> Usar `npm run dev`, **no** `npm run demo` ni `npm run dev:mock`: esos levantan json-server
> y el backend emulado con datos inventados.

## Apagar

- `Ctrl + C` en la terminal del backend y en la del frontend.
- Base (opcional): `docker compose stop` dentro de `backend` (conserva los datos).

## Problemas comunes

- **Puerto ocupado (3000 / 5173)**: quedó un proceso viejo vivo. Ver cuál es y cerrarlo:
  ```powershell
  netstat -ano | findstr ":5173"
  taskkill /PID <numero> /F
  ```
- **La primera vez / después de un `git pull` con dependencias nuevas**: correr `npm install`
  en `backend` y en `Proyecto En React - Full` antes de arrancar.
- **Ver qué hay en la base**:
  ```powershell
  docker exec -it drh-postgres psql -U drh -d pruebas_de_cargas
  ```
