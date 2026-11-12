// Seasonal themes only enter the arena pool during their holiday window.
// ?theme=<material> forces one material; ?testscene=1 cycles only holiday themes.
(() => {
    const HOLIDAY_THEMES = new Set([
        'haunted', 'xmas', 'newyear', 'chinesenewyear', 'childrensday', 'valentines', 'stpatricks', 'easter',
        'earthday', 'pride', 'juneteenth', 'independence', 'laborday',
        'diademuertos', 'thanksgiving', 'diwali', 'holi', 'eidfitr', 'eidaladha',
        'midautumn', 'dragonboat', 'carnival', 'festajunina', 'mexicanindependence',
        'lasposadas', 'pohelaboishakh', 'maslenitsa', 'pakistanindependence',
        'nigeriaindependence', 'indonesiaindependence', 'pongal', 'navratri',
        'brazilindependence', 'russiavictory', 'bangladeshvictory', 'indiarepublic',
        'indiaindependence', 'chinanationalday', 'pakistanday', 'indonesianyepi',
        'nigeriademocracy', 'bangladeshlanguage', 'russiaday', 'cincodemayo'
    ]);
    const WINDOWS = {
        haunted: [[10, 1], [11, 5]], xmas: [[12, 15], [12, 31]],
        newyear: [[12, 31], [1, 1]], childrensday: [[5, 25], [6, 1]], valentines: [[2, 14], [2, 14]], stpatricks: [[3, 17], [3, 17]],
        earthday: [[4, 22], [4, 22]], pride: [[6, 1], [6, 30]], juneteenth: [[6, 19], [6, 19]],
        independence: [[7, 4], [7, 4]], diademuertos: [[10, 31], [11, 2]],
        festajunina: [[6, 1], [6, 30]],
        mexicanindependence: [[9, 16], [9, 16]], lasposadas: [[12, 16], [12, 24]],
        pohelaboishakh: [[4, 14], [4, 14]], pakistanindependence: [[8, 14], [8, 14]],
        nigeriaindependence: [[10, 1], [10, 1]], indonesiaindependence: [[8, 17], [8, 17]],
        pongal: [[1, 13], [1, 16]], navratri: [[9, 20], [10, 20]],
        brazilindependence: [[9, 7], [9, 7]], russiavictory: [[5, 9], [5, 9]],
        bangladeshvictory: [[12, 16], [12, 16]], indiarepublic: [[1, 26], [1, 26]],
        indiaindependence: [[8, 15], [8, 15]], chinanationalday: [[10, 1], [10, 1]],
        pakistanday: [[3, 23], [3, 23]],
        nigeriademocracy: [[6, 12], [6, 12]], bangladeshlanguage: [[2, 21], [2, 21]],
        russiaday: [[6, 12], [6, 12]], cincodemayo: [[5, 5], [5, 5]]
    };
    const inWindow = (d, w) => {
        const md = (d.getMonth() + 1) * 100 + d.getDate(), s = w[0][0] * 100 + w[0][1], e = w[1][0] * 100 + w[1][1];
        return s <= e ? md >= s && md <= e : md >= s || md <= e;
    };
    const easterSunday = (year) => {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
        const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31), day = (h + l - 7 * m + 114) % 31 + 1;
        return new Date(Date.UTC(year, month - 1, day));
    };
    const dayStamp = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const calendarMonthDay = (d, calendar) => {
        try {
            const parts = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).formatToParts(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
            const month = Number.parseInt(parts.find(p => p.type === 'month')?.value || '', 10), day = Number(parts.find(p => p.type === 'day')?.value);
            return Number.isFinite(month) && Number.isFinite(day) ? { month, day } : null;
        } catch (e) { return null; }
    };
    const orthodoxEaster = (year) => {
        const a = year % 4, b = year % 7, c = year % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
        const month = Math.floor((d + e + 114) / 31), day = (d + e + 114) % 31 + 1;
        const julianGregorianOffset = year < 2100 ? 13 : 14;
        return new Date(Date.UTC(year, month - 1, day + julianGregorianOffset));
    };
    const RULES = {
        easter: (d) => dayStamp(d) === dayStamp(easterSunday(d.getFullYear())),
        laborday: (d) => {
            if (d.getMonth() !== 8) return false;
            const first = new Date(d.getFullYear(), 8, 1), firstMonday = 1 + ((8 - first.getDay()) % 7), monday = new Date(d.getFullYear(), 8, firstMonday);
            const delta = (dayStamp(d) - dayStamp(monday)) / 86400000;
            return delta === 0;
        },
        thanksgiving: (d) => {
            if (d.getMonth() !== 10) return false;
            const first = new Date(d.getFullYear(), 10, 1), firstThursday = 1 + ((4 - first.getDay() + 7) % 7), thursday = new Date(d.getFullYear(), 10, firstThursday + 21);
            const delta = (dayStamp(d) - dayStamp(thursday)) / 86400000;
            return delta === 0;
        },
        chinesenewyear: (d) => { const md = calendarMonthDay(d, 'chinese'); return !!md && md.month === 1 && md.day <= 15; },
        holi: (d) => { const md = calendarMonthDay(d, 'chinese'); return !!md && md.month === 2 && md.day === 15; },
        diwali: (d) => {
            // Diwali is the Kartika new moon; the Chinese lunisolar calendar's
            // new-moon day provides a compact browser-native approximation.
            const md = calendarMonthDay(d, 'chinese');
            return !!md && (md.month === 9 || md.month === 10) && md.day === 1 && d.getMonth() >= 9 && d.getMonth() <= 10;
        },
        // The lunar observances use the browser's built-in calendars, with broad
        // seasonal fallbacks for older engines that lack those calendars.
        eidfitr: (d) => { const md = calendarMonthDay(d, 'islamic-umalqura'); return !!md && md.month === 10 && md.day <= 3; },
        eidaladha: (d) => { const md = calendarMonthDay(d, 'islamic-umalqura'); return !!md && md.month === 12 && md.day >= 10 && md.day <= 13; },
        midautumn: (d) => { const md = calendarMonthDay(d, 'chinese'); return !!md && md.month === 8 && md.day === 15; },
        dragonboat: (d) => { const md = calendarMonthDay(d, 'chinese'); return !!md && md.month === 5 && md.day === 5; },
        carnival: (d) => {
            const delta = (dayStamp(d) - easterSunday(d.getFullYear()).getTime()) / 86400000;
            return delta >= -50 && delta <= -46;
        },
        maslenitsa: (d) => {
            const delta = (dayStamp(d) - dayStamp(orthodoxEaster(d.getFullYear()))) / 86400000;
            return delta >= -55 && delta <= -49;
        }
    };
    if (!Level.MATERIALS.includes('xmas')) Level.MATERIALS.push('xmas');
    Level.SEASONS = WINDOWS;
    Level.SEASON_RULES = RULES;
    Level.inSeason = (m, d) => {
        const date = d || new Date();
        return WINDOWS[m] ? inWindow(date, WINDOWS[m]) : RULES[m] ? RULES[m](date) : true;
    };
    let forced = null, testScene = false;
    try {
        const q = new URLSearchParams(location.search);
        testScene = q.get('testscene') === '1';
        const theme = q.get('theme');
        if (!testScene && theme && Level.MATERIALS.includes(theme)) forced = theme;
    } catch (e) { /* no location (tests) */ }
    Level.forcedTheme = forced;
    Level.testScene = testScene;
    // the themes a new level may use today
    Level.available = (d) => testScene
        ? Level.MATERIALS.filter(m => HOLIDAY_THEMES.has(m))
        : forced ? [forced] : Level.MATERIALS.filter(m => Level.inSeason(m, d));
})();
