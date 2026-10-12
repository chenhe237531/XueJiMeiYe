<script setup lang="ts">
defineProps<{ name: string, size?: number | string, color?: string }>()
</script>

<template>
  <view :class="[`i-tabler-${name}`]" class="xicon" :style="{ fontSize: typeof size === 'number' ? `${size}px` : (size || '22px'), color: color || 'inherit' }" />
</template>

<style scoped>
.xicon { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
