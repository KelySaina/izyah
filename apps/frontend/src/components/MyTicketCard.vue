<script setup lang="ts">
import { onMounted, ref } from 'vue';
import QRCode from 'qrcode';
import { Ticket, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { useEventsStore } from '@/stores/events';
import { ApiError } from '@/services/api';
import type { MyTicketDTO } from '@/types';

const props = defineProps<{ eventId: string }>();

const events = useEventsStore();
const ticket = ref<MyTicketDTO | null>(null);
const qrDataUrl = ref<string | null>(null);
const loading = ref(true);
// Distinct from "not eligible for a ticket" (fetchMyTicket resolves `null`
// for that) — this is specifically "the fetch itself failed," which needs a
// retry path since the QR code is what gets a guest through the door.
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const t = await events.fetchMyTicket(props.eventId);
    ticket.value = t;
    if (t) {
      qrDataUrl.value = await QRCode.toDataURL(`izyah:ticket:v1:${props.eventId}:${t.ticketCode}`, {
        width: 240,
        margin: 1,
      });
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : "Couldn't load your ticket";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section v-if="!loading && ticket" class="card flex flex-col items-center gap-3 p-4 text-center">
    <h2 class="flex items-center gap-1.5 text-sm font-bold text-fg">
      <Ticket :size="15" class="text-accent" /> Your ticket
    </h2>
    <img v-if="qrDataUrl" :src="qrDataUrl" alt="Your ticket QR code" class="h-48 w-48 rounded-lg" />
    <p v-if="ticket.checkedIn" class="flex items-center gap-1.5 text-sm font-medium text-accent">
      <CheckCircle2 :size="15" /> Checked in
    </p>
    <p v-else class="text-xs text-fg-3">Show this at the door to be checked in.</p>
  </section>

  <section v-else-if="!loading && error" class="card flex flex-col items-center gap-2 p-4 text-center">
    <p class="flex items-center gap-1.5 text-sm font-medium text-red-500">
      <AlertCircle :size="15" /> {{ error }}
    </p>
    <button type="button" class="btn-ghost text-xs" @click="load">Try again</button>
  </section>
</template>
