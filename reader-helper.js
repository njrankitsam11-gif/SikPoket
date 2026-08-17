/**
 * SikPoket Reader & TTS Helper (reader-helper.js)
 * Distraction-free article parsing, offline text caching, and SpeechSynthesis voice narration.
 */

(function(global) {
  const ReaderHelper = {
    // Calculate reading time in minutes (average 200 wpm)
    calculateReadingTime: function(text) {
      if (!text) return 1;
      const words = String(text).trim().split(/\s+/).length;
      return Math.max(1, Math.ceil(words / 200));
    },

    // Clean and format text into structured paragraphs
    cleanContent: function(rawContent, title = '') {
      if (!rawContent) return '<p>No content available to display.</p>';

      // If it contains basic HTML tags, sanitize lightly
      let cleaned = String(rawContent)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
        .trim();

      // If it's pure plain text, split into paragraphs
      if (!cleaned.includes('<p>') && !cleaned.includes('<div>')) {
        const paragraphs = cleaned.split(/\n\s*\n/).map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');
        return paragraphs || `<p>${cleaned}</p>`;
      }

      return cleaned;
    },

    // SpeechSynthesis Audio Narrator (TTS)
    TTS: {
      synth: typeof window !== 'undefined' ? window.speechSynthesis : null,
      utterance: null,
      isPlaying: false,
      isPaused: false,
      rate: 1.0,
      voice: null,

      init: function() {
        if (!this.synth) return;
        // Populate voices
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => {
            const voices = this.synth.getVoices();
            this.voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium'))) || voices[0];
          };
        }
      },

      speak: function(text, onBoundary = null, onEnd = null) {
        if (!this.synth) {
          console.warn('SpeechSynthesis is not supported on this platform.');
          return;
        }

        this.stop();

        // Strip HTML tags for clean voice narration
        const plainText = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!plainText) return;

        this.utterance = new SpeechSynthesisUtterance(plainText);
        this.utterance.rate = this.rate;
        if (this.voice) this.utterance.voice = this.voice;

        this.utterance.onboundary = (e) => {
          if (e.name === 'word' && onBoundary) {
            onBoundary(e.charIndex, e.charLength || 5);
          }
        };

        this.utterance.onend = () => {
          this.isPlaying = false;
          this.isPaused = false;
          if (onEnd) onEnd();
        };

        this.utterance.onerror = (e) => {
          console.warn('TTS error:', e);
          this.isPlaying = false;
          this.isPaused = false;
          if (onEnd) onEnd();
        };

        this.synth.speak(this.utterance);
        this.isPlaying = true;
        this.isPaused = false;
      },

      pause: function() {
        if (this.synth && this.isPlaying && !this.isPaused) {
          this.synth.pause();
          this.isPaused = true;
        }
      },

      resume: function() {
        if (this.synth && this.isPaused) {
          this.synth.resume();
          this.isPaused = false;
        }
      },

      stop: function() {
        if (this.synth) {
          this.synth.cancel();
          this.isPlaying = false;
          this.isPaused = false;
        }
      },

      setRate: function(newRate) {
        this.rate = Math.max(0.5, Math.min(2.5, parseFloat(newRate) || 1.0));
        if (this.isPlaying && !this.isPaused && this.utterance) {
          // Restart speaking from current point if desired, or let next chunk adopt rate
        }
      }
    }
  };

  ReaderHelper.TTS.init();
  global.ReaderHelper = ReaderHelper;
})(typeof window !== 'undefined' ? window : globalThis);
