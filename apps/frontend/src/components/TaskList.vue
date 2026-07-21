<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ListChecks, Plus, Check, RotateCcw } from 'lucide-vue-next';
import { api, ApiError } from '@/services/api';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import Avatar from '@/components/Avatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import type { TaskDTO } from '@/types';

const props = defineProps<{ eventId: string }>();

const identity = useIdentityStore();
const ui = useUiStore();

const tasks = ref<TaskDTO[]>([]);
const loading = ref(true);
const newTitle = ref('');
const adding = ref(false);

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

function replaceTask(updated: TaskDTO): void {
  const i = tasks.value.findIndex((t) => t.id === updated.id);
  if (i !== -1) tasks.value[i] = updated;
}

onMounted(async () => {
  try {
    tasks.value = await api.tasks.list(props.eventId);
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    loading.value = false;
  }
});

async function addTask(): Promise<void> {
  const title = newTitle.value.trim();
  if (!title || adding.value) return;
  adding.value = true;
  try {
    const task = await api.tasks.create(props.eventId, title);
    tasks.value.push(task);
    newTitle.value = '';
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    adding.value = false;
  }
}

async function claim(task: TaskDTO): Promise<void> {
  try {
    replaceTask(await api.tasks.claim(props.eventId, task.id));
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  }
}

async function release(task: TaskDTO): Promise<void> {
  try {
    replaceTask(await api.tasks.release(props.eventId, task.id));
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  }
}

async function toggleDone(task: TaskDTO): Promise<void> {
  const done = task.status === 'DONE';
  try {
    replaceTask(
      await api.tasks.update(props.eventId, task.id, { status: done ? 'OPEN' : 'DONE' }),
    );
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  }
}
</script>

<template>
  <section class="space-y-3">
    <form class="flex gap-2" @submit.prevent="addTask">
      <input
        v-model="newTitle"
        class="input flex-1"
        placeholder="Add a task…"
        aria-label="New task title"
      />
      <button
        type="submit"
        class="btn-primary shrink-0 !px-3.5"
        :disabled="adding || !newTitle.trim()"
        aria-label="Add task"
      >
        <Plus :size="18" :stroke-width="2.5" />
      </button>
    </form>

    <p v-if="loading" class="text-sm text-slate-400">Loading tasks…</p>

    <EmptyState
      v-else-if="tasks.length === 0"
      :icon="ListChecks"
      title="No tasks yet"
      subtitle="Add the first thing that needs doing."
    />

    <ul v-else class="space-y-2">
      <li
        v-for="task in tasks"
        :key="task.id"
        class="card flex items-center gap-3 px-3 py-2.5"
      >
        <span
          class="flex-1 text-sm"
          :class="task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-100'"
        >
          {{ task.title }}
        </span>

        <!-- Unassigned: anyone can claim -->
        <button
          v-if="task.assignedUserId === null"
          type="button"
          class="btn-ghost px-3 py-1.5 text-xs"
          @click="claim(task)"
        >
          Claim
        </button>

        <!-- Assigned to me: toggle done + release -->
        <template v-else-if="task.assignedUserId === identity.id">
          <Avatar :user="task.assignedUser ?? undefined" :size="28" />
          <button
            type="button"
            class="btn-ghost !px-2.5 !py-1.5 text-xs"
            :aria-label="task.status === 'DONE' ? 'Reopen task' : 'Mark task done'"
            @click="toggleDone(task)"
          >
            <RotateCcw v-if="task.status === 'DONE'" :size="14" />
            <template v-else><Check :size="14" :stroke-width="2.5" /> Done</template>
          </button>
          <button type="button" class="btn-ghost !px-2.5 !py-1.5 text-xs" @click="release(task)">
            Release
          </button>
        </template>

        <!-- Assigned to someone else: read-only -->
        <Avatar v-else :user="task.assignedUser ?? undefined" :size="28" />
      </li>
    </ul>
  </section>
</template>
