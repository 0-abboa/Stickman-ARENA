// Phones and tablets: real touch detection (so a laptop with a touch screen still gets keyboard
// play and no on-screen sticks), a "turn your phone" hint while playing upright, and the How to Play
// panel (the key list is left out on touch screens).
(() => {
    // Orbitron is used on canvas text too: start loading it now so the first frames already use it
    if (document.fonts && document.fonts.load) { for (const w of [400, 700, 900]) document.fonts.load(w + ' 16px Orbitron').catch(() => {}); }
    // The PRIMARY pointer decides: a coarse one (finger) means a touch device; a mouse or trackpad does not,
    // even when the machine also has a touch screen.
    const mq = window.matchMedia ? (q) => window.matchMedia(q).matches : () => false;
    const detect = () => {
        const ua = navigator.userAgent || '';
        const phoneUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Opera Mini/i.test(ua);
        const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        const coarse = mq('(pointer: coarse)') && !mq('(any-pointer: fine) and (hover: hover)');
        return coarse || phoneUA || iPadOS;
    };
    let cached = detect();
    const HOWTO_SEEN_KEY = 'sa-howto-seen';
    const hasSeenHowto = () => {
        try { if (localStorage.getItem(HOWTO_SEEN_KEY) === '1') return true; } catch (e) { /* try other storage */ }
        try {
            if (document.cookie.split(';').some((part) => part.trim() === HOWTO_SEEN_KEY + '=1')) return true;
        } catch (e) { /* try session storage */ }
        try { return sessionStorage.getItem(HOWTO_SEEN_KEY) === '1'; } catch (e) { return false; }
    };
    const rememberHowtoSeen = () => {
        try { localStorage.setItem(HOWTO_SEEN_KEY, '1'); } catch (e) { /* try other storage */ }
        try {
            document.cookie = HOWTO_SEEN_KEY + '=1; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
        } catch (e) { /* try session storage */ }
        try { sessionStorage.setItem(HOWTO_SEEN_KEY, '1'); } catch (e) { /* storage may be unavailable */ }
    };
    Game.prototype.isTouchDevice = function () { return cached; };
    const apply = () => {
        cached = detect();
        document.documentElement.classList.toggle('is-touch', cached);
        document.documentElement.classList.toggle('is-desktop', !cached);
        if (!cached) {   // never leave touch UI up on a desktop
            for (const id of ['mobile-controls', 'lobby-touch']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
            if (window.game && window.game.inputManager) { if (window.game.inputManager.releaseTouch) window.game.inputManager.releaseTouch(); window.game.inputManager.releaseAll && window.game.inputManager.releaseAll(); }
        }
        update();
    };
    if (window.matchMedia) { try { window.matchMedia('(pointer: coarse)').addEventListener('change', apply); } catch (e) { /* old Safari */ } }

    // ---- full-screen height that follows the phone's browser bars ----
    const vh = () => { document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); };

    // ---- rotate hint: upright phone while a match is on ----
    const hint = () => document.getElementById('rotate-hint');
    let dismissed = false;
    function update() {
        vh();
        const h = hint(), g = window.game;
        if (!h) return;
        const portrait = window.innerHeight > window.innerWidth * 1.05;
        const playing = g && (g.state === 'PLAYING' || g.state === 'LOBBY' || g.state === 'PAUSED') && !g.demo;
        h.style.display = cached && portrait && playing && !dismissed ? 'flex' : 'none';
        if (!portrait) dismissed = false;
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', () => setTimeout(() => { update(); if (window.game) window.game.resize(); }, 250));
    setInterval(update, 700);

    // ---- How to play ----
    const KEY = (k) => `<kbd>${k}</kbd>`;
    const section = (title, body) => `<section><h3>${title}</h3>${body}</section>`;
    function content(touch) {
        const goal = section('The goal',
            `<p>Knock out your rivals. In <b>Solo</b> you fight three rivals and the first fighter to <b>10 knockouts</b> wins the match. In <b>Doubles</b> two teammates (you and an ally) face three teams of two, and the first team to <b>20 combined knockouts</b> wins.</p>
             <p>Each round ends when only one fighter (or team) is left standing. The round winner wears the crown.</p>`);
        const how = section('Knockouts',
            `<ul>
               <li>Everyone starts with <b>100 health</b>. Hits take it down; at zero you are out for the round.</li>
               <li>Hits also <b>knock you back</b>. If you are sent off the edge of the arena, or into a pit, you are out at once, whatever your health. Heavy hits near an edge are deadly, so mind where you stand.</li>
               <li>The bar above each fighter shows their health.</li>
             </ul>`);
        const move = section('Moving around',
            `<ul>
               <li>Run, <b>jump</b>, and jump again in the air for a <b>double jump</b>.</li>
               <li><b>Crouch</b> to duck low. Crouching also cancels knockback, which can save you at an edge.</li>
               <li><b>Bouncers</b> (springy mats) launch you high; stronger orange pads launch you much higher.</li>
               <li>Some platforms <b>move</b>. Wait for the ride, but watch out for being squeezed against the edge.</li>
               <li>On icy arenas, punches and blasts can <b>shatter</b> thin platforms.</li>
             </ul>`);
        const fight = section('Fighting',
            `<ul>
               <li>With empty hands you <b>punch</b>. Pick up a weapon to hit harder or from further away.</li>
               <li>Weapons <b>drop from the sky</b> every few seconds. Walk over one to take it; ${touch ? 'hold Crouch while standing on one' : 'press ' + KEY('S') + ' while standing on one'} to <b>swap</b> for what is lying there.</li>
               <li>Weapons <b>wear out</b> and break after enough use, so use them while you have them.</li>
               <li>Your <b>shield</b> blocks most damage, but it only lasts about a second, then it needs a couple of seconds to recharge. Time it.</li>
               <li>After a swing there is a short cooldown. Heavy weapons hit hardest but recover slowest.</li>
             </ul>`);
        const traps = section('Healing and traps',
            `<ul>
               <li>A <b>campfire</b> (or a hot spring, glowing coral or a cup of cocoa) <b>heals you</b> while you stand next to it. Step out of the fight, heal, then go back.</li>
               <li>Every arena has <b>traps</b>: spikes, flames, presses, falling blocks, swinging blades and more. Each one <b>warns you first</b> with dust, sparks, flashing lights or a shaking floor, so leave the spot when you see the warning.</li>
               <li>Very rarely a <b>Tear of God</b> falls. It has one shot: after half a second of charging, when you cannot move, it flies through walls and knocks out the first fighter it hits.</li>
             </ul>`);
        const crystal = section('Every fifth round',
            `<p>A glowing <b>Angel Crystal</b> drifts down the middle of the arena. Whoever grabs it becomes a flying, nearly unstoppable <b>angel</b> with extra health, and everyone else is protected by an automatic shield for as long as the angel lives. A <b>Nimbus Staff</b> is the answer: it lets you fly and fire a laser at the angel. Take it.</p>`);
        const controls = touch
            ? section('Touch controls',
                `<ul>
               <li><b>Move:</b> touch and drag anywhere on the <b>left half</b> of the screen. A stick appears under your thumb. Push it <b>up</b> to jump; downward stick movement only steers left or right and never makes you crouch.</li>
               <li>On the right, <b>Shield</b> and <b>Attack</b> are the two small buttons. The large <b>Lie Down</b> button ducks low; hold it while standing over a weapon to swap. The large <b>Jump</b> button also works for a double jump.</li>
               <li>The small pause icon just below the player stat cards pauses the game and lets you leave.</li>
                   <li>Doubles on a phone: you control one fighter and your ally plays alongside you.</li>
                   <li>Hold the phone sideways for the best view.</li>
                 </ul>`)
            : section('Keyboard',
                `<div class="keys">
                   <div><h4>Player 1</h4>
                     <p>${KEY('A')} ${KEY('D')} move</p><p>${KEY('W')} or ${KEY('Space')} jump (twice for a double jump)</p><p>${KEY('S')} crouch / swap weapon</p><p>${KEY('Q')} attack</p><p>${KEY('E')} or ${KEY('Shift')} shield</p></div>
                   <div><h4>Player 2 (Doubles)</h4>
                     <p>${KEY('←')} ${KEY('→')} move</p><p>${KEY('↑')} jump</p><p>${KEY('↓')} crouch / swap weapon</p><p>${KEY('/')} attack</p><p>${KEY('.')} shield</p></div>
                 </div>
                 <p>In Solo you can use either set. ${KEY('Esc')} pauses the game and lets you leave.</p>`)
              + section('Controller',
                `<p>${KEY('Left stick')} move · ${KEY('A')} jump · ${KEY('RT')} or ${KEY('RB')} attack · ${KEY('LT')} or ${KEY('LB')} shield · ${KEY('B')} pause or leave a lobby.</p>`);
        const party = section('Controller Party',
            `<p>A local party for up to <b>10 fighters</b> on one screen. ${touch ? 'Tap <b>JOIN</b> to add yourself, <b>+ FIGHTER</b> to fill another seat, and <b>START</b> when at least two fighters are in.' : `Each person presses ${KEY('Enter')}, or ${KEY('A')} on their controller, to join. Add fighters to fill empty seats, then ${KEY('Enter')} or ${KEY('Start')} to begin.`} The pause screen stops the game for everyone in this mode.</p>`);
        const skill = section('Match skill',
            `<p>Pick the difficulty on the main menu, from <b>Beginning</b> up to <b>Professional</b> and <b>Hack</b>. Higher levels dodge, block and fight smarter.</p>`);
        const tips = section('Tips',
            `<ul>
               <li>Stay on solid ground when you are low on health: a knockback off the edge ends the round.</li>
               <li>Block (shield) a big hit, then punish the moment the other fighter swings and misses.</li>
               <li>Grab a weapon early, and watch where new ones fall.</li>
               <li>In Doubles, stay near your ally so no one gets mobbed.</li>
             </ul>`);
        return goal + how + move + fight + traps + crystal + controls + party + skill + tips;
    }

    function setup() {
        const body = document.getElementById('howto-body'), panel = document.getElementById('howto');
        if (!body || !panel) return;
        const open = () => {
            if (window.HowToVisual) HowToVisual.build(body, cached); else body.innerHTML = content(cached);
            const dn = document.getElementById('howto-done'); if (dn && !window.HowToVisual) dn.textContent = 'GOT IT';
            body.scrollTop = 0;
            panel.style.display = 'flex';
            panel.classList.remove('closing'); void panel.offsetWidth; panel.classList.add('opening');
            document.getElementById('howto-done').focus({ preventScroll: true });
        };
        const close = () => {
            panel.classList.remove('opening'); panel.classList.add('closing');
            setTimeout(() => { if (panel.classList.contains('closing')) { panel.style.display = 'none'; if (window.HowToVisual) HowToVisual.stop(); } }, 180);
        };
        document.getElementById('btn-howto').addEventListener('click', open);
        document.getElementById('howto-close').addEventListener('click', close);
        document.getElementById('howto-done').addEventListener('click', () => { if (window.HowToVisual && HowToVisual.advance()) return; close(); });
        panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
        window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && panel.style.display !== 'none') { close(); e.stopImmediatePropagation(); } }, true);
        // First visit only. Mirror the flag to a first-party cookie and session storage so a
        // browser profile that clears localStorage between loads does not reopen the tutorial.
        // The cover page is an unattended demo, not a player visit.
        const isCoverPage = /(?:^|\/)cover\.html$/i.test(location.pathname);
        if (!isCoverPage && !hasSeenHowto()) {
            rememberHowtoSeen();
            setTimeout(() => { const g = window.game; if (!g || g.state === 'MENU') open(); }, 700);
        }
        const rot = document.getElementById('rotate-hint');
        if (rot) rot.addEventListener('click', () => { dismissed = true; update(); });
        // keep the game from scrolling or zooming under a finger
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.howto-body, select')) e.preventDefault(); }, { passive: false });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { setup(); apply(); });
    else { setup(); apply(); }
})();
