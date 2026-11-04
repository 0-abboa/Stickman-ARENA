// AI fighter. It is a regular Player body driven by a virtual controller: the
// brain (bot-mind.js + bot-reads.js + bot-tactics.js + bot-motor.js) decides
// what to press, and Player.applyInput applies it with exactly the rules a human
// gets. No extra speed, damage, jumps or flight; only decisions.
// Its colour comes from its difficulty (green BEGINNING, orange INTERMEDIATE,
// red ADVANCED, purple PROFESSIONAL, cyan HACK), with a different shade per bot.
class Bot extends Player {
    constructor(id, x, y, difficulty, shade) {
        const prof = BOT_PROFILES[difficulty] || BOT_PROFILES.medium;
        const n = prof.shades.length;
        super(id, x, y, prof.shades[((shade === undefined ? id : shade) % n + n) % n], 'bot');
        this.difficulty = BOT_PROFILES[difficulty] ? difficulty : 'medium';
        this.isBot = true;
        this.brain = new BotBrain(this, this.difficulty);
        this.aiInput = null;
    }

    update(game) {
        if (!this.isDead) this.aiInput = this.brain.think(game);
        super.update(game);
    }

    readInput() {
        return this.aiInput || BotBrain.IDLE;
    }
}
