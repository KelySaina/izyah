<script setup lang="ts">
/**
 * Base shimmer block. Size/shape it from the call site via `class`
 * (auto-merged onto the root), e.g. <Skeleton class="h-4 w-3/4" />.
 * Neutral fill (`bg-fg/10`) reads on both light and dark surfaces.
 */
</script>

<template>
  <div class="animate-pulse rounded-lg bg-fg/10" aria-hidden="true" />
</template>
