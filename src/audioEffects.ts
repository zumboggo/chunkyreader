export function playSfx(type: 'correct' | 'wrong' | 'celebrate' | 'fireworks') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, t + 0.1); // C6
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'celebrate') {
      // Arpeggio C5 E5 G5 C6
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, i) => {
        const timeOffset = i * 0.1;
        const noteOsc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        noteOsc.type = 'sine';
        noteOsc.frequency.value = freq;
        noteOsc.connect(noteGain);
        noteGain.connect(ctx.destination);
        noteGain.gain.setValueAtTime(0, t + timeOffset);
        noteGain.gain.linearRampToValueAtTime(0.2, t + timeOffset + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.01, t + timeOffset + 0.3);
        noteOsc.start(t + timeOffset);
        noteOsc.stop(t + timeOffset + 0.3);
      });
    } else if (type === 'fireworks') {
      // Whistle up, then a noise pop
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(400, t);
      popOsc.frequency.exponentialRampToValueAtTime(1000, t + 0.3); // whistle up
      popGain.gain.setValueAtTime(0, t);
      popGain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      popGain.gain.linearRampToValueAtTime(0.01, t + 0.3);
      
      // The pop (using a short low frequency burst)
      const burstOsc = ctx.createOscillator();
      const burstGain = ctx.createGain();
      burstOsc.type = 'square';
      burstOsc.frequency.setValueAtTime(100, t + 0.3);
      burstOsc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
      burstGain.gain.setValueAtTime(0, t + 0.3);
      burstGain.gain.linearRampToValueAtTime(0.3, t + 0.32);
      burstGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      burstOsc.connect(burstGain);
      burstGain.connect(ctx.destination);

      popOsc.start(t);
      popOsc.stop(t + 0.3);
      burstOsc.start(t + 0.3);
      burstOsc.stop(t + 0.5);
    }
  } catch (e) {
    // Ignore audio context errors
  }
}
