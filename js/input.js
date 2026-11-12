class InputManager {
    constructor() {
        this.keys = {};
        this.gamepads = {};
        this.padArm = {};
        this.touchState = {
            leftStick: { x: 0, y: 0, active: false },
            rightStick: { x: 0, y: 0, active: false },
            buttons: { jump: false, attack: false, shield: false, crouch: false }
        };
        this.pausePressed = false;
        this.touchButtonReleases = new Set();

        this.setupKeyboardListeners();
        this.setupGamepadListeners();
        this.setupTouchListeners();
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            // A browser shortcut (Cmd/Ctrl + key) swallows the matching key-up, which used to leave the key
            // "held" for good: never record those, and let go of everything that was down
            if ((e.metaKey || e.ctrlKey) && !/^(Meta|Control)/.test(e.code)) { this.keys = {}; return; }
            this.keys[e.code] = true;
            if (e.code === 'Escape') this.pausePressed = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Escape') this.pausePressed = false;
        });

        // Key-ups that happen while the page isn't focused never arrive, which
        // left keys (Shift = shield) held forever. Drop everything on focus loss,
        // and trust the event's modifier flags over a possibly missed Shift key-up.
        const releaseAll = () => {
            this.keys = {};
            this.pausePressed = false;
            const b = this.touchState.buttons;
            b.jump = b.attack = b.shield = b.crouch = false;
            for (const release of this.touchButtonReleases) release();
            if (this.releaseTouch) this.releaseTouch();
        };
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
        const syncShift = (e) => {
            if (!e.shiftKey) this.keys.ShiftLeft = this.keys.ShiftRight = false;
            // Cmd / Ctrl just went up or down: key-ups in between never arrive, so start clean
            if (e.metaKey !== undefined && (!!e.metaKey !== !!this.metaWas || !!e.ctrlKey !== !!this.ctrlWas)) { this.metaWas = e.metaKey; this.ctrlWas = e.ctrlKey; if (e.type !== 'keydown' || /^(Meta|Control)/.test(e.code)) this.keys = {}; }
        };
        for (const evt of ['keydown', 'keyup', 'mousemove', 'mousedown']) window.addEventListener(evt, syncShift, true);
        window.addEventListener('contextmenu', releaseAll);
        window.addEventListener('pagehide', releaseAll);
        this.releaseAll = releaseAll;
    }

    setupGamepadListeners() {
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
                e.gamepad.index, e.gamepad.id,
                e.gamepad.buttons.length, e.gamepad.axes.length);
            this.padArm[e.gamepad.index] = {};   // buttons count only after being seen released
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected from index %d: %s",
                e.gamepad.index, e.gamepad.id);
            delete this.gamepads[e.gamepad.index]; delete this.padArm[e.gamepad.index]; this.releaseAll && this.releaseAll();
        });
    }

    setupTouchListeners() {
        // Helper to handle joystick logic. The raw thumb offset is kept for flight; the x value a
        // ground fighter walks with is snapped to full speed as soon as the stick is pushed past a
        // small dead zone, wherever the thumb sits in the ring.
        const handleJoystick = (touch, stickData, elementId, snapX) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const maxDist = rect.width / 2;
            
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            
            // Normalize -1 to 1
            stickData.rawX = dx / maxDist;
            stickData.rawY = dy / maxDist;
            stickData.x = snapX ? (Math.abs(stickData.rawX) > 0.15 ? Math.sign(stickData.rawX) : 0) : stickData.rawX;
            stickData.y = stickData.rawY;
            stickData.active = true;

            // Visual update
            const knob = el.querySelector('.joystick-knob');
            if (knob) {
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        };

        const resetJoystick = (stickData, elementId) => {
            stickData.x = 0;
            stickData.y = 0;
            stickData.rawX = 0;
            stickData.rawY = 0;
            stickData.active = false;
            const el = document.getElementById(elementId);
            if (el) {
                const knob = el.querySelector('.joystick-knob');
                if (knob) knob.style.transform = `translate(-50%, -50%)`;
            }
        };

        // Touch event handlers
        const leftStickEl = document.getElementById('joystick-left');
        const rightStickEl = document.getElementById('joystick-right');

        // Floating stick: touch anywhere on the left half of the screen and the stick appears under the thumb
        const zone = document.getElementById('touch-zone') || leftStickEl;
        if (leftStickEl && zone) {
            let leftId = null;
            const find = (list) => { for (const t of list) if (t.identifier === leftId) return t; return null; };
            zone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (leftId !== null) return;
                const t = e.changedTouches[0];
                leftId = t.identifier;
                const size = leftStickEl.offsetWidth, pad = 6;
                const x = Math.max(size / 2 + pad, Math.min(window.innerWidth * 0.62, t.clientX)), y = Math.max(size / 2 + pad, Math.min(window.innerHeight - size / 2 - pad, t.clientY));
                leftStickEl.style.left = (x - size / 2) + 'px'; leftStickEl.style.top = (y - size / 2) + 'px';
                leftStickEl.style.bottom = 'auto'; leftStickEl.classList.add('held');
                handleJoystick(t, this.touchState.leftStick, 'joystick-left', true);
            }, { passive: false });
            zone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const t = find(e.changedTouches);
                if (t) handleJoystick(t, this.touchState.leftStick, 'joystick-left', true);
            }, { passive: false });
            const end = (e) => {
                e.preventDefault();
                if (!find(e.changedTouches)) return;
                leftId = null;
                resetJoystick(this.touchState.leftStick, 'joystick-left');
                leftStickEl.style.left = ''; leftStickEl.style.top = ''; leftStickEl.style.bottom = ''; leftStickEl.classList.remove('held');
            };
            zone.addEventListener('touchend', end, { passive: false });
            zone.addEventListener('touchcancel', end, { passive: false });
            this.releaseTouch = () => { leftId = null; end({ preventDefault() {}, changedTouches: [] }); resetJoystick(this.touchState.leftStick, 'joystick-left'); leftStickEl.style.left = ''; leftStickEl.style.top = ''; leftStickEl.style.bottom = ''; leftStickEl.classList.remove('held'); };
        }

        if(rightStickEl) {
            rightStickEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleJoystick(e.targetTouches[0], this.touchState.rightStick, 'joystick-right');
            }, { passive: false });
            rightStickEl.addEventListener('touchmove', (e) => {
                e.preventDefault();
                handleJoystick(e.targetTouches[0], this.touchState.rightStick, 'joystick-right');
            }, { passive: false });
            rightStickEl.addEventListener('touchend', (e) => {
                e.preventDefault();
                resetJoystick(this.touchState.rightStick, 'joystick-right');
            }, { passive: false });
        }

        // Buttons
        const btnJump = document.getElementById('btn-jump');
        const btnAttack = document.getElementById('btn-attack');
        const btnShield = document.getElementById('btn-shield');
        const btnCrouch = document.getElementById('btn-crouch');
        const btnPause = document.getElementById('btn-pause-mobile');

        const bindButton = (btn, key) => {
            if (!btn) return;
            const active = new Set();
            const set = (pressed) => {
                if (key === 'pause') { if (pressed) this.pausePressed = true; }
                else this.touchState.buttons[key] = pressed;
                btn.classList.toggle('pressed', pressed);
            };
            const down = (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                e.preventDefault();
                if (e.pointerId !== undefined) {
                    active.add(e.pointerId);
                    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
                } else active.add(e.changedTouches ? e.changedTouches[0].identifier : 0);
                set(true);
            };
            const up = (e) => {
                if (e.cancelable) e.preventDefault();
                if (e.pointerId !== undefined) active.delete(e.pointerId);
                else if (e.changedTouches) for (const t of e.changedTouches) active.delete(t.identifier);
                else active.clear();
                set(active.size > 0);
            };
            this.touchButtonReleases.add(() => { active.clear(); set(false); });
            if (window.PointerEvent) {
                btn.addEventListener('pointerdown', down);
                for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, up);
            } else {
                btn.addEventListener('touchstart', down, { passive: false });
                btn.addEventListener('touchend', up, { passive: false });
                btn.addEventListener('touchcancel', up, { passive: false });
            }
        };

        bindButton(btnJump, 'jump');
        bindButton(btnAttack, 'attack');
        bindButton(btnShield, 'shield');
        bindButton(btnCrouch, 'crouch');
        bindButton(btnPause, 'pause');
    }

    // Browsers hand out SNAPSHOTS of a controller. Keeping an old one (the state at the moment it connected,
    // or just before it was unplugged) made a held button read as pressed forever, so Solo play attacked on its
    // own with no key down. Re-read every controller each frame and forget the ones that are gone.
    pollGamepads() {
        const t = performance.now();
        if (this.lastPoll === t) return;
        this.lastPoll = t;
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        const seen = {};
        for (let i = 0; i < list.length; i++) {
            const g = list[i];
            if (!g || g.connected === false) continue;
            seen[i] = g;
            // arm each button only once it has been seen up, so a pad that wakes with something held does nothing
            const arm = this.padArm[i] || (this.padArm[i] = {});
            g.buttons.forEach((b, k) => { const down = b.pressed || b.value > 0.5; if (!down) arm[k] = true; else if (arm[k] === undefined) arm[k] = false; });
        }
        for (const i in this.padArm) if (!seen[i]) delete this.padArm[i];
        this.gamepads = seen;
    }

    // Is this button really held right now? (needs a fresh poll, and to have been released at least once)
    padDown(i, k) {
        const g = this.gamepads[i];
        if (!g || !g.buttons[k]) return false;
        const b = g.buttons[k];
        return (b.pressed || b.value > 0.5) && !!(this.padArm[i] && this.padArm[i][k]);
    }

    checkPause(lobby) {
        // Check Keyboard
        if (this.pausePressed) {
            this.pausePressed = false; // Consume event
            return true;
        }

        // Check Gamepads
        this.pollGamepads();
        let gamepadPause = false;
        for (const index in this.gamepads) {
            const gp = this.gamepads[index];
            if (gp) {
                // Button 9 = Start, Button 8 = Select/Back, Button 1 = B (Xbox) / Circle (PS)
                if ((!lobby && this.padDown(index, 9)) || this.padDown(index, 8) || this.padDown(index, 1)) {   // in the party lobby Start begins the match, so only Back / B leave
                    
                    gamepadPause = true;
                    break;
                }
            }
        }

        if (gamepadPause) {
            if (!this.pauseLock) {
                this.pauseLock = true;
                return true;
            }
        } else {
            this.pauseLock = false;
        }
        
        return false;
    }

    // Touch stick: walking uses the snapped x (always full speed); flying takes the raw stick as a
    // direction (up, down, any way). Pushing the stick up on the ground is a jump, but that jump is
    // its own flag so flying never reads it as a jump. The touch flag tells the flight code to take
    // the stick alone: the jump and lie-down buttons do nothing while airborne.
    touchInput(input) {
        const L = this.touchState.leftStick;
        input.x = L.x;
        input.touch = true;
        input.stick = { x: L.rawX || 0, y: L.rawY || 0 };
        if (L.active && L.rawY < -0.5) input.stickJump = true;
    }

    getPlayerInput(playerIndex, inputType) {
        // inputType: 'keyboard_wasd', 'keyboard_arrows', 'gamepad_0', 'gamepad_1', etc., 'touch'
        
        const input = {
            x: 0,
            y: 0,
            aimX: 0,
            aimY: 0,
            jump: false,
            attack: false,
            shield: false,
            join: false
        };

        if (inputType === 'keyboard_wasd') {
            if (this.keys['KeyA']) input.x = -1;
            if (this.keys['KeyD']) input.x = 1;
            if (this.keys['KeyW']) input.jump = true;
            if (this.keys['KeyS']) input.y = 1;
            if (this.keys['KeyQ']) input.attack = true;
            if (this.keys['KeyE'] || this.keys['ShiftLeft']) input.shield = true; // E or Shift for Shield
            if (this.keys['Space']) input.jump = true;
        } else if (inputType === 'keyboard_arrows') {
            if (this.keys['ArrowLeft']) input.x = -1;
            if (this.keys['ArrowRight']) input.x = 1;
            if (this.keys['ArrowUp']) input.jump = true;
            if (this.keys['ArrowDown']) input.y = 1;
            if (this.keys['Slash'] || this.keys['ShiftRight']) input.attack = true;
            if (this.keys['Period'] || this.keys['Comma'] || this.keys['Numpad0']) input.shield = true; // . or , or Numpad0 for Shield
            if (this.keys['ControlRight']) input.jump = true;
        } else if (inputType === 'universal' || inputType === 'online_primary') {
            // WASD
            if (this.keys['KeyA']) input.x = -1;
            if (this.keys['KeyD']) input.x = 1;
            if (this.keys['KeyW']) input.jump = true;
            if (this.keys['KeyS']) input.y = 1;
            if (this.keys['KeyQ']) input.attack = true;
            if (this.keys['KeyE'] || this.keys['ShiftLeft']) input.shield = true;
            if (this.keys['Space']) input.jump = true;
            
            // The universal solo layout supports both key sets. In a local
            // online party, the second seat owns arrows so they must not also
            // drive the primary seat.
            if (inputType === 'universal') {
                if (this.keys['ArrowLeft']) input.x = -1;
                if (this.keys['ArrowRight']) input.x = 1;
                if (this.keys['ArrowUp']) input.jump = true;
                if (this.keys['ArrowDown']) input.y = 1;
                if (this.keys['Slash'] || this.keys['ShiftRight']) input.attack = true;
                if (this.keys['Period'] || this.keys['Comma']) input.shield = true;
            }

            // Touch
            this.touchInput(input);
            if (this.touchState.buttons.crouch) input.y = 1;
            if (this.touchState.buttons.jump) input.jump = true;
            if (this.touchState.buttons.attack) input.attack = true;
            if (this.touchState.buttons.shield) input.shield = true;

            // Solo universal controls include controller 0. The local-party
            // touch seat leaves controllers to their own seat assignments.
            if (inputType === 'universal') {
                this.pollGamepads();
                const gp = this.gamepads[0];
                if (gp) {
                    if (Math.abs(gp.axes[0]) > 0.25) input.x = gp.axes[0];
                    if (this.padDown(0, 0)) input.jump = true;
                    if (this.padDown(0, 7) || this.padDown(0, 5)) input.attack = true;
                    if (this.padDown(0, 6) || this.padDown(0, 4)) input.shield = true;
                }
            }
        } else if (inputType.startsWith('gamepad')) {
            this.pollGamepads();
            const gpIndex = parseInt(inputType.split('_')[1]);
            const gp = this.gamepads[gpIndex];
            
            if (gp) {
                // Deadzone
                const deadzone = 0.1;
                
                // Left Stick (Move)
                if (Math.abs(gp.axes[0]) > deadzone) input.x = gp.axes[0];
                if (Math.abs(gp.axes[1]) > deadzone) input.y = gp.axes[1];

                // Right Stick (Look/Aim)
                if (Math.abs(gp.axes[2]) > deadzone) input.aimX = gp.axes[2];
                if (Math.abs(gp.axes[3]) > deadzone) input.aimY = gp.axes[3];

                // Buttons
                // Standard mapping: 0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=LT, 7=RT
                if (this.padDown(gpIndex, 0)) input.join = true; // A to join
                if (this.padDown(gpIndex, 0)) input.jump = true; // A to jump
                
                // Attack: RT (7) or RB (5)
                if (this.padDown(gpIndex, 7) || this.padDown(gpIndex, 5)) input.attack = true; 
                
                // Shield: LT (6) or LB (4)
                if (this.padDown(gpIndex, 6) || this.padDown(gpIndex, 4)) input.shield = true; 
            }
        } else if (inputType === 'touch') {
            this.touchInput(input);
            input.y = this.touchState.buttons.crouch ? 1 : 0;
            
            input.aimX = this.touchState.rightStick.x;
            input.aimY = this.touchState.rightStick.y;
            if (this.touchState.buttons.jump) input.jump = true;
            input.attack = this.touchState.buttons.attack;
            input.shield = this.touchState.buttons.shield;
        }

        return input;
    }
}
