import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Reactive height, in px, currently hidden at the bottom of the layout viewport
 * by the on-screen keyboard — 0 when there's no keyboard.
 *
 * Derived from `visualViewport`, so it works even where the
 * `interactive-widget=resizes-content` viewport hint isn't honoured (iOS
 * Safari, Firefox): the layout viewport (`window.innerHeight`) stays full while
 * the visible area (`visualViewport.height`) shrinks, and the difference is the
 * keyboard. On browsers that DO honour the hint both shrink together, so this
 * reads ~0 and the two mechanisms don't fight.
 *
 * Use it to lift fixed-bottom UI (e.g. a chat input) above the keyboard.
 */
export function useKeyboardInset() {
  const inset = ref(0);

  function update(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    inset.value = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }

  onMounted(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  });

  onUnmounted(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
  });

  return { inset };
}
