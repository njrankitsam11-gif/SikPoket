/**
 * SikPoket Ambient Soundscapes Synthesizer
 * 100% Procedural Web Audio API sound generator (Zero external audio files, works offline).
 * Presets: Soft Rain, Lo-Fi Vinyl, Deep Cafe Hum, Binaural 432Hz Alpha Waves.
 */

(function(global) {
  let audioCtx = null;
  let currentNodes = [];
  let masterGain = null;
  let activePreset = null;
  let currentVolume = 0.35;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function createNoiseBuffer(ctx, duration = 5) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise integration
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    return buffer;
  }

  const AudioHelper = {
    presets: [
      { id: 'rain', name: '🌧️ Soft Rain', desc: 'Gentle ambient raindrops' },
      { id: 'lofi', name: '☕ Lo-Fi Vinyl', desc: 'Warm analog hiss and crackle' },
      { id: 'binaural', name: '🧘 432Hz Waves', desc: 'Binaural alpha waves for deep focus' },
      { id: 'cafe', name: '🥐 Cafe Ambiance', desc: 'Subtle low-frequency coffeehouse hum' }
    ],

    getActivePreset: function() {
      return activePreset;
    },

    getVolume: function() {
      return currentVolume;
    },

    setVolume: function(val) {
      currentVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
      }
    },

    stop: function() {
      if (currentNodes.length > 0) {
        currentNodes.forEach(node => {
          try {
            if (node.stop) node.stop();
            node.disconnect();
          } catch (e) {}
        });
        currentNodes = [];
      }
      activePreset = null;
    },

    play: function(presetId, volume = currentVolume) {
      this.stop();
      const ctx = getAudioContext();
      currentVolume = volume;

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(currentVolume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      if (presetId === 'rain') {
        // Brown noise rain with sweeping filter
        const buffer = createNoiseBuffer(ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, ctx.currentTime);

        source.connect(filter);
        filter.connect(masterGain);
        source.start();
        currentNodes.push(source, filter);
      } else if (presetId === 'lofi') {
        // Vinyl hiss with periodic crackle
        const buffer = createNoiseBuffer(ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(1200, ctx.currentTime);
        bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

        const crackleGain = ctx.createGain();
        crackleGain.gain.setValueAtTime(0.6, ctx.currentTime);

        source.connect(bandpass);
        bandpass.connect(crackleGain);
        crackleGain.connect(masterGain);
        source.start();
        currentNodes.push(source, bandpass, crackleGain);
      } else if (presetId === 'binaural') {
        // 432Hz left, 440Hz right (8Hz Alpha Beat)
        const merger = ctx.createChannelMerger(2);

        const oscL = ctx.createOscillator();
        oscL.type = 'sine';
        oscL.frequency.setValueAtTime(216, ctx.currentTime);

        const oscR = ctx.createOscillator();
        oscR.type = 'sine';
        oscR.frequency.setValueAtTime(224, ctx.currentTime);

        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(masterGain);

        oscL.start();
        oscR.start();
        currentNodes.push(oscL, oscR, merger);
      } else if (presetId === 'cafe') {
        // Warm low coffeehouse rumble
        const buffer = createNoiseBuffer(ctx);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(420, ctx.currentTime);

        source.connect(lowpass);
        lowpass.connect(masterGain);
        source.start();
        currentNodes.push(source, lowpass);
      }

      activePreset = presetId;
    }
  };

  global.AudioHelper = AudioHelper;
})(typeof window !== 'undefined' ? window : globalThis);
