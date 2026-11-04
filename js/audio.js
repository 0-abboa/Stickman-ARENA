const AudioSys = {
    ctx: null,
    masterGain: null,
    musicInterval: null,
    isMuted: false,
    muteSfx: false,   // silences effects (not music) for the menu's demo fight

    init: function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Lower volume
        this.masterGain.connect(this.ctx.destination);
    },

    playTone: function(freq, type, duration, vol = 1) {
        if (!this.ctx || this.isMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playNoise: function(duration, vol = 1) {
        if (!this.ctx || this.isMuted) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        noise.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start();
    },

    // SFX Presets
    playJump: function() {
        if (this.muteSfx) return;
        this.playTone(300, 'square', 0.1, 0.5);
        setTimeout(() => this.playTone(450, 'square', 0.1, 0.5), 50);
    },

    playAttack: function() {
        if (this.muteSfx) return;
        this.playNoise(0.1, 0.5);
    },

    playHit: function() {
        if (this.muteSfx) return;
        this.playTone(150, 'sawtooth', 0.1, 0.8);
        this.playNoise(0.1, 0.5);
    },

    playShoot: function() {
        if (this.muteSfx) return;
        this.playTone(800, 'triangle', 0.1, 0.3);
        setTimeout(() => this.playTone(400, 'triangle', 0.1, 0.3), 50);
    },

    playPowerup: function() {
        if (this.muteSfx) return;
        this.playTone(400, 'sine', 0.1);
        setTimeout(() => this.playTone(600, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(800, 'sine', 0.2), 200);
    },

    playAngelicaFinale: function() {
        if (this.muteSfx) return;
        // Dramatic sequence (Transformation)
        // Fast, energetic arpeggios
        let note = 0;
        const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25]; // C Major
        
        const playNext = () => {
            if (note >= 20) return; 
            
            const freq = melody[note % melody.length];
            this.playTone(freq, 'sine', 0.1, 0.3);
            this.playTone(freq * 2, 'triangle', 0.1, 0.1); // Sparkle
            
            note++;
            setTimeout(playNext, 80);
        };
        playNext();
    },

    playDramaticIntro: function() {
        if (this.muteSfx) return;
        // "O Gloriosa Virginum" style - Slow, solemn, choral
        this.stopMusic();
        if (!this.ctx) this.init();

        const chords = [
            [261.63, 329.63, 392.00], // C Major
            [293.66, 349.23, 440.00], // D Minor
            [329.63, 392.00, 523.25], // E Minor / C inv
            [392.00, 493.88, 587.33], // G Major
            [523.25, 659.25, 783.99]  // C Major High
        ];

        let step = 0;
        this.musicInterval = setInterval(() => {
            if (this.isMuted) return;
            
            const chord = chords[step % chords.length];
            // Play chord
            chord.forEach(freq => {
                this.playTone(freq, 'triangle', 1.5, 0.2); // Long sustain
                this.playTone(freq / 2, 'sine', 1.5, 0.3); // Bass
            });

            step++;
        }, 2000); // Very slow tempo
    },

    // Simple Procedural Music
    startMusic: function() {
        if (this.musicInterval) return;
        if (!this.ctx) this.init();
        
        let step = 0;
        const bassLine = [110, 110, 146, 146, 98, 98, 130, 130];
        
        this.musicInterval = setInterval(() => {
            if (this.isMuted) return;
            
            // Bass
            if (step % 4 === 0) {
                const note = bassLine[(step / 4) % bassLine.length];
                this.playTone(note, 'triangle', 0.2, 0.3);
            }
            
            // Hi-hat
            if (step % 2 === 0) {
                this.playNoise(0.05, 0.1);
            }
            
            // Melody (Random pentatonic)
            if (Math.random() > 0.7) {
                const scale = [440, 493, 554, 659, 739];
                const note = scale[Math.floor(Math.random() * scale.length)];
                this.playTone(note, 'sine', 0.1, 0.2);
            }

            step++;
        }, 150); // ~100 BPM 16th notes
    },

    playBell: function(freq, vol = 0.5) {
        if (!this.ctx || this.isMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Bells have complex overtones (inharmonic)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Add some FM synthesis for metallic sound
        const modOsc = this.ctx.createOscillator();
        modOsc.type = 'square';
        modOsc.frequency.value = freq * 2.5; // Ratio
        const modGain = this.ctx.createGain();
        modGain.gain.value = 100;
        modOsc.connect(modGain);
        modGain.connect(osc.frequency);
        modOsc.start();
        modOsc.stop(this.ctx.currentTime + 2.0);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.01); // Instant attack
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0); // Long decay
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 2.0);
    },

    playChoir: function(freq, duration, vol = 0.3) {
        if (!this.ctx || this.isMuted) return;
        // Choir pad using multiple detuned saws/triangles
        const voices = 3;
        for(let i=0; i<voices; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            // Detune slightly for chorus effect
            const detune = (i - 1) * 5; 
            osc.detune.value = detune;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            // Slow attack and release (Pad)
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(vol/voices, this.ctx.currentTime + duration * 0.2);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
            
            // Lowpass filter to soften the sound (make it more "ooh" like)
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        }
    },

    playIntroMusic: function() {
        if (this.musicInterval) return;
        if (!this.ctx) this.init();

        let step = 0;
        // Epic Orchestral Progression (Cm - Ab - Fm - G)
        const chords = [
            [130.81, 155.56, 196.00], // Cm
            [103.83, 129.63, 155.56], // Ab
            [87.31, 103.83, 130.81],  // Fm
            [98.00, 123.47, 146.83]   // G
        ];
        
        this.musicInterval = setInterval(() => {
            if (this.isMuted) return;

            const chordIndex = Math.floor(step / 8) % chords.length;
            const currentChord = chords[chordIndex];

            // Heavy Bass Drone (Octave lower)
            if (step % 8 === 0) {
                // Use Triangle/Sine for smoother, less "buzzy" bass
                this.playTone(currentChord[0] / 2, 'triangle', 2.0, 0.4);
                this.playTone(currentChord[0], 'sine', 2.0, 0.3); 
                
                // Occasional Bell Toll
                if (step % 16 === 0) {
                    this.playBell(currentChord[0] * 2, 0.4);
                }
            }

            // Choir Pad (Long chords)
            if (step % 8 === 0) {
                currentChord.forEach(freq => {
                    this.playChoir(freq * 2, 2.0, 0.15);
                });
            }

            // Chord Stabs
            if (step % 4 === 0) {
                currentChord.forEach((freq, i) => {
                    // Arpeggiate slightly
                    setTimeout(() => {
                        this.playTone(freq, 'triangle', 0.8, 0.15);
                    }, i * 50);
                });
            }

            // High Melody (Randomized within scale)
            if (Math.random() > 0.6) {
                const scale = [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16]; // C Minor Harmonic
                const note = scale[Math.floor(Math.random() * scale.length)];
                this.playTone(note * (Math.random() > 0.5 ? 1 : 2), 'sine', 0.3, 0.1);
            }

            step++;
        }, 250); // Slow, heavy tempo
    },

    stopMusic: function() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    },

    playAngelicaFinale: function() {
        if (this.muteSfx) return;
        if (!this.ctx || this.isMuted) return;
        
        // "Suor Angelica" Finale style - Slow, rising, major chords
        const chords = [
            [261.63, 329.63, 392.00], // C Major
            [293.66, 349.23, 440.00], // D Minor
            [329.63, 415.30, 493.88], // E Major
            [349.23, 440.00, 523.25], // F Major
            [392.00, 493.88, 587.33], // G Major
            [523.25, 659.25, 783.99]  // C Major (High)
        ];
        
        let i = 0;
        const playChord = () => {
            if (i >= chords.length) return;
            
            const chord = chords[i];
            chord.forEach(freq => {
                this.playTone(freq, 'sine', 1.5, 0.3); // Long sustain
                this.playTone(freq * 0.5, 'triangle', 1.5, 0.2); // Bass
            });
            
            i++;
            setTimeout(playChord, 1200); // Slow tempo
        };
        
        playChord();
    },

    playShield: function() {
        if (this.muteSfx) return;
        if (!this.ctx || this.isMuted) return;
        // Sci-fi shield activation sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.2); // Pitch up
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    },

    // Rising/falling noise sweep through a filter (swings, whooshes)
    sweep: function(from, to, duration, vol, type) {
        if (!this.ctx || this.isMuted || this.muteSfx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'sawtooth';
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + duration);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + duration);
    },

    playSwing: function(heavy) {
        if (this.muteSfx) return;
        this.playNoise(heavy ? 0.22 : 0.12, heavy ? 0.6 : 0.4);
        this.sweep(heavy ? 220 : 600, heavy ? 60 : 180, heavy ? 0.25 : 0.12, heavy ? 0.35 : 0.2);
    },

    playGun: function(type) {
        if (this.muteSfx) return;
        switch (type) {
            case 'bullet': this.playNoise(0.06, 0.45); this.sweep(900, 200, 0.08, 0.25, 'square'); break;
            case 'pellet': this.playNoise(0.18, 0.8); this.sweep(300, 60, 0.2, 0.4); break;
            case 'sniper': this.playNoise(0.3, 0.9); this.sweep(1400, 80, 0.35, 0.45, 'square'); break;
            case 'arrow': this.sweep(500, 900, 0.12, 0.25, 'triangle'); break;
            case 'grenade': this.sweep(200, 90, 0.15, 0.5, 'sine'); this.playNoise(0.08, 0.3); break;
            case 'rocket': this.playNoise(0.4, 0.5); this.sweep(120, 300, 0.4, 0.3); break;
            case 'boomerang': this.sweep(300, 700, 0.3, 0.2, 'triangle'); break;
            case 'bolt': this.sweep(700, 1300, 0.08, 0.3, 'triangle'); this.playNoise(0.05, 0.2); break;
            case 'kunai': this.sweep(900, 1500, 0.1, 0.18, 'triangle'); break;
            case 'flame': if (Math.random() < 0.35) this.playNoise(0.12, 0.18); break;
            case 'plasma': this.sweep(1200, 300, 0.15, 0.3, 'sawtooth'); break;
            case 'bomb': this.sweep(250, 120, 0.12, 0.35, 'sine'); break;
            case 'seeker': this.playNoise(0.3, 0.4); this.sweep(200, 600, 0.35, 0.3); break;
            default: this.playShoot();
        }
    },

    playExplosion: function() {
        if (this.muteSfx) return;
        this.playNoise(0.7, 1.0);
        this.sweep(160, 30, 0.6, 0.8, 'sine');
    },

    playKO: function() {
        if (this.muteSfx) return;
        this.sweep(500, 70, 0.5, 0.5, 'square');
        this.playNoise(0.3, 0.6);
    },
};
