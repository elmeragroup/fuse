/**
 * Waits for animation frames, so React renders what the last state change scheduled.
 *
 * @param count - How many frames to wait.
 */
export async function nextFrames(count = 1): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
}

/**
 * Waits through at least `ms` milliseconds of animation frames, so every frame in between runs its
 * rendering steps.
 *
 * @param ms - The least time to wait, in milliseconds.
 */
export async function wait(ms: number): Promise<void> {
  const start = performance.now();
  do await nextFrames(1);
  while (performance.now() - start < ms);
}
