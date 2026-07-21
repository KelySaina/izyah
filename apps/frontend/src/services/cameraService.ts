/**
 * Camera / photo abstraction.
 *
 * WEB (now): opens the native file picker with `capture` so mobile browsers
 * offer the camera directly.
 * NATIVE (later): replace the body with `@capacitor/camera` Camera.getPhoto().
 * Call sites only ever see `Promise<File | null>`, so they never change.
 */
export async function pickPhoto(options: { camera?: boolean } = {}): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    if (options.camera) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // If the user cancels, most browsers fire no event — resolve on focus return.
    window.addEventListener(
      'focus',
      () => setTimeout(() => resolve(input.files?.[0] ?? null), 500),
      { once: true },
    );
    input.click();
  });
}

export const isNativeCameraAvailable = false; // flips true under Capacitor
