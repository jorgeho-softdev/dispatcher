# Design system: colores y fuentes

**Un solo archivo controla la marca de la web y de la app:**

```
packages/design-tokens/src/tokens.ts
```

Ahí están la paleta, los temas (dark / light), la tipografía, los radios y los espaciados. Ningún componente tiene colores hex escritos a mano.

## Cómo cambiar los colores (p. ej. a una paleta más canadiense)

1. Edita `palette` en `tokens.ts` o los valores que usa cada tema en `themes.dark` / `themes.light`.
   Ejemplo de primario rojo Canadá:
   ```ts
   red500: '#D52B1E',   // agregar a palette
   primary: { DEFAULT: p.red500, dark: '#A82218', light: '#3A1714' },
   ```
2. Recompila los tokens:
   ```bash
   npm run build --workspace=@dispatcher/design-tokens
   ```
3. Reinicia las apps: `npm run dev` para la web y `npx expo start -c` para la app (con `-c` se limpia la caché de NativeWind).
4. Si cambian el splash o el color de las notificaciones de la app, se necesita un nuevo dev build (`npm run ios` / `npm run android`).

**Regla:** mantén **las mismas claves** en todos los temas; solo cambian los valores. Los componentes usan los roles (`primary`, `surface`, `ink`…), no los colores concretos. Así un rebrand no toca ningún componente.

## Roles de color

| Rol | Clase | Uso |
|---|---|---|
| `background` | `bg-background` | Fondo de pantalla |
| `surface` | `bg-surface` | Tarjetas, sidebar |
| `surface-raised` | `bg-surface-raised` | Hover, chips |
| `border` | `border-border` | Bordes y divisores |
| `ink` | `text-ink` | Texto principal |
| `muted` / `muted-light` | `text-muted` | Texto secundario / terciario |
| `primary` / `primary-dark` / `primary-light` | `bg-primary` | Acción principal / hover / fondo suave |
| `on-primary` | `text-on-primary` | Texto sobre `primary` |
| `success`, `danger`, `warning`, `info` | `text-danger`… | Estados |

Si un valor no puede ser una clase (el `color=` de un ícono o las opciones del navegador en mobile), usa `useColors()` de `apps/mobile/lib/theme.ts`.

## Cómo cambiar la fuente

El **nombre** de la familia está en `typography.family` de `tokens.ts`. Los **archivos** de la fuente se cargan en un solo módulo por app, porque cada plataforma usa un paquete distinto:

| App | Archivo | Qué cambiar |
|---|---|---|
| Web | `apps/web/src/app/fonts.ts` | Reemplaza `Inter` por otra fuente de `next/font/google` y conserva `variable: '--font-brand'` |
| Mobile | `apps/mobile/lib/fonts.ts` | Instala `@expo-google-fonts/<fuente>` (`npx expo install`) y cambia los 4 imports |

En mobile, las fuentes se registran con alias genéricos (`Brand-Regular`, `Brand-Bold`…, en `typography.mobileAliases`), así que las clases `font-sans`, `font-sans-bold`, etc. siguen funcionando sin tocar componentes.

## Nombre y logo

- **Nombre del producto:** `BRAND_NAME` en `packages/shared/src/constants.ts` (hoy **HaulGenius**). El código lo usa en el título de la web, el nombre nativo de la app (`app.config.ts`), la tarjeta de la IA en el inicio, el PDF de Rate Confirmation y Swagger.
- **Textos traducidos:** los catálogos de `packages/i18n/messages/` y los textos de permisos de iOS (`apps/mobile/locales/*.json`, `app.json`) escriben el nombre dentro de la frase, porque cada idioma lo coloca distinto. En un rebrand hay que buscar y reemplazar también ahí.
- **Logo, originales:** en `packages/design-tokens/brand/`, ambos con fondo transparente:
  - `mark.png`: el símbolo (la H con flecha).
  - `logotype.png`: símbolo + palabra "HaulGenius" (colores originales, para fondo claro).
- **Logo, imágenes derivadas:** las genera `npm run brand:assets` (`scripts/brand-assets.mjs`) y se versionan. Si cambias un original, vuelve a correr el script.

  | Archivo generado | Uso |
  |---|---|
  | `apps/mobile/assets/splash-icon.png` | Splash de la app (símbolo recortado y centrado, 1024 px) |
  | `apps/mobile/assets/logo-on-dark.png` / `logo-on-light.png` | Login de la app; `BrandLogo` elige según el tema |
  | `apps/web/public/brand/logo-on-dark.png` | Login e invitación de la web (`BrandLogo`) |
  | `apps/web/public/brand/mark.png` | Barra lateral de la web (`BrandMark`: símbolo + nombre) |
  | `apps/web/src/app/icon.png` | Ícono de la pestaña del navegador |

- **Versión para fondo oscuro:** el script pinta las letras casi negras y sin color ("Haul") con el token `ink` del tema, para que se lean sobre `background`. "Genius" y el símbolo conservan su naranja.
- **No cambian con el nombre:** el bundle ID (`com.jorgehurtado.aidispatcher`), el slug de Expo ni los paquetes internos `@dispatcher/*`. El bundle ID se puede cambiar sin costo solo antes de crear la app en App Store Connect.
- **Ícono de la app:** todavía es el provisional (`assets/icon.png`). iOS exige un ícono **sin transparencia** de 1024 px, así que hay que componer el logo sobre un fondo sólido.

## Cómo se consume (para desarrolladores)

```
tokens.ts ──tsup──► dist/index.(js|mjs)  ─┬─► mobile: tailwind.config.js (clases NativeWind)
                                          ├─► mobile: lib/themes.ts (valores en runtime, vars())
                                          ├─► mobile: app.config.ts (splash, ícono Android, notificaciones)
          └─scripts/build-css.mjs─► generated/web-theme.css ─► web: globals.css (@theme de Tailwind 4)
```

- `generated/web-theme.css` se **genera**; nunca se edita a mano. Vive fuera de `dist/` a propósito: `tsup --clean` borra `dist/` en cada build, y un `next dev` en marcha no debe ver desaparecer la hoja de estilos (se escribe de forma atómica).
- La web hoy usa solo el tema `defaultTheme` (dark). La app permite elegir dark o light en Ajustes.
- La decisión está documentada en [ADR-0010](./adr/0010-design-tokens-single-source.md).
