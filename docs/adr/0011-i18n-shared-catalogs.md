# ADR-0011: i18n con catálogos ICU compartidos (next-intl + use-intl) y errores por código

- **Estado:** Aceptado
- **Fecha:** 2026-11-14

## Contexto
Una gran parte de los owner-operators en Canadá son migrantes (punjabi, español, tagalo, hindi, chino…), y el francés es oficial (Quebec). La app móvil tenía diccionarios propios (en/es) en `lib/i18n.ts` y la web tenía los textos en español escritos a mano. La API devolvía mensajes de error en inglés.

## Decisión
- **`packages/i18n`** es la fuente única de los idiomas soportados (`LOCALES`, `LOCALE_INFO` con nombre nativo, dirección, `intlLocale` y estado de revisión), de la negociación de idioma y de los **catálogos ICU** (`messages/<locale>.json`) que comparten la web y la app.
- **Web:** **next-intl** con prefijo de idioma en la URL (`/[locale]/…`, `localePrefix: 'always'`), páginas prerenderizadas por idioma, negociación en `proxy.ts` y tipos estrictos (`AppConfig.Messages`).
- **Mobile:** **use-intl** (el mismo motor que next-intl), con `IntlProvider` alimentado por el slice `settings`, idioma inicial del dispositivo y `createTranslator` fuera de React.
- **API:** no traduce. Devuelve `ApiErrorDto.code` (de `ERROR_CODES` en `@dispatcher/shared`) mediante un `HttpExceptionFilter` global, y guarda `users.locale` (`PATCH /v1/me`) para los mensajes que ella misma enviará (push y email).
- **Idiomas iniciales:** en, fr, es, pa. Francés y punjabi quedan en `needs_review` hasta una revisión nativa.
- **Calidad:** tests que exigen claves idénticas, ICU válido y las mismas variables en todos los idiomas, y que cada `ERROR_CODE` tenga traducción.

## Alternativas consideradas
- **i18next + react-i18next en ambas apps:** es maduro, pero con App Router y Server Components next-intl se integra mejor, y el ICU de i18next requiere plugins.
- **Idioma por cookie sin prefijo en la URL:** con Cache Components obligaría a leer cookies en cada render (todo dinámico). Con el prefijo, cada idioma se prerenderiza de forma estática.
- **Que la API traduzca los errores:** acopla la API a la UI y obliga a enviar `Accept-Language` en cada llamada. Con códigos, cada cliente traduce con sus propios catálogos.
- **Seguir con diccionarios separados por app:** duplica las traducciones y se desincronizan.

## Consecuencias
- Agregar un idioma son dos archivos (`locales.ts` y `messages/<code>.json`), sin tocar las apps.
- Todo texto nuevo exige una clave en **todos** los catálogos (lo hace cumplir el test).
- Las URLs de la web cambiaron a `/<locale>/…`; las rutas sin prefijo redirigen automáticamente.
- RTL: la web está lista (`dir`, propiedades lógicas). Mobile necesitará `I18nManager.forceRTL` y recargar la app cuando se agregue el primer idioma RTL.
- Riesgo: las traducciones sin revisión nativa pueden sonar poco naturales. Es obligatorio revisarlas antes del lanzamiento.
