import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RsvpButtons from '@/components/RsvpButtons.vue';

describe('RsvpButtons', () => {
  it('renders three options and highlights the active status', () => {
    const wrapper = mount(RsvpButtons, {
      props: { status: 'GOING', counts: { going: 2, maybe: 1, notGoing: 0, waitlist: 0, total: 3 } },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(3);
    // The active (GOING) button carries the gold brand background class.
    const going = buttons.find((b) => b.text().includes('Going'));
    expect(going?.classes().join(' ')).toContain('bg-brand-500');
  });

  it('emits change with the chosen status', async () => {
    const wrapper = mount(RsvpButtons, { props: { status: null } });
    const maybe = wrapper.findAll('button').find((b) => b.text().includes('Maybe'));
    await maybe?.trigger('click');
    expect(wrapper.emitted('change')?.[0]).toEqual(['MAYBE']);
  });
});
