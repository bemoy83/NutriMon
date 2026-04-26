# Battle feature ownership

- **Data & hooks** — `src/features/battle/`: arena list/detail, invalidation, queries keyed via the same `ARENA_*` / `BATTLE_HUB_*` constants as the creature feature when invalidating the hub.
- **UI** — `src/components/battle/`: presentational and battle-specific components (opponents, arena shell, etc.).
- **Shared creature/battle state** — creature stats and the battle hub are invalidated together from `useInvalidateDailyLog` when logging/finalize changes tomorrow’s state (`BATTLE_HUB_QUERY_KEY`).

When adding battle flows, prefer new hooks under `src/features/battle/` and keep Supabase types/RPC mappers in `src/lib/domainMappers.ts` (or a dedicated mapper next to the RPC) so pages only compose.
