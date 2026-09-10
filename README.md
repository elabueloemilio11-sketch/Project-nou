# Estudio AudioVisual V2

Tu estudio creativo con inteligencia artificial. Esta plantilla se publica en Render y mantiene las claves API en el servidor, nunca en el navegador.

## Qué incluye

- Generador de vídeo modular: texto a vídeo e imagen a vídeo.
- Modelos preparados mediante fal.ai: Seedance, Kling, Veo, MiniMax/Hailuo, LTX, Wan, PixVerse y Pika.
- Runway visible como integración independiente pendiente de conectar; no se presenta como activo sin configuración.
- Subida de una o varias imágenes, previsualización y eliminación.
- Formatos 9:16, 16:9 y 1:1; duración, resolución, calidad y seed cuando el modelo los admite.
- Estado real del trabajo: EN COLA, PROCESANDO, FINALIZANDO, COMPLETADO o ERROR.
- Historial local con configuración, fecha, modelo, estado, resultado y repetición.
- Texto a voz y clonación de voz mediante endpoints de MiniMax en fal.ai.
- Configuración que muestra solamente CONECTADO o NO CONFIGURADO. Las claves nunca se devuelven al frontend.

## Publicar en Render

1. Descomprime el ZIP.
2. Crea un repositorio nuevo en GitHub.
3. Sube **el contenido** de esta carpeta. `package.json` debe verse en la portada del repositorio.
4. En Render crea un **New Web Service** y conecta el repositorio.
5. Usa:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
6. En **Environment** añade:
   - `FAL_KEY`: tu clave privada de fal.ai.
   - `APP_SIGNING_SECRET`: una cadena aleatoria de al menos 32 caracteres. El Blueprint puede generarla.
   - `MODEL_PRICE_USD_PER_SECOND`: opcional; JSON con precios actuales confirmados por ti.
7. Pulsa **Deploy** y espera hasta ver **LIVE**.

## Seguridad

- Nunca subas `.env` a GitHub.
- `.env.example` contiene únicamente nombres de variables vacías.
- La aplicación llama a fal.ai desde el servidor.
- Los identificadores de trabajo que recibe el navegador están firmados.
- No se almacena ni se devuelve `FAL_KEY`.
- La aplicación limita tamaño de peticiones y frecuencia de nuevas generaciones.

## Precios

La plantilla no inventa precios. Si `MODEL_PRICE_USD_PER_SECOND` no contiene una tarifa para el modelo elegido, la interfaz mostrará “Consultar proveedor”. Si introduces una tarifa verificada, la estimación se calcula con duración × tarifa y se identifica como orientativa.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm start
```

Abre `http://localhost:3000`. Sin `FAL_KEY`, la interfaz funciona para preparar proyectos, pero la generación real permanece bloqueada como **REQUIERE CONFIGURACIÓN**.

## Actualizar modelos

El catálogo está centralizado en `src/models.js`. Cada modelo define sus endpoints reales, capacidades e inputs admitidos. Antes de cambiar un endpoint o una capacidad, compruébalo en la documentación actual del proveedor.
