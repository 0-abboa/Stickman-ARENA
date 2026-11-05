// Seasonal themes: the Halloween arena (haunted) only comes up from the 1st of October to the 5th
// of November, and the Christmas arena (xmas) from the 15th of November to the end of December.
// Outside their windows they are never picked. ?theme=<material> in the URL forces one theme
// (for previewing a season out of season).
(() => {
    const WINDOWS = { haunted: [[10, 1], [11, 5]], xmas: [[11, 15], [12, 31]] };
    const inWindow = (d, w) => {
        const md = (d.getMonth() + 1) * 100 + d.getDate(), s = w[0][0] * 100 + w[0][1], e = w[1][0] * 100 + w[1][1];
        return s <= e ? md >= s && md <= e : md >= s || md <= e;
    };
    if (!Level.MATERIALS.includes('xmas')) Level.MATERIALS.push('xmas');
    Level.SEASONS = WINDOWS;
    Level.inSeason = (m, d) => !WINDOWS[m] || inWindow(d || new Date(), WINDOWS[m]);
    let forced = null;
    try { const q = new URLSearchParams(location.search).get('theme'); if (q && Level.MATERIALS.includes(q)) forced = q; } catch (e) { /* no location (tests) */ }
    Level.forcedTheme = forced;
    // the themes a new level may use today
    Level.available = (d) => forced ? [forced] : Level.MATERIALS.filter(m => Level.inSeason(m, d));
})();
