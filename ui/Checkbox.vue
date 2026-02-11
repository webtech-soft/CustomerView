<template>
  <input
    type="checkbox"
    :checked="checked"
    @change="$emit('update:checked', ($event.target as HTMLInputElement).checked)"
    :class="cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checkbox-custom',
      $attrs.class
    )"
    v-bind="$attrs"
  />
</template>

<style scoped>
.checkbox-custom:checked {
  background-color: #0f172a;
  border-color: #0f172a;
  accent-color: #0f172a;
}
</style>

<script setup lang="ts">
import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked?: boolean
}

defineProps<CheckboxProps>()
defineEmits<{
  'update:checked': [checked: boolean]
}>()
</script>

