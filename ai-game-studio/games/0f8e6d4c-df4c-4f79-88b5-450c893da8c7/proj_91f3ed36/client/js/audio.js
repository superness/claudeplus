/**
 * Cosmic Tic-Tac-Toe - Audio System
 * Generates cosmic sound effects using Web Audio API
 */

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterVolume = 0.3;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    // Resume audio context (needed for browsers that require user interaction)
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Create oscillator with envelope
    createTone(frequency, type, duration, attack, decay, volume = 1) {
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        const now = this.ctx.currentTime;
        const vol = this.masterVolume * volume;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + attack);
        gain.gain.linearRampToValueAtTime(vol * 0.3, now + attack + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Symbol placement sound - cosmic whoosh
    playPlacement(symbol) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const isOrbis = symbol === 'O';
        const baseFreq = isOrbis ? 440 : 330;

        // Main tone
        this.createTone(baseFreq, 'sine', 0.4, 0.02, 0.3, 0.6);

        // Harmonic
        setTimeout(() => {
            this.createTone(baseFreq * 1.5, 'sine', 0.3, 0.02, 0.2, 0.3);
        }, 50);

        // Sparkle effect
        setTimeout(() => {
            this.createTone(baseFreq * 2, 'sine', 0.2, 0.01, 0.1, 0.2);
        }, 100);

        // Impact low
        this.createTone(isOrbis ? 110 : 82, 'triangle', 0.3, 0.01, 0.2, 0.4);
    }

    // Victory fanfare - triumphant cascade
    playVictory() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const baseTime = 0;

        notes.forEach((note, i) => {
            setTimeout(() => {
                this.createTone(note, 'sine', 0.6, 0.02, 0.4, 0.5);
                this.createTone(note * 0.5, 'triangle', 0.8, 0.02, 0.6, 0.3);
            }, i * 150);
        });

        // Grand finale chord
        setTimeout(() => {
            this.createTone(523, 'sine', 1.5, 0.1, 1.0, 0.4);
            this.createTone(659, 'sine', 1.5, 0.1, 1.0, 0.3);
            this.createTone(784, 'sine', 1.5, 0.1, 1.0, 0.3);
            this.createTone(1047, 'sine', 1.5, 0.1, 1.0, 0.2);
        }, 600);
    }

    // Draw sound - balanced resonance
    playDraw() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Orbis tone
        this.createTone(440, 'sine', 1.0, 0.1, 0.8, 0.4);

        // Crucia tone (slightly dissonant)
        setTimeout(() => {
            this.createTone(466, 'sine', 1.0, 0.1, 0.8, 0.4);
        }, 100);

        // Resolution
        setTimeout(() => {
            this.createTone(392, 'sine', 1.5, 0.2, 1.0, 0.3);
            this.createTone(523, 'sine', 1.5, 0.2, 1.0, 0.3);
        }, 500);
    }

    // Defeat sound - descending
    playDefeat() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const notes = [392, 349, 330, 262]; // G4, F4, E4, C4

        notes.forEach((note, i) => {
            setTimeout(() => {
                this.createTone(note, 'sine', 0.4, 0.02, 0.3, 0.4);
            }, i * 200);
        });

        // Low rumble
        this.createTone(65, 'triangle', 1.2, 0.1, 0.8, 0.3);
    }

    // Button click sound
    playClick() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        this.createTone(880, 'sine', 0.1, 0.01, 0.05, 0.2);
        this.createTone(1100, 'sine', 0.08, 0.01, 0.04, 0.15);
    }

    // Hover sound
    playHover() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        this.createTone(660, 'sine', 0.05, 0.01, 0.02, 0.1);
    }

    // Game start sound
    playGameStart() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Rising tones
        const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
        notes.forEach((note, i) => {
            setTimeout(() => {
                this.createTone(note, 'sine', 0.3, 0.02, 0.2, 0.4);
            }, i * 100);
        });

        // Deep space ambience
        this.createTone(55, 'sine', 2, 0.5, 1.5, 0.2);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Export for use in other modules
window.AudioSystem = AudioSystem;
