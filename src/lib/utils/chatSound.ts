/**
 * Web Audio API synthesized chime for incoming chat messages.
 * Uses native browser oscillators - zero network requests, zero lag, zero 404 risk.
 */
export function playMessageChime() {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const now = ctx.currentTime;

      // Two-tone chime: D5 (587.33Hz) -> A5 (880Hz)
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }

    // Gentle haptic feedback on mobile devices
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([35, 45, 35]);
    }
  } catch (err) {
    // Audio contexts might be blocked until first user gesture; suppress gracefully
  }
}
