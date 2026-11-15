# ADR-0010: Tokens de diseño como fuente única para web y mobile

- **Estado:** Aceptado
- **Fecha:** 2026-11-14

## Contexto
La marca (colores y fuentes) puede cambiar, por ejemplo hacia una identidad más canadiense. Hasta ahora los colores estaban repetidos en `apps/web/src/app/globals.css`, `apps/mobile/lib/themes/{dark,light}.js` y `app.json`, y la fuente Inter estaba escrita a mano en los layouts y en `tailwind.config.js`. Un rebrand exigía tocar más de seis archivos y era fácil olvidar alguno.

## Decisión
- **`packages/design-tokens/src/tokens.ts` es la única fuente de verdad** de la paleta, los temas (mismas claves en cada uno), la tipografía, los radios y los espaciados.
- **Web:** `scripts/build-css.mjs` genera `dist/web-theme.css` (`@theme` de Tailwind 4), que `globals.css` importa como `@dispatcher/design-tokens/web-theme.css`.
- **Mobile:**
  - `tailwind.config.js` y `lib/themes.ts` leen el paquete compilado (CJS).
  - `app.config.ts` inyecta los colores nativos: splash, ícono adaptativo y notificaciones.
- **Fuentes:** cada app las carga en un único módulo (`apps/web/src/app/fonts.ts`, `apps/mobile/lib/fonts.ts`). En mobile se registran con alias genéricos (`Brand-*`), así cambiar de fuente no toca componentes.

## Alternativas consideradas
- **Un JSON de tokens con Style Dictionary:** es potente, pero es una herramienta más para solo dos plataformas; un archivo TS con tipos alcanza y valida que los temas tengan la misma forma.
- **Variables CSS en runtime para la web:** Tailwind 4 necesita los valores en `@theme` al compilar, para generar las utilidades.
- **Centralizar también los archivos de fuente:** no es posible, porque `next/font` y `expo-font` usan paquetes distintos que se importan de forma estática.

## Consecuencias
- Un rebrand de colores se hace en un archivo y un comando de build.
- `dist/web-theme.css` es generado: los cambios se hacen siempre en `tokens.ts`.
- Los cambios de color nativos (splash/notificaciones) requieren un nuevo dev build de la app.
- La clase web `primary-soft` pasó a llamarse `primary-light`, para usar el mismo nombre de rol que mobile.
