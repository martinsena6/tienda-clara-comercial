# Tienda Clara Comercial

Quiero desarrollar una aplicación web de gestión comercial para mi propio negocio, con código exportable y arquitectura preparada para crecer.

Tecnologías objetivo:

React y TypeScript para la interfaz.

Supabase y PostgreSQL para la base de datos.

GitHub para el control de versiones.

Diseño responsive para computadora y celular.

Primera tarea: construir únicamente la estructura visual del MVP, sin modificar ni importar datos reales todavía.

La aplicación debe tener dos áreas separadas:

PANEL ADMINISTRATIVO PRIVADO

Inicio y dashboard.

Productos.

Stock.

Ventas.

Compras.

Gastos.

Rentabilidad.

Configuración del negocio.

CATÁLOGO PÚBLICO

Inicio.

Categorías.

Productos con foto, nombre, precio y disponibilidad.

Buscador.

Carrito.

Botón de pedido por WhatsApp.

Diseño: profesional, limpio, moderno, rápido y fácil de utilizar. Toda la interfaz debe estar en español. Los usuarios deben ver nombres de productos y datos comerciales legibles, nunca identificadores técnicos como contenido principal.

Reglas de negocio:

Los productos y sus precios deben tener una única fuente de datos.

Los costos y los datos internos no deben exponerse en el catálogo público.

Un pedido enviado por WhatsApp no debe marcarse automáticamente como venta confirmada.

No descontar stock hasta confirmar el pedido.

Preparar la estructura para permisos seguros, validaciones y registro de movimientos.

En esta primera etapa, concentrarse en la navegación, las pantallas y los componentes reutilizables. No agregar módulos complejos, pagos online, facturación electrónica ni automatizaciones todavía.

Antes de implementar funcionalidades adicionales, mostrar la estructura propuesta y explicar qué archivos y componentes se crearán.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tienda-clara-comercial.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/22a84959-746d-5665-bd67-a32e408a6a3b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
