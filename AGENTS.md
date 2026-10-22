<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- Domain types live in `src/lib/domain/types.ts`; all product/price reads go through one data source (`mock-data.ts` now, database later) — single source of truth.
- The public catalog only consumes `PublicProduct` via `toPublicProduct()` in `src/lib/domain/catalog.ts` — keeps cost, supplier and stock counts out of public pages.
- Cart stores only slugs and quantities; prices are always re-read from the source — avoids stale/forged prices.
- Admin area is the `/admin` layout route (`src/routes/admin.tsx`) with sidebar; catalog pages wrap content in `CatalogLayout` — keeps the two areas separated.
- Orders have status `pendiente | confirmado | cancelado`; only confirmation may create a sale and stock movement — WhatsApp orders are never sales automatically.
- Stock only changes through `StockMovement` records — auditable history.
