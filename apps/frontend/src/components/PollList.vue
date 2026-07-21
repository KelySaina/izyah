<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BarChart3, Plus, Minus } from 'lucide-vue-next';
import { api, ApiError } from '@/services/api';
import { useUiStore } from '@/stores/ui';
import EmptyState from '@/components/EmptyState.vue';
import type { PollDTO } from '@/types';

const props = defineProps<{ eventId: string }>();

const ui = useUiStore();

const polls = ref<PollDTO[]>([]);
const loading = ref(true);

const showForm = ref(false);
const question = ref('');
const options = ref<string[]>(['', '']);
const creating = ref(false);

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

function replacePoll(updated: PollDTO): void {
  const i = polls.value.findIndex((p) => p.id === updated.id);
  if (i !== -1) polls.value[i] = updated;
}

function pct(votes: number, total: number): number {
  return (votes / Math.max(total, 1)) * 100;
}

onMounted(async () => {
  try {
    polls.value = await api.polls.list(props.eventId);
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    loading.value = false;
  }
});

function addOption(): void {
  options.value.push('');
}

function removeOption(index: number): void {
  if (options.value.length > 2) options.value.splice(index, 1);
}

function resetForm(): void {
  question.value = '';
  options.value = ['', ''];
  showForm.value = false;
}

async function createPoll(): Promise<void> {
  if (creating.value) return;
  const q = question.value.trim();
  const opts = options.value.map((o) => o.trim()).filter((o) => o.length > 0);
  if (!q) {
    ui.toast('Add a question', 'error');
    return;
  }
  if (opts.length < 2) {
    ui.toast('Add at least two options', 'error');
    return;
  }
  creating.value = true;
  try {
    const poll = await api.polls.create(props.eventId, { question: q, options: opts });
    polls.value.push(poll);
    resetForm();
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  } finally {
    creating.value = false;
  }
}

async function vote(poll: PollDTO, optionId: string): Promise<void> {
  try {
    replacePoll(await api.polls.vote(props.eventId, poll.id, optionId));
  } catch (err) {
    ui.toast(errMsg(err), 'error');
  }
}
</script>

<template>
  <section class="space-y-4">
    <!-- Collapsible create form -->
    <div class="card p-3">
      <button
        type="button"
        class="flex w-full items-center justify-between text-sm font-semibold text-fg"
        :aria-expanded="showForm"
        @click="showForm = !showForm"
      >
        <span class="flex items-center gap-1.5"><BarChart3 :size="16" class="text-accent" /> New poll</span>
        <Minus v-if="showForm" :size="18" class="text-fg-2" />
        <Plus v-else :size="18" class="text-fg-2" />
      </button>

      <form v-if="showForm" class="mt-3 space-y-3" @submit.prevent="createPoll">
        <div>
          <label class="label" for="poll-question">Question</label>
          <input
            id="poll-question"
            v-model="question"
            class="input"
            placeholder="What should we decide?"
          />
        </div>

        <div class="space-y-2">
          <span class="label">Options</span>
          <div v-for="(_, i) in options" :key="i" class="flex gap-2">
            <input
              v-model="options[i]"
              class="input flex-1"
              :placeholder="`Option ${i + 1}`"
              :aria-label="`Option ${i + 1}`"
            />
            <button
              v-if="options.length > 2"
              type="button"
              class="btn-ghost !px-3"
              aria-label="Remove option"
              @click="removeOption(i)"
            >
              <Minus :size="16" />
            </button>
          </div>
          <button type="button" class="btn-ghost text-xs" @click="addOption">
            <Plus :size="14" /> Add option
          </button>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="creating">
          Create poll
        </button>
      </form>
    </div>

    <p v-if="loading" class="text-sm text-fg-2">Loading polls…</p>

    <EmptyState
      v-else-if="polls.length === 0"
      :icon="BarChart3"
      title="No polls yet"
      subtitle="Create one to gather everyone's vote."
    />

    <ul v-else class="space-y-3">
      <li v-for="poll in polls" :key="poll.id" class="card space-y-3 p-4">
        <h3 class="text-sm font-semibold text-fg">{{ poll.question }}</h3>

        <ul class="space-y-2">
          <li v-for="option in poll.options" :key="option.id">
            <button
              type="button"
              class="relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition"
              :class="
                option.id === poll.viewerOptionId
                  ? 'border-brand-500 bg-surface-2 ring-2 ring-brand-500/40'
                  : 'border-line/20 bg-surface-2 hover:bg-surface-3'
              "
              @click="vote(poll, option.id)"
            >
              <span
                class="absolute inset-y-0 left-0 bg-brand-600/25"
                :style="{ width: pct(option.votes, poll.totalVotes) + '%' }"
                aria-hidden="true"
              />
              <span class="relative flex items-center justify-between gap-2">
                <span class="text-fg">{{ option.text }}</span>
                <span class="text-xs text-fg-2">{{ option.votes }}</span>
              </span>
            </button>
          </li>
        </ul>

        <p class="text-xs text-fg-3">
          {{ poll.totalVotes }} vote{{ poll.totalVotes === 1 ? '' : 's' }}
        </p>
      </li>
    </ul>
  </section>
</template>
