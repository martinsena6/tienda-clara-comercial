# Estructura visual del MVP – Gestión comercial

Primera etapa: solo navegación, pantallas y componentes reutilizables, con datos de ejemplo locales (sin base de datos, sin datos reales). Todo en español y adaptable a computadora y celular.

## Dos áreas separadas

```text
/                      Catálogo público (inicio)
/catalogo/categorias   Categorías
/catalogo/productos    Listado con buscador y filtro por categoría
/catalogo/producto/$slug  Detalle de producto
/catalogo/carrito      Carrito + botón "Pedir por WhatsApp"

/admin                 Inicio / dashboard
/admin/productos       Productos (tabla + formulario visual)
/admin/stock           Stock y movimientos (solo vista)
/admin/ventas          Ventas y pedidos pendientes
/admin/compras         Compras
/admin/gastos          Gastos
/admin/rentabilidad    Rentabilidad
/admin/configuracion   Configuración del negocio
```

## Diseño
- Estilo profesional y limpio: fondo claro cálido, verde oscuro como color principal, acento ámbar; tipografías Manrope (títulos) y Inter Tight no, se usará DM Sans (texto).
- Admin: menú lateral colapsable (en celular, menú desplegable), encabezado con título de sección.
- Catálogo: encabezado con buscador y carrito, grilla de tarjetas de producto con foto, nombre, precio y disponibilidad ("Disponible", "Pocas unidades", "Sin stock").
- Se muestran nombres legibles, nunca identificadores técnicos.

## Reglas de negocio reflejadas desde ya
- **Única fuente de productos y precios**: un solo archivo de datos de ejemplo del que leen admin y catálogo.
- **Sin costos en el catálogo**: el catálogo usa una versión "pública" del producto que excluye costo, margen y proveedor.
- **WhatsApp ≠ venta**: el pedido enviado se representa como "Pedido pendiente"; en Ventas aparece en una pestaña aparte hasta confirmarlo.
- **Stock**: no se descuenta al pedir; la pantalla de Stock muestra la estructura de movimientos (entrada, salida, ajuste) para el futuro.
- Preparado para permisos (roles admin/vendedor definidos como tipos) y validaciones (esquemas de formulario con zod).

## Componentes reutilizables
- Admin: `AdminSidebar`, `PageHeader`, `StatCard`, `DataTable` simple, `StatusBadge`, `EmptyState`, `FormField`.
- Catálogo: `CatalogHeader`, `ProductCard`, `CategoryChip`, `SearchBar`, `CartDrawer`/página de carrito, `WhatsAppButton`, `AvailabilityBadge`.
- Compartidos: `formatPrice` (pesos argentinos), etiquetas de estado en español.

## Detalles técnicos
- `src/lib/domain/types.ts`: `Product`, `PublicProduct`, `Category`, `StockMovement`, `Order` (estado `pendiente | confirmado | cancelado`), `Sale`, `Purchase`, `Expense`, `Role`.
- `src/lib/domain/mock-data.ts`: datos de ejemplo (única fuente).
- `src/lib/domain/catalog.ts`: `toPublicProduct()` que elimina campos internos; test que verifica que no exponga costo.
- `src/lib/cart.tsx`: carrito en contexto React (localStorage leído tras hidratar); `buildWhatsAppMessage()` con test.
- `src/lib/validation.ts`: esquemas zod de producto/gasto.
- Rutas: `src/routes/admin.tsx` (layout con `<Outlet />`) + `admin.index.tsx`, `admin.productos.tsx`, etc.; `src/routes/catalogo.*.tsx`; `index.tsx` como inicio del catálogo. Cada ruta con su propio `head()`.
- Fotos de producto generadas e incluidas en `src/assets/`.
- Sin conexión a base de datos en esta etapa; en la siguiente se habilitará Lovable Cloud (PostgreSQL) con permisos por rol, y el acceso a `/admin` quedará protegido con inicio de sesión. El código es exportable a GitHub desde Lovable.
