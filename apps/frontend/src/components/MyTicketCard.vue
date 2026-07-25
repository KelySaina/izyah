<script setup lang="ts">
import { onMounted, ref } from 'vue';
import QRCode from 'qrcode';
import { Ticket, CheckCircle2 } from 'lucide-vue-next';
import { useEventsStore } from '@/stores/events';
import type { MyTicketDTO } from '@/types';

const props = defineProps<{ eventId: string }>();

const events = useEventsStore();
const ticket = ref<MyTicketDTO | null>(null);
const qrDataUrl = ref<string | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const t = await events.fetchMyTicket(props.eventId);
    ticket.value = t;
    if (t) {
      qrDataUrl.value = await QRCode.toDataURL(`izyah:ticket:v1:${props.eventId}:${t.ticketCode}`, {
        width: 240,
        margin: 1,
      });
    }
  } catch {
    // Non-critical — the card just doesn't show if the ticket can't be fetched.
  } finally {
    loading.value = false;
  }
});
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
</template>
