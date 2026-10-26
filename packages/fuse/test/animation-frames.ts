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
