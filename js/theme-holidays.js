// Annual holiday arenas with layered scenery, particle motion, custom
// platform materials and color grades. Date windows and automatic selection
// live in seasons.js; ?theme=<id> remains available for previewing any season.
// Country coverage focuses on major national days and widely celebrated cultural festivals;
// local and regional observances vary too much to imply a complete national calendar.
(() => {
    const L = BackdropLayers, D = L.DECO;
    const specs = {
        newyear: {
            label: 'New Year', base: 'stone', motif: 'starburst',
            deep: '#101c42', mid: '#244d7d', horizon: '#ce637f', light: '#ffe2a4', haze: '255,192,155',
            accent: '#ffd66e', accentRgb: '255,214,110', shadow: '#332743', particles: [{ kind: 'sparkle', n: [30, 20], rgb: '255,220,140' }, { kind: 'mote', n: [18, 10], rgb: '255,170,190', rise: -0.04 }], shooting: true
        },
        chinesenewyear: {
            label: 'Chinese New Year', base: 'stone', motif: 'lantern',
            deep: '#260811', mid: '#7d1830', horizon: '#df5546', light: '#ffe3a0', haze: '255,181,122',
            accent: '#ffd36b', accentRgb: '255,211,107', shadow: '#35101b',
            particles: [{ kind: 'petal', n: [26, 18], cols: ['#ffb3a7', '#ffd36b', '#f37b78', '#ffe8c0'] }, { kind: 'sparkle', n: [22, 14], rgb: '255,210,112' }, { kind: 'ember', n: [8, 5], rgb: '255,118,70' }], shooting: true
        },
        childrensday: {
            label: "Children's Day", base: 'candy', motif: 'kite',
            deep: '#183c70', mid: '#3889b9', horizon: '#f08d83', light: '#ffe9a8', haze: '255,190,164',
            accent: '#ffd15c', accentRgb: '255,209,92', shadow: '#273458',
            particles: [{ kind: 'petal', n: [38, 26], cols: ['#ff6580', '#ffc84f', '#64d5c1', '#9a83f6', '#77b9ff'] }, { kind: 'sparkle', n: [24, 16], rgb: '255,238,174' }]
        },
        valentines: {
            label: "Valentine's Day", base: 'candy', motif: 'heart',
            deep: '#3d173d', mid: '#8d315d', horizon: '#ec7690', light: '#ffd1c7', haze: '255,180,190',
            accent: '#ff7699', accentRgb: '255,118,153', shadow: '#34172e', particles: [{ kind: 'petal', n: [34, 22], cols: ['#ff9db4', '#ffd0dc', '#e78eb5', '#fff0ea'] }, { kind: 'sparkle', n: [12, 8], rgb: '255,210,220' }]
        },
        stpatricks: {
            label: "St. Patrick's Day", base: 'dirt', motif: 'shamrock',
            deep: '#082e2a', mid: '#137058', horizon: '#6da866', light: '#f6d67a', haze: '174,220,154',
            accent: '#83e08f', accentRgb: '131,224,143', shadow: '#102b26', particles: [{ kind: 'firefly', n: [28, 18], rgb: '190,255,130' }, { kind: 'sparkle', n: [12, 8], rgb: '255,218,117' }]
        },
        easter: {
            label: 'Easter', base: 'dirt', motif: 'egg',
            deep: '#27366b', mid: '#7165a0', horizon: '#e69b9d', light: '#ffe4b1', haze: '255,208,180',
            accent: '#ffc66c', accentRgb: '255,198,108', shadow: '#392a49', particles: [{ kind: 'petal', n: [32, 20], cols: ['#f7a9bd', '#ffda7e', '#b7d7a8', '#c4b4f2'] }, { kind: 'sparkle', n: [12, 8], rgb: '255,236,174' }]
        },
        earthday: {
            label: 'Earth Day', base: 'dirt', motif: 'globe',
            deep: '#072e41', mid: '#17666b', horizon: '#74ad77', light: '#d8d992', haze: '148,208,154',
            accent: '#73df9a', accentRgb: '115,223,154', shadow: '#102d32', particles: [{ kind: 'leaf', n: [28, 18], cols: ['#82c85c', '#b1dc72', '#4c9f68'] }, { kind: 'firefly', n: [20, 12], rgb: '203,255,155' }]
        },
        pride: {
            label: 'Pride', base: 'magic', motif: 'rainbow',
            deep: '#23134e', mid: '#643b87', horizon: '#ce6090', light: '#ffd28e', haze: '211,155,223',
            accent: '#dca5ff', accentRgb: '220,165,255', shadow: '#251a3c', particles: [{ kind: 'sparkle', n: [28, 18], rgb: '255,220,160' }, { kind: 'petal', n: [20, 14], cols: ['#ff7d89', '#ffc56e', '#ffe975', '#78dfa2', '#76c8ff', '#c79cff'] }]
        },
        juneteenth: {
            label: 'Juneteenth', base: 'stone', motif: 'jubileeStar',
            deep: '#171c43', mid: '#394e78', horizon: '#ad554d', light: '#f2c16c', haze: '234,164,110',
            accent: '#f3c36b', accentRgb: '243,195,107', shadow: '#30233e', particles: [{ kind: 'sparkle', n: [26, 18], rgb: '255,206,115' }, { kind: 'ember', n: [14, 10], rgb: '244,116,82' }], shooting: true
        },
        independence: {
            label: 'Independence Day', base: 'stone', motif: 'fireworkStar',
            deep: '#101c42', mid: '#254c7f', horizon: '#bf536a', light: '#ffd892', haze: '231,168,167',
            accent: '#ffdf9b', accentRgb: '255,223,155', shadow: '#1f2947', particles: [{ kind: 'sparkle', n: [32, 20], rgb: '255,230,170' }, { kind: 'mote', n: [18, 12], rgb: '175,216,255', rise: -0.06 }], shooting: true
        },
        laborday: {
            label: 'Labor Day', base: 'dirt', motif: 'wheat',
            deep: '#2a2346', mid: '#8a4f55', horizon: '#e88c56', light: '#ffe1a0', haze: '245,177,115',
            accent: '#f4c76d', accentRgb: '244,199,109', shadow: '#392537', particles: [{ kind: 'leaf', n: [24, 16], cols: ['#d0783d', '#e5a44e', '#a95836'] }, { kind: 'mote', n: [18, 10], rgb: '255,215,145', rise: -0.04 }]
        },
        diademuertos: {
            label: 'Día de Muertos', base: 'haunted', motif: 'marigold',
            deep: '#211747', mid: '#663b75', horizon: '#cc6957', light: '#ffd38b', haze: '255,171,112',
            accent: '#ffad57', accentRgb: '255,173,87', shadow: '#21182d', particles: [{ kind: 'petal', n: [32, 20], cols: ['#ff9a43', '#ffd052', '#e65373', '#f3a4bd'] }, { kind: 'firefly', n: [16, 10], rgb: '255,210,116' }]
        },
        thanksgiving: {
            label: 'Thanksgiving', base: 'dirt', motif: 'harvest',
            deep: '#30213b', mid: '#815041', horizon: '#db8750', light: '#ffdc97', haze: '242,176,112',
            accent: '#e7a84e', accentRgb: '231,168,78', shadow: '#34202a', particles: [{ kind: 'leaf', n: [34, 22], cols: ['#c75332', '#e58b35', '#e4b943', '#925032'] }, { kind: 'ember', n: [12, 8], rgb: '255,168,74' }]
        },
        diwali: {
            label: 'Diwali', base: 'magic', motif: 'diya',
            deep: '#17113d', mid: '#5a2870', horizon: '#d05d55', light: '#ffe2a0', haze: '255,174,106',
            accent: '#ffca58', accentRgb: '255,202,88', shadow: '#291735', particles: [{ kind: 'sparkle', n: [32, 22], rgb: '255,222,143' }, { kind: 'ember', n: [16, 10], rgb: '255,124,54' }, { kind: 'petal', n: [12, 8], cols: ['#e98f48', '#e85f6a', '#ffd36b'] }], shooting: true
        },
        holi: {
            label: 'Holi', base: 'candy', motif: 'powder',
            deep: '#30205e', mid: '#a33d82', horizon: '#ed875f', light: '#ffe3a5', haze: '242,161,189',
            accent: '#ffca60', accentRgb: '255,202,96', shadow: '#382141', particles: [{ kind: 'petal', n: [34, 24], cols: ['#ff5a74', '#ffc247', '#47d5c6', '#a877ff', '#6fb8ff'] }, { kind: 'sparkle', n: [18, 12], rgb: '255,238,168' }]
        },
        eidfitr: {
            label: 'Eid al-Fitr', base: 'magic', motif: 'crescent',
            deep: '#082b3b', mid: '#14736d', horizon: '#62b79b', light: '#ffe6a4', haze: '150,229,195',
            accent: '#f6d477', accentRgb: '246,212,119', shadow: '#102b35', particles: [{ kind: 'sparkle', n: [28, 20], rgb: '255,229,154' }, { kind: 'mote', n: [24, 14], rgb: '171,239,218', rise: -0.04 }]
        },
        eidaladha: {
            label: 'Eid al-Adha', base: 'stone', motif: 'crescent',
            deep: '#112a34', mid: '#386d58', horizon: '#a58b56', light: '#f8df9b', haze: '197,206,145',
            accent: '#e6c66e', accentRgb: '230,198,110', shadow: '#202a2b', particles: [{ kind: 'sparkle', n: [22, 16], rgb: '255,226,153' }, { kind: 'firefly', n: [24, 16], rgb: '209,244,161' }]
        },
        midautumn: {
            label: 'Mid-Autumn Festival', base: 'stone', motif: 'moonrabbit',
            deep: '#111c45', mid: '#364c83', horizon: '#c36f70', light: '#ffe2ab', haze: '255,199,145',
            accent: '#ffd27d', accentRgb: '255,210,125', shadow: '#222340', particles: [{ kind: 'sparkle', n: [26, 18], rgb: '255,231,181' }, { kind: 'petal', n: [18, 12], cols: ['#ffd18a', '#ed9b71', '#f4d9a8'] }]
        },
        dragonboat: {
            label: 'Dragon Boat Festival', base: 'dirt', motif: 'dragonboat',
            deep: '#0d283e', mid: '#176e73', horizon: '#66b9a0', light: '#ffe3a1', haze: '126,211,187',
            accent: '#e5c75e', accentRgb: '229,199,94', shadow: '#142c32', particles: [{ kind: 'mote', n: [28, 18], rgb: '167,239,218', rise: -0.035 }, { kind: 'petal', n: [18, 12], cols: ['#f3d66f', '#f4a76f', '#7bd1b4'] }]
        },
        carnival: {
            label: 'Brazilian Carnival', base: 'candy', motif: 'carnivalmask',
            deep: '#21114b', mid: '#743391', horizon: '#e75d8a', light: '#ffd36e', haze: '219,123,209',
            accent: '#5ce0c2', accentRgb: '92,224,194', shadow: '#2c1741', particles: [{ kind: 'petal', n: [38, 26], cols: ['#ff4f80', '#ffc648', '#55d8c0', '#9280ff', '#ff9459'] }, { kind: 'sparkle', n: [18, 12], rgb: '255,227,125' }], shooting: true
        },
        festajunina: {
            label: 'Festa Junina', base: 'dirt', motif: 'bunting',
            deep: '#263653', mid: '#8e5d50', horizon: '#ec985d', light: '#ffdfa0', haze: '246,183,111',
            accent: '#f5c45e', accentRgb: '245,196,94', shadow: '#382a31', particles: [{ kind: 'ember', n: [16, 10], rgb: '255,153,67' }, { kind: 'mote', n: [24, 16], rgb: '255,221,146', rise: -0.05 }]
        },
        mexicanindependence: {
            label: 'Mexican Independence Day', base: 'stone', motif: 'firework',
            deep: '#102940', mid: '#16705a', horizon: '#d17857', light: '#ffe29c', haze: '215,175,111',
            accent: '#f1d15f', accentRgb: '241,209,95', shadow: '#1d3033', particles: [{ kind: 'sparkle', n: [30, 20], rgb: '255,231,151' }, { kind: 'mote', n: [20, 14], rgb: '173,230,190', rise: -0.04 }], shooting: true
        },
        lasposadas: {
            label: 'Las Posadas', base: 'haunted', motif: 'pinata',
            deep: '#17214c', mid: '#61437d', horizon: '#d66c64', light: '#ffe3a6', haze: '248,174,125',
            accent: '#f7c766', accentRgb: '247,199,102', shadow: '#28223d', particles: [{ kind: 'sparkle', n: [24, 16], rgb: '255,225,149' }, { kind: 'ember', n: [12, 8], rgb: '255,132,82' }, { kind: 'petal', n: [18, 12], cols: ['#e55d62', '#f2c95c', '#69c793'] }]
        },
        pohelaboishakh: {
            label: 'Pohela Boishakh', base: 'candy', motif: 'sunfan',
            deep: '#29204d', mid: '#9d465e', horizon: '#e98d5d', light: '#ffe3a3', haze: '244,180,131',
            accent: '#e95e54', accentRgb: '233,94,84', shadow: '#382536', particles: [{ kind: 'petal', n: [28, 18], cols: ['#fff0d0', '#ef7162', '#73b89a', '#f2c76d'] }, { kind: 'sparkle', n: [16, 10], rgb: '255,230,166' }]
        },
        maslenitsa: {
            label: 'Maslenitsa', base: 'snow', motif: 'sunwheel',
            deep: '#223451', mid: '#647b9b', horizon: '#d99583', light: '#ffe5ae', haze: '218,206,200',
            accent: '#ffd05e', accentRgb: '255,208,94', shadow: '#27303f', particles: [{ kind: 'snow', n: [30, 20], rgb: '255,255,255' }, { kind: 'sparkle', n: [14, 10], rgb: '255,222,137' }]
        },
        pakistanindependence: {
            label: 'Pakistan Independence Day', base: 'magic', motif: 'crescent',
            deep: '#082c2a', mid: '#147956', horizon: '#65b38c', light: '#f5e9bb', haze: '157,218,176',
            accent: '#e8e8d1', accentRgb: '232,232,209', shadow: '#122c2a', particles: [{ kind: 'sparkle', n: [24, 16], rgb: '237,245,211' }, { kind: 'firefly', n: [25, 17], rgb: '165,244,183' }], shooting: true
        },
        nigeriaindependence: {
            label: 'Nigerian Independence Day', base: 'dirt', motif: 'sunfan',
            deep: '#102d2a', mid: '#29784f', horizon: '#b6a66a', light: '#f6e7a6', haze: '171,213,141',
            accent: '#dceaa1', accentRgb: '220,234,161', shadow: '#1b3129', particles: [{ kind: 'firefly', n: [28, 18], rgb: '213,247,149' }, { kind: 'sparkle', n: [14, 10], rgb: '255,232,148' }]
        },
        indonesiaindependence: {
            label: 'Indonesian Independence Day', base: 'stone', motif: 'firework',
            deep: '#3a1029', mid: '#a3314c', horizon: '#e47762', light: '#ffe1a1', haze: '245,169,128',
            accent: '#f5d374', accentRgb: '245,211,116', shadow: '#3c202d', particles: [{ kind: 'ember', n: [14, 9], rgb: '255,137,77' }, { kind: 'sparkle', n: [26, 18], rgb: '255,231,159' }], shooting: true
        },
        pongal: {
            label: 'Pongal', base: 'dirt', motif: 'harvest',
            deep: '#285044', mid: '#8d704b', horizon: '#e2934f', light: '#ffe5a2', haze: '242,190,117',
            accent: '#efc45c', accentRgb: '239,196,92', shadow: '#37352b', particles: [{ kind: 'sparkle', n: [18, 12], rgb: '255,230,155' }, { kind: 'mote', n: [22, 14], rgb: '255,203,115', rise: -0.04 }]
        },
        navratri: {
            label: 'Navratri', base: 'magic', motif: 'sunwheel',
            deep: '#31133f', mid: '#8d315c', horizon: '#e57b58', light: '#ffdc8d', haze: '240,154,133',
            accent: '#f4bf55', accentRgb: '244,191,85', shadow: '#321c32', particles: [{ kind: 'petal', n: [28, 18], cols: ['#e84b56', '#f5be4d', '#55a77b', '#9362b2'] }, { kind: 'sparkle', n: [17, 11], rgb: '255,226,148' }]
        },
        brazilindependence: {
            label: 'Brazil Independence Day', base: 'stone', motif: 'firework',
            deep: '#103d37', mid: '#28815e', horizon: '#80b56a', light: '#f7dc83', haze: '171,213,135',
            accent: '#f0d35e', accentRgb: '240,211,94', shadow: '#18372e', particles: [{ kind: 'sparkle', n: [25, 17], rgb: '255,230,133' }, { kind: 'firefly', n: [20, 13], rgb: '179,244,157' }], shooting: true
        },
        russiavictory: {
            label: 'Victory Day', base: 'stone', motif: 'firework',
            deep: '#1d2544', mid: '#4a5f7e', horizon: '#c77d68', light: '#ffe0a2', haze: '222,174,137',
            accent: '#e7be66', accentRgb: '231,190,102', shadow: '#29283a', particles: [{ kind: 'sparkle', n: [27, 18], rgb: '255,225,143' }, { kind: 'ember', n: [12, 8], rgb: '235,99,75' }], shooting: true
        },
        bangladeshvictory: {
            label: 'Victory Day of Bangladesh', base: 'dirt', motif: 'jubileeStar',
            deep: '#0b332d', mid: '#176e54', horizon: '#7eaa67', light: '#f1df9c', haze: '173,213,146',
            accent: '#e76153', accentRgb: '231,97,83', shadow: '#18352d', particles: [{ kind: 'sparkle', n: [20, 14], rgb: '255,224,148' }, { kind: 'firefly', n: [23, 15], rgb: '190,239,154' }]
        },
        indiarepublic: {
            label: 'India Republic Day', base: 'stone', motif: 'firework',
            deep: '#18344c', mid: '#28765f', horizon: '#d9865a', light: '#ffe5a2', haze: '225,182,120',
            accent: '#f1c85e', accentRgb: '241,200,94', shadow: '#20343b', particles: [{ kind: 'sparkle', n: [25, 17], rgb: '255,230,156' }, { kind: 'petal', n: [18, 12], cols: ['#ee8c43', '#f5efe0', '#54a778'] }], shooting: true
        },
        indiaindependence: {
            label: 'India Independence Day', base: 'dirt', motif: 'firework',
            deep: '#18354b', mid: '#28755d', horizon: '#d78959', light: '#ffe2a0', haze: '222,178,117',
            accent: '#efb851', accentRgb: '239,184,81', shadow: '#23352e', particles: [{ kind: 'mote', n: [20, 14], rgb: '244,239,219', rise: -0.05 }, { kind: 'sparkle', n: [25, 16], rgb: '255,225,140' }], shooting: true
        },
        chinanationalday: {
            label: 'China National Day', base: 'stone', motif: 'fiveStars',
            deep: '#28070d', mid: '#841521', horizon: '#e65537', light: '#ffe9a6', haze: '255,161,91',
            accent: '#ffd23f', accentRgb: '255,210,63', shadow: '#321019', particles: [{ kind: 'sparkle', n: [34, 22], rgb: '255,231,151' }, { kind: 'ember', n: [20, 13], rgb: '255,103,44' }], shooting: true, fireworks: true
        },
        pakistanday: {
            label: 'Pakistan Day', base: 'magic', motif: 'crescent',
            deep: '#07312f', mid: '#187458', horizon: '#68ad84', light: '#f3e6b0', haze: '155,216,177',
            accent: '#e7e9d5', accentRgb: '231,233,213', shadow: '#16312e', particles: [{ kind: 'sparkle', n: [20, 14], rgb: '244,244,220' }, { kind: 'firefly', n: [25, 16], rgb: '160,239,179' }]
        },
        indonesianyepi: {
            label: 'Nyepi', base: 'magic', motif: 'starburst',
            deep: '#101c38', mid: '#344d6c', horizon: '#947b78', light: '#ead8ae', haze: '173,174,173',
            accent: '#e3c688', accentRgb: '227,198,136', shadow: '#1c2634', particles: [{ kind: 'mote', n: [22, 14], rgb: '221,211,176', rise: -0.025 }, { kind: 'sparkle', n: [15, 10], rgb: '241,221,165' }]
        },
        nigeriademocracy: {
            label: 'Nigeria Democracy Day', base: 'dirt', motif: 'jubileeStar',
            deep: '#10372d', mid: '#28794c', horizon: '#9bad67', light: '#f4e4a3', haze: '173,216,143',
            accent: '#e5e7a9', accentRgb: '229,231,169', shadow: '#1b3329', particles: [{ kind: 'firefly', n: [24, 16], rgb: '196,239,149' }, { kind: 'sparkle', n: [16, 10], rgb: '255,230,153' }]
        },
        bangladeshlanguage: {
            label: 'Language Martyrs’ Day', base: 'stone', motif: 'marigold',
            deep: '#102f2e', mid: '#1b6b55', horizon: '#a64d52', light: '#f3df9e', haze: '195,172,137',
            accent: '#e75b52', accentRgb: '231,91,82', shadow: '#20312b', particles: [{ kind: 'petal', n: [23, 15], cols: ['#e95551', '#fff0d4', '#e0bf61'] }, { kind: 'sparkle', n: [14, 9], rgb: '255,230,159' }]
        },
        russiaday: {
            label: 'Russia Day', base: 'stone', motif: 'firework',
            deep: '#192543', mid: '#466386', horizon: '#b97172', light: '#ffdfa1', haze: '212,169,153',
            accent: '#e7c56e', accentRgb: '231,197,110', shadow: '#272c3c', particles: [{ kind: 'sparkle', n: [24, 16], rgb: '255,229,151' }, { kind: 'mote', n: [18, 12], rgb: '210,226,248', rise: -0.04 }], shooting: true
        },
        cincodemayo: {
            label: 'Cinco de Mayo', base: 'candy', motif: 'pinata',
            deep: '#203452', mid: '#4d8c71', horizon: '#e08a61', light: '#ffe1a0', haze: '237,176,123',
            accent: '#f2c34f', accentRgb: '242,195,79', shadow: '#2c3034', particles: [{ kind: 'petal', n: [28, 19], cols: ['#e94f57', '#f4c34e', '#58ae78', '#678ed4'] }, { kind: 'sparkle', n: [14, 9], rgb: '255,230,155' }]
        }
    };
    const ids = Object.keys(specs);

    // Small, readable story scenes make each seasonal material feel like its
    // own holiday. These recipes are only read by that holiday's variants.
    const festivalScenes = {
        newyear: { landmark: 'spireTower', colors: ['#273b67', '#ffd66e'], second: 'holidayBurst' },
        chinesenewyear: { landmark: 'temple', colors: ['#a8202d', '#ffd36b'], second: 'holidayBurst' },
        valentines: { landmark: 'candyCastle', colors: ['#6d2c58', '#ff9bb8'], second: 'holidayMarigold' },
        stpatricks: { landmark: 'gate', colors: ['#164f3c', '#a7e58b'], second: 'holidayStar' },
        easter: { landmark: 'candyCastle', colors: ['#8372aa', '#ffc66c'], second: 'holidayMarigold' },
        earthday: { landmark: 'bigMoon', colors: ['#b9dfc1'], second: 'holidayShamrock' },
        pride: { landmark: 'gate', colors: ['#563275', '#ff8cbd'], second: 'holidayStar' },
        juneteenth: { landmark: 'spireTower', colors: ['#332344', '#f3c36b'], second: 'holidayBurst' },
        independence: { landmark: 'gate', colors: ['#223d68', '#ffdf9b'], second: 'holidayStar' },
        laborday: { landmark: 'cabin', colors: ['#704039', '#f4c76d'], second: 'holidayHarvest' },
        diademuertos: { landmark: 'mansion', colors: ['#352344', '#ffd080'], second: 'holidayHeart' },
        thanksgiving: { landmark: 'cabin', colors: ['#67402f', '#e7a84e'], second: 'holidayWheat' },
        diwali: { landmark: 'temple', colors: ['#542450', '#ffca58'], second: 'holidayBurst', deco: 'holidayDiya' },
        holi: { landmark: 'candyCastle', colors: ['#7d3980', '#ffca60'], second: 'holidayStar', deco: 'holidayPowder' },
        eidfitr: { landmark: 'gate', colors: ['#175c59', '#f6d477'], second: 'holidayStar', deco: 'holidayCrescent' },
        eidaladha: { landmark: 'temple', colors: ['#315b4e', '#e6c66e'], second: 'holidayStar', deco: 'holidayCrescent' },
        midautumn: { landmark: 'bigMoon', colors: ['#344b83', '#ffd27d'], second: 'holidayLantern', deco: 'holidayMoonRabbit' },
        dragonboat: { landmark: 'lighthouse', colors: ['#176e73', '#e5c75e'], second: 'holidayStar', deco: 'holidayDragonBoat' },
        carnival: { landmark: 'gate', colors: ['#73358e', '#5ce0c2'], second: 'holidayBurst', deco: 'holidayCarnivalMask' },
        festajunina: { landmark: 'cabin', colors: ['#805044', '#f5c45e'], second: 'holidayStar', deco: 'holidayBunting' },
        mexicanindependence: { landmark: 'spireTower', colors: ['#176149', '#f1d15f'], second: 'holidayBurst', deco: 'holidayFirework' },
        lasposadas: { landmark: 'cabin', colors: ['#543d72', '#f7c766'], second: 'holidayMarigold', deco: 'holidayPinata' },
        pohelaboishakh: { landmark: 'temple', colors: ['#9d465e', '#fff0d0'], second: 'holidayStar', deco: 'holidaySunFan' },
        maslenitsa: { landmark: 'cabin', colors: ['#647b9b', '#ffd05e'], second: 'holidayBurst', deco: 'holidaySunWheel' },
        pakistanindependence: { landmark: 'gate', colors: ['#147956', '#e8e8d1'], second: 'holidayStar', deco: 'holidayCrescent' },
        nigeriaindependence: { landmark: 'spireTower', colors: ['#29784f', '#dceaa1'], second: 'holidayStar', deco: 'holidaySunFan' },
        indonesiaindependence: { landmark: 'temple', colors: ['#a3314c', '#f5d374'], second: 'holidayBurst', deco: 'holidayFirework'
        },
        pongal: { landmark: 'cabin', colors: ['#8d704b', '#efc45c'], second: 'holidayWheat', deco: 'holidayHarvest' },
        navratri: { landmark: 'temple', colors: ['#8d315c', '#f4bf55'], second: 'holidayStar', deco: 'holidaySunWheel' },
        brazilindependence: { landmark: 'gate', colors: ['#28815e', '#f0d35e'], second: 'holidayStar', deco: 'holidayFirework' },
        russiavictory: { landmark: 'spireTower', colors: ['#4a5f7e', '#e7be66'], second: 'holidayBurst', deco: 'holidayFirework' },
        bangladeshvictory: { landmark: 'temple', colors: ['#176e54', '#e76153'], second: 'holidayStar', deco: 'holidayStar' },
        indiarepublic: { landmark: 'spireTower', colors: ['#28765f', '#f1c85e'], second: 'holidayStar', deco: 'holidayFirework' },
        indiaindependence: { landmark: 'gate', colors: ['#28755d', '#efb851'], second: 'holidayStar', deco: 'holidaySunFan' },
        chinanationalday: { landmark: 'spireTower', colors: ['#841521', '#ffd23f'], second: 'holidayBurst', deco: 'holidayFlag' },
        childrensday: { landmark: 'candyCastle', colors: ['#3478a8', '#ffd15c'], second: 'holidayPinata', deco: 'holidayCarnivalMask' },
        pakistanday: { landmark: 'gate', colors: ['#187458', '#e7e9d5'], second: 'holidayStar', deco: 'holidayCrescent' },
        indonesianyepi: { landmark: 'bigMoon', colors: ['#344d6c', '#e3c688'], second: 'holidayStar', deco: 'holidayCrescent' },
        nigeriademocracy: { landmark: 'spireTower', colors: ['#28794c', '#e5e7a9'], second: 'holidayStar', deco: 'holidaySunFan' },
        bangladeshlanguage: { landmark: 'temple', colors: ['#1b6b55', '#e75b52'], second: 'holidayMarigold', deco: 'holidayMarigold' },
        russiaday: { landmark: 'gate', colors: ['#466386', '#e7c56e'], second: 'holidayBurst', deco: 'holidayFirework' },
        cincodemayo: { landmark: 'cabin', colors: ['#4d8c71', '#f2c34f'], second: 'holidayStar', deco: 'holidayPinata' }
    };

    const glow = (ctx, x, y, r, rgb, alpha) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    };
    const star = (ctx, x, y, r, points, fill, inner) => {
        ctx.fillStyle = fill; ctx.beginPath();
        for (let i = 0; i < points * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
    };
    Object.assign(D, {
        holidayHeart(ctx, x, y, h, c) {
            const r = h * 0.46; glow(ctx, x, y - r * 0.55, r * 2.5, '255,105,150', 0.18);
            ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - r * 1.9, y - r * 1.15, x - r * 0.9, y - r * 2.1, x, y - r * 1.35); ctx.bezierCurveTo(x + r * 0.9, y - r * 2.1, x + r * 1.9, y - r * 1.15, x, y); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 1.35, r * 0.16, r * 0.34, -0.55, 0, Math.PI * 2); ctx.fill();
        },
        holidayShamrock(ctx, x, y, h, c) {
            ctx.save(); ctx.translate(x, y); ctx.fillStyle = c;
            for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * h * 0.24, -h * 0.68 + Math.sin(a) * h * 0.22, h * 0.28, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.4, h * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -h * 0.58); ctx.quadraticCurveTo(h * 0.2, -h * 0.17, h * 0.38, 0); ctx.stroke(); ctx.restore();
        },
        holidayEgg(ctx, x, y, h, c) {
            const g = ctx.createLinearGradient(x - h * 0.4, y - h, x + h * 0.4, y); g.addColorStop(0, BG.mix(c, '#ffffff', 0.35)); g.addColorStop(1, c);
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - h * 0.52, h * 0.34, h * 0.48, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, h * 0.055);
            for (const yy of [-0.68, -0.4]) { ctx.beginPath(); ctx.moveTo(x - h * 0.27, y + h * yy); ctx.quadraticCurveTo(x, y + h * (yy + 0.08), x + h * 0.27, y + h * yy); ctx.stroke(); }
            ctx.beginPath(); ctx.arc(x, y - h * 0.56, h * 0.07, 0, Math.PI * 2); ctx.fillStyle = '#fff4bd'; ctx.fill();
        },
        holidayGlobe(ctx, x, y, h, c) {
            const r = h * 0.48; glow(ctx, x, y - r, r * 2.1, '87,220,255', 0.15);
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - r, r, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.arc(x, y - r, r * 0.9, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#75cf87';
            ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 1.3); ctx.lineTo(x - r * 0.25, y - r * 1.55); ctx.lineTo(x + r * 0.08, y - r * 1.08); ctx.lineTo(x - r * 0.16, y - r * 0.82); ctx.lineTo(x - r * 0.58, y - r * 0.72); ctx.lineTo(x - r * 0.8, y - r * 1.3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x + r * 0.18, y - r * 0.85); ctx.lineTo(x + r * 0.72, y - r * 1.08); ctx.lineTo(x + r * 0.92, y - r * 0.62); ctx.lineTo(x + r * 0.55, y - r * 0.32); ctx.lineTo(x + r * 0.22, y - r * 0.45); ctx.fill(); ctx.restore();
            ctx.strokeStyle = 'rgba(220,255,250,0.7)'; ctx.lineWidth = Math.max(1, h * 0.035); ctx.beginPath(); ctx.ellipse(x, y - r, r * 0.42, r, 0, 0, Math.PI * 2); ctx.stroke();
        },
        holidayRainbow(ctx, x, y, h) {
            const colors = ['#ff675e', '#ffbd4a', '#ffe66d', '#67d994', '#54b8f3', '#b18aff'];
            ctx.save(); ctx.lineCap = 'round';
            for (let i = 0; i < colors.length; i++) { ctx.strokeStyle = colors[i]; ctx.lineWidth = Math.max(2, h * 0.12); ctx.beginPath(); ctx.arc(x, y, h * (0.2 + i * 0.12), Math.PI, Math.PI * 2); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x - h * 0.68, y - h * 0.02, h * 0.28, h * 0.13, 0, 0, Math.PI * 2); ctx.ellipse(x + h * 0.68, y - h * 0.02, h * 0.28, h * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidayStar(ctx, x, y, h, c, rng) { glow(ctx, x, y - h * 0.5, h * 0.85, '255,205,110', 0.2); star(ctx, x, y - h * 0.5, h * 0.46, 8, c, 0.48); },
        holidayLantern(ctx, x, y, h, c) {
            const w = h * 0.3, cy = y - h * 0.56, bodyH = h * 0.58;
            glow(ctx, x, cy, h * 0.78, '255,91,49', 0.22);
            ctx.save();
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = '#f5cb68'; ctx.lineWidth = Math.max(1, h * 0.035);
            ctx.beginPath(); ctx.moveTo(x, y - h * 1.18); ctx.lineTo(x, y - h * 0.9); ctx.stroke();
            const g = ctx.createLinearGradient(x - w, cy, x + w, cy);
            g.addColorStop(0, '#9d1624'); g.addColorStop(0.42, c || '#ef4938'); g.addColorStop(1, '#9d1624');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, w, bodyH * 0.52, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,221,137,0.88)'; ctx.lineWidth = Math.max(1, h * 0.04); ctx.stroke();
            ctx.fillStyle = '#f2c45c'; ctx.fillRect(x - w * 0.68, cy - bodyH * 0.5, w * 1.36, h * 0.09);
            ctx.fillRect(x - w * 0.68, cy + bodyH * 0.41, w * 1.36, h * 0.09);
            ctx.fillStyle = 'rgba(255,243,190,0.48)'; ctx.beginPath(); ctx.ellipse(x - w * 0.38, cy - bodyH * 0.13, w * 0.13, bodyH * 0.25, -0.18, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#f5cb68'; ctx.lineWidth = Math.max(1, h * 0.035);
            ctx.beginPath(); ctx.moveTo(x, cy + bodyH * 0.52); ctx.lineTo(x, y - h * 0.02); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - h * 0.1, y - h * 0.06); ctx.lineTo(x + h * 0.1, y - h * 0.06); ctx.stroke();
            ctx.restore();
        },
        holidayBurst(ctx, x, y, h, c, rng) {
            const colors = ['#f3cb71', '#f3f0df', '#e65c5c', '#6da8de'];
            ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = c || colors[Math.floor(rng() * colors.length)]; ctx.lineWidth = Math.max(1, h * 0.045);
            for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = h * (i % 2 ? 0.28 : 0.52); ctx.beginPath(); ctx.moveTo(x, y - h * 0.5); ctx.lineTo(x + Math.cos(a) * r, y - h * 0.5 + Math.sin(a) * r); ctx.stroke(); }
            star(ctx, x, y - h * 0.5, h * 0.14, 5, '#fff4c2', 0.45); ctx.restore();
        },
        holidayWheat(ctx, x, y, h, c) {
            ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.2, h * 0.045); ctx.lineCap = 'round';
            for (let stem = -1; stem <= 1; stem++) { const bx = x + stem * h * 0.2; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + h * 0.08, y - h * 0.5, bx - stem * h * 0.06, y - h); ctx.stroke();
                for (let k = 0; k < 4; k++) { const yy = y - h * (0.36 + k * 0.14); ctx.beginPath(); ctx.ellipse(bx - h * 0.1, yy, h * 0.12, h * 0.045, -0.6, 0, Math.PI * 2); ctx.ellipse(bx + h * 0.1, yy - h * 0.04, h * 0.12, h * 0.045, 0.6, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
            }
        },
        holidayMarigold(ctx, x, y, h, c) {
            const r = h * 0.28; glow(ctx, x, y - h * 0.45, h * 0.95, '255,160,62', 0.16);
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.fillStyle = i % 2 ? BG.mix(c, '#ffcc65', 0.22) : c; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.72, y - h * 0.48 + Math.sin(a) * r * 0.72, r * 0.72, r * 0.34, a, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(x, y - h * 0.48, r * 0.42, 0, Math.PI * 2); ctx.fill();
        },
        holidayHarvest(ctx, x, y, h, c) {
            ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - h * 0.32, h * 0.25, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,229,164,0.8)'; ctx.lineWidth = Math.max(1, h * 0.045);
            for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * h * 0.08, y - h * 0.66); ctx.lineTo(x + i * h * 0.08, y + h * 0.04); ctx.stroke(); }
            ctx.fillStyle = '#769b49'; ctx.beginPath(); ctx.ellipse(x - h * 0.28, y - h * 0.06, h * 0.26, h * 0.1, -0.55, 0, Math.PI * 2); ctx.ellipse(x + h * 0.28, y - h * 0.06, h * 0.26, h * 0.1, 0.55, 0, Math.PI * 2); ctx.fill();
        },
        holidayDiya(ctx, x, y, h, c) {
            const flameY = y - h * 0.86; glow(ctx, x, flameY, h * 0.9, '255,155,54', 0.24);
            ctx.fillStyle = '#ffdd83'; ctx.beginPath(); ctx.moveTo(x, flameY - h * 0.36); ctx.bezierCurveTo(x + h * 0.3, flameY - h * 0.04, x + h * 0.12, flameY + h * 0.16, x, flameY + h * 0.18); ctx.bezierCurveTo(x - h * 0.17, flameY + h * 0.1, x - h * 0.3, flameY - h * 0.05, x, flameY - h * 0.36); ctx.fill();
            ctx.fillStyle = c || '#d95f43'; ctx.beginPath(); ctx.moveTo(x - h * 0.48, y - h * 0.28); ctx.quadraticCurveTo(x, y + h * 0.2, x + h * 0.48, y - h * 0.28); ctx.quadraticCurveTo(x, y - h * 0.04, x - h * 0.48, y - h * 0.28); ctx.fill();
            ctx.strokeStyle = '#ffd477'; ctx.lineWidth = Math.max(1, h * 0.045); ctx.beginPath(); ctx.moveTo(x - h * 0.42, y - h * 0.26); ctx.quadraticCurveTo(x, y + h * 0.08, x + h * 0.42, y - h * 0.26); ctx.stroke();
        },
        holidayPowder(ctx, x, y, h, c, rng) {
            const colors = ['#ff5577', '#ffc33f', '#46d4c0', '#a27aff', '#66bfff'];
            ctx.save(); ctx.globalAlpha = 0.78;
            for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9 + rng() * 0.18, r = h * (0.22 + rng() * 0.42), px = x + Math.cos(a) * r, py = y - h * 0.42 + Math.sin(a) * r * 0.68; ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(px, py, h * (0.07 + rng() * 0.045), 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = c || colors[0]; ctx.beginPath(); ctx.arc(x, y - h * 0.42, h * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidayCrescent(ctx, x, y, h, c) {
            const cy = y - h * 0.56, r = h * 0.48;
            glow(ctx, x, cy, h * 0.95, '255,225,140', 0.13);
            ctx.fillStyle = c || '#f3d374'; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.arc(x + r * 0.42, cy - r * 0.12, r * 0.84, 0, Math.PI * 2); ctx.fill('evenodd');
            star(ctx, x + h * 0.52, cy - h * 0.38, h * 0.16, 5, '#fff1ba', 0.45);
        },
        holidayMoonRabbit(ctx, x, y, h, c) {
            const cy = y - h * 0.42, r = h * 0.42; glow(ctx, x, cy, h * 1.1, '255,217,145', 0.12);
            const g = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.35, 1, x, cy, r); g.addColorStop(0, '#fff0c4'); g.addColorStop(1, c || '#e7aa62');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#735174'; ctx.beginPath(); ctx.ellipse(x - h * 0.08, y - h * 0.5, h * 0.17, h * 0.2, -0.25, 0, Math.PI * 2); ctx.ellipse(x + h * 0.1, y - h * 0.48, h * 0.15, h * 0.18, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(x + h * 0.02, y - h * 0.73, h * 0.13, h * 0.22, -0.08, 0, Math.PI * 2); ctx.ellipse(x + h * 0.18, y - h * 0.72, h * 0.1, h * 0.19, 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff1c7'; ctx.beginPath(); ctx.arc(x + h * 0.04, y - h * 0.55, h * 0.027, 0, Math.PI * 2); ctx.fill();
        },
        holidayDragonBoat(ctx, x, y, h, c) {
            const waterY = y - h * 0.2; ctx.save(); ctx.lineJoin = 'round';
            ctx.fillStyle = 'rgba(150,235,218,0.32)'; ctx.beginPath(); ctx.ellipse(x, waterY + h * 0.18, h * 0.7, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = c || '#d8b95d'; ctx.beginPath(); ctx.moveTo(x - h * 0.65, waterY - h * 0.05); ctx.lineTo(x + h * 0.46, waterY - h * 0.05); ctx.lineTo(x + h * 0.68, waterY - h * 0.28); ctx.lineTo(x + h * 0.74, waterY - h * 0.16); ctx.lineTo(x + h * 0.58, waterY + h * 0.08); ctx.quadraticCurveTo(x, waterY + h * 0.26, x - h * 0.65, waterY - h * 0.05); ctx.fill();
            ctx.fillStyle = '#db5549'; ctx.beginPath(); ctx.moveTo(x + h * 0.45, waterY - h * 0.2); ctx.lineTo(x + h * 0.65, waterY - h * 0.43); ctx.lineTo(x + h * 0.69, waterY - h * 0.22); ctx.lineTo(x + h * 0.82, waterY - h * 0.18); ctx.lineTo(x + h * 0.72, waterY - h * 0.05); ctx.lineTo(x + h * 0.48, waterY - h * 0.06); ctx.fill();
            for (let i = -2; i <= 2; i++) { const px = x + i * h * 0.19; ctx.fillStyle = '#553e4d'; ctx.beginPath(); ctx.arc(px, waterY - h * 0.14, h * 0.055, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f4dc98'; ctx.lineWidth = Math.max(1.2, h * 0.035); ctx.beginPath(); ctx.moveTo(px, waterY - h * 0.08); ctx.lineTo(px - h * 0.17, waterY + h * 0.12); ctx.stroke(); }
            ctx.restore();
        },
        holidayCarnivalMask(ctx, x, y, h, c) {
            const colors = ['#ff5578', '#ffd04f', '#54d8c1', '#a982ff']; ctx.save();
            for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.88 + i * Math.PI * 0.22; ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = h * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - h * 0.52); ctx.quadraticCurveTo(x + Math.cos(a) * h * 0.58, y - h * 1.12, x + Math.cos(a) * h * 0.72, y - h * 0.26); ctx.stroke(); }
            ctx.fillStyle = c || '#55d8c0'; ctx.beginPath(); ctx.moveTo(x - h * 0.58, y - h * 0.48); ctx.quadraticCurveTo(x, y - h * 0.74, x + h * 0.58, y - h * 0.48); ctx.lineTo(x + h * 0.36, y - h * 0.12); ctx.quadraticCurveTo(x, y + h * 0.08, x - h * 0.36, y - h * 0.12); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#211438'; ctx.beginPath(); ctx.ellipse(x - h * 0.22, y - h * 0.35, h * 0.15, h * 0.07, -0.12, 0, Math.PI * 2); ctx.ellipse(x + h * 0.22, y - h * 0.35, h * 0.15, h * 0.07, 0.12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidayBunting(ctx, x, y, h, c) {
            const colors = ['#d94b4b', '#f3c755', '#57a873', '#668bd3']; ctx.save();
            ctx.strokeStyle = '#f4dba5'; ctx.lineWidth = Math.max(1.5, h * 0.035); ctx.beginPath(); ctx.moveTo(x - h * 0.72, y - h * 0.75); ctx.quadraticCurveTo(x, y - h * 0.38, x + h * 0.72, y - h * 0.75); ctx.stroke();
            for (let i = 0; i < 5; i++) { const px = x - h * 0.58 + i * h * 0.29, py = y - h * (0.67 - Math.sin(i / 4 * Math.PI) * 0.15); ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.moveTo(px - h * 0.11, py); ctx.lineTo(px + h * 0.11, py); ctx.lineTo(px, py + h * 0.22); ctx.closePath(); ctx.fill(); }
            glow(ctx, x, y - h * 0.12, h * 0.62, '255,130,47', 0.16); ctx.fillStyle = '#f27c39'; ctx.beginPath(); ctx.moveTo(x, y - h * 0.42); ctx.bezierCurveTo(x + h * 0.27, y - h * 0.08, x + h * 0.08, y + h * 0.05, x, y); ctx.bezierCurveTo(x - h * 0.12, y + h * 0.03, x - h * 0.24, y - h * 0.08, x, y - h * 0.42); ctx.fill(); ctx.restore();
        },
        holidayFirework(ctx, x, y, h, c, rng) {
            const colors = [c || '#f4d46d', '#f4f1df', '#e95d68', '#66d3a3']; ctx.save(); ctx.globalAlpha = 0.82;
            for (let burst = 0; burst < 3; burst++) { const cx = x + (burst - 1) * h * 0.4, cy = y - h * (0.45 + (burst % 2) * 0.2), col = colors[burst % colors.length]; glow(ctx, cx, cy, h * 0.48, '255,210,120', 0.12); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, h * 0.035); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = h * (0.26 + rng() * 0.12); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } star(ctx, cx, cy, h * 0.075, 4, '#fff4c4', 0.4); }
            ctx.restore();
        },
        holidayPinata(ctx, x, y, h, c) {
            const colors = ['#f25462', '#f5c34f', '#53b9a1', '#856ce0', '#ed8b4d']; ctx.save(); ctx.strokeStyle = '#f4dda8'; ctx.lineWidth = Math.max(1, h * 0.035); ctx.beginPath(); ctx.moveTo(x, y - h * 1.05); ctx.lineTo(x, y - h * 0.82); ctx.stroke();
            for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.fillStyle = colors[i]; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * h * 0.24, y - h * 0.5 + Math.sin(a) * h * 0.24); ctx.lineTo(x + Math.cos(a - 0.25) * h * 0.7, y - h * 0.5 + Math.sin(a - 0.25) * h * 0.7); ctx.lineTo(x + Math.cos(a + 0.25) * h * 0.7, y - h * 0.5 + Math.sin(a + 0.25) * h * 0.7); ctx.closePath(); ctx.fill(); }
            ctx.fillStyle = c || '#f7d16b'; ctx.beginPath(); ctx.arc(x, y - h * 0.5, h * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidaySunFan(ctx, x, y, h, c) {
            const colors = ['#d94e51', '#f0bd58', '#4e9b79', '#e98252']; ctx.save();
            for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.moveTo(x, y - h * 0.12); ctx.lineTo(x + Math.cos(a) * h * 0.68, y + Math.sin(a) * h * 0.68); ctx.lineTo(x + Math.cos(a + Math.PI / 7) * h * 0.68, y + Math.sin(a + Math.PI / 7) * h * 0.68); ctx.closePath(); ctx.fill(); }
            ctx.strokeStyle = '#ffe4b1'; ctx.lineWidth = Math.max(1, h * 0.035); ctx.beginPath(); ctx.arc(x, y - h * 0.12, h * 0.68, Math.PI, Math.PI * 2); ctx.stroke(); ctx.fillStyle = c || '#f4d27a'; ctx.beginPath(); ctx.arc(x, y - h * 0.12, h * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidaySunWheel(ctx, x, y, h, c) {
            const cy = y - h * 0.54, r = h * 0.35; glow(ctx, x, cy, h * 0.95, '255,204,82', 0.16); ctx.save(); ctx.strokeStyle = c || '#ffd05e'; ctx.lineWidth = Math.max(1.5, h * 0.055);
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); ctx.lineTo(x + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45); ctx.stroke(); }
            ctx.fillStyle = '#f8cf68'; ctx.beginPath(); ctx.arc(x, cy, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff0bf'; ctx.beginPath(); ctx.arc(x - r * 0.18, cy - r * 0.2, r * 0.15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        holidayFlag(ctx, x, y, h, c) {
            const poleX = x - h * 0.08, top = y - h * 1.04, flagY = y - h * 0.98, fw = h * 0.64, fh = h * 0.4;
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = '#e5c46d'; ctx.lineWidth = Math.max(1, h * 0.035); ctx.beginPath(); ctx.moveTo(poleX, y); ctx.lineTo(poleX, top); ctx.stroke();
            ctx.shadowColor = 'rgba(255,205,62,0.7)'; ctx.shadowBlur = h * 0.14;
            ctx.fillStyle = '#d91f32'; ctx.beginPath(); ctx.moveTo(poleX, flagY); ctx.quadraticCurveTo(poleX + fw * 0.55, flagY + Math.sin(h) * h * 0.035, poleX + fw, flagY + fh * 0.08); ctx.lineTo(poleX + fw, flagY + fh); ctx.quadraticCurveTo(poleX + fw * 0.5, flagY + fh * 0.94, poleX, flagY + fh); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = '#ffdf58';
            const sx = poleX + fw * 0.22, sy = flagY + fh * 0.28, sr = fh * 0.14;
            star(ctx, sx, sy, sr, 5, '#ffdf58', 0.45);
            for (const [dx, dy] of [[0.4, -0.17], [0.49, -0.01], [0.47, 0.18], [0.34, 0.31]]) {
                ctx.save(); ctx.translate(poleX + fw * dx, flagY + fh * (0.5 + dy)); ctx.rotate(Math.PI * 0.82); star(ctx, 0, 0, sr * 0.44, 5, '#ffdf58', 0.45); ctx.restore();
            }
            ctx.restore();
        }
    });

    // China National Day has a recognizable Tiananmen Square skyline instead of
    // the generic fortress and lantern scenery used by the other festival themes.
    BackdropScenery.chinanationalday = function (ctx, W, H, rng, bd, V) {
        const base = H * 0.85, center = W * 0.5, scale = H;
        const far = ['#3b1019', '#57131b', '#71202a'], glowColor = '255,191,83';
        // Distant Beijing silhouettes and rows of warm windows create depth.
        let x = -8;
        while (x < W + 12) {
            const w = H * (0.035 + rng() * 0.055), h = H * (0.13 + rng() * 0.22);
            ctx.fillStyle = far[(rng() * far.length) | 0]; ctx.fillRect(x, base - h, w, H * 0.3);
            if (rng() < 0.65) { ctx.fillStyle = '#7a2830'; ctx.fillRect(x + w * 0.4, base - h - H * 0.035, w * 0.2, H * 0.035); }
            for (let wy = base - h + H * 0.025; wy < base - H * 0.02; wy += H * 0.028) {
                for (let wx = x + w * 0.15; wx < x + w * 0.84; wx += H * 0.022) {
                    if (rng() < 0.36) bd.windows.push({ x: wx, y: wy, w: Math.max(2, H * 0.005), h: Math.max(2, H * 0.008), ph: rng() * 6, rgb: glowColor });
                }
            }
            x += w + H * (0.012 + rng() * 0.018);
        }
        // Broad square and ceremonial approach.
        const plaza = ctx.createLinearGradient(0, base - H * 0.02, 0, H);
        plaza.addColorStop(0, '#9b4d3a'); plaza.addColorStop(1, '#35151b');
        ctx.fillStyle = plaza; ctx.fillRect(0, base, W, H - base);
        ctx.strokeStyle = 'rgba(255,213,118,0.28)'; ctx.lineWidth = Math.max(1, H * 0.002);
        for (let i = 0; i < 11; i++) { const yy = base + H * (0.018 + i * 0.018); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
        // Tiananmen's red walls, central arched passage and layered golden roof.
        const gateW = scale * 0.72, gateH = scale * 0.31, left = center - gateW / 2, roofY = base - gateH;
        const wall = ctx.createLinearGradient(left, 0, left + gateW, 0);
        wall.addColorStop(0, '#781a22'); wall.addColorStop(0.48, '#c52c2b'); wall.addColorStop(1, '#71151e');
        ctx.fillStyle = wall; ctx.fillRect(left, roofY + scale * 0.09, gateW, gateH * 0.76);
        ctx.fillStyle = '#45151b'; ctx.fillRect(left - scale * 0.11, roofY + gateH * 0.72, gateW + scale * 0.22, scale * 0.055);
        const arch = (cx, width, height) => {
            ctx.fillStyle = '#351319'; ctx.beginPath(); ctx.moveTo(cx - width / 2, base); ctx.lineTo(cx - width / 2, base - height * 0.62);
            ctx.quadraticCurveTo(cx, base - height * 1.18, cx + width / 2, base - height * 0.62); ctx.lineTo(cx + width / 2, base); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,210,117,0.75)'; ctx.lineWidth = Math.max(1, scale * 0.003); ctx.stroke();
        };
        arch(center, scale * 0.12, gateH * 0.63);
        for (const side of [-1, 1]) arch(center + side * scale * 0.2, scale * 0.075, gateH * 0.52);
        for (let i = 0; i < 13; i++) {
            const wx = left + scale * (0.055 + i * 0.05), wy = roofY + scale * 0.135;
            ctx.fillStyle = i % 2 ? '#ffcc68' : '#ffe6a2'; ctx.fillRect(wx, wy, scale * 0.018, scale * 0.012);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const light = ctx.createRadialGradient(wx + scale * 0.009, wy + scale * 0.006, 1, wx + scale * 0.009, wy + scale * 0.006, scale * 0.036);
            light.addColorStop(0, 'rgba(255,202,90,0.55)'); light.addColorStop(1, 'rgba(255,177,70,0)'); ctx.fillStyle = light; ctx.fillRect(wx - scale * 0.03, wy - scale * 0.03, scale * 0.08, scale * 0.08); ctx.restore();
        }
        const roof = (cx, y, width, height) => {
            ctx.save(); ctx.shadowColor = 'rgba(255,190,66,0.58)'; ctx.shadowBlur = scale * 0.025;
            ctx.fillStyle = '#a72124'; ctx.beginPath(); ctx.moveTo(cx - width * 0.57, y + height * 0.52); ctx.quadraticCurveTo(cx - width * 0.42, y + height * 0.44, cx - width * 0.37, y + height * 0.12); ctx.lineTo(cx + width * 0.37, y + height * 0.12); ctx.quadraticCurveTo(cx + width * 0.42, y + height * 0.44, cx + width * 0.57, y + height * 0.52); ctx.lineTo(cx + width * 0.42, y + height * 0.47); ctx.lineTo(cx + width * 0.32, y + height * 0.28); ctx.lineTo(cx - width * 0.32, y + height * 0.28); ctx.lineTo(cx - width * 0.42, y + height * 0.47); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0; ctx.strokeStyle = '#f4c65e'; ctx.lineWidth = Math.max(1.4, scale * 0.006); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,231,156,0.72)'; ctx.lineWidth = Math.max(1, scale * 0.003); ctx.beginPath(); ctx.moveTo(cx - width * 0.31, y + height * 0.3); ctx.lineTo(cx + width * 0.31, y + height * 0.3); ctx.stroke();
            for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * width * 0.49, y + height * 0.49); ctx.quadraticCurveTo(cx + side * width * 0.63, y + height * 0.4, cx + side * width * 0.6, y + height * 0.25); ctx.stroke(); }
            ctx.restore();
        };
        roof(center, roofY, gateW * 1.12, scale * 0.105);
        roof(center, roofY + scale * 0.065, gateW * 0.82, scale * 0.075);
        // A clearly visible five-star red flag above the gate.
        const poleX = center, flagTop = roofY - scale * 0.14, flagW = scale * 0.145, flagH = scale * 0.09;
        ctx.strokeStyle = '#f6d27a'; ctx.lineWidth = Math.max(1.5, scale * 0.005); ctx.beginPath(); ctx.moveTo(poleX, roofY + scale * 0.04); ctx.lineTo(poleX, flagTop - scale * 0.012); ctx.stroke();
        ctx.save(); ctx.shadowColor = 'rgba(255,55,47,0.75)'; ctx.shadowBlur = scale * 0.045;
        ctx.fillStyle = '#e9272d'; ctx.fillRect(poleX, flagTop, flagW, flagH); ctx.restore();
        ctx.fillStyle = '#ffdf55'; star(ctx, poleX + flagW * 0.23, flagTop + flagH * 0.28, flagH * 0.19, 5, '#ffdf55', 0.42);
        for (const [dx, dy] of [[0.48, 0.16], [0.57, 0.34], [0.55, 0.56], [0.43, 0.72]]) {
            ctx.save(); ctx.translate(poleX + flagW * dx, flagTop + flagH * dy); ctx.rotate(Math.atan2(dy - 0.28, dx - 0.23)); star(ctx, 0, 0, flagH * 0.07, 5, '#ffdf55', 0.42); ctx.restore();
        }
        // Small ceremonial towers anchor the edges of the skyline.
        for (const side of [-1, 1]) {
            const tx = center + side * scale * 0.58, th = scale * (0.16 + rng() * 0.04), tw = scale * 0.09;
            ctx.fillStyle = '#651820'; ctx.fillRect(tx - tw * 0.3, base - th, tw * 0.6, th);
            roof(tx, base - th, tw * 1.4, scale * 0.045);
            ctx.fillStyle = '#e8bd61'; ctx.fillRect(tx - tw * 0.34, base - th + scale * 0.045, tw * 0.68, scale * 0.012);
        }
    };

    const mood = [
        { top: '#182b51', middle: '#566b91', horizon: '#e6a27c', base: '#f4d4a0', body: 'sun' },
        { top: '#17142f', middle: '#45345d', horizon: '#b76478', base: '#f0b38f', body: 'sun' },
        { top: '#09142f', middle: '#1f3155', horizon: '#536992', base: '#a7bfd6', body: 'moon' }
    ];
    const variant = (id, p, index) => {
        const m = mood[index], scene = festivalScenes[id];
        const deco = scene.deco || (id === 'chinesenewyear' ? (index === 2 ? 'holidayBurst' : 'holidayLantern') : id === 'newyear' ? 'holidayStar' : id === 'valentines' ? 'holidayHeart' : id === 'stpatricks' ? 'holidayShamrock' : id === 'easter' ? 'holidayEgg' : id === 'earthday' ? 'holidayGlobe' : id === 'pride' ? 'holidayRainbow' : id === 'juneteenth' ? 'holidayStar' : id === 'independence' ? 'holidayBurst' : id === 'laborday' ? 'holidayWheat' : id === 'diademuertos' ? 'holidayMarigold' : 'holidayHarvest');
        const far = BG.mix(p.mid, p.horizon, 0.34), near = BG.mix(p.deep, '#050916', 0.34);
        const stars = index === 2 ? 190 : index === 1 ? 78 : 44;
        const variantNames = id === 'chinesenewyear'
            ? ['Spring Festival · Dawn', 'Lantern Reunion · Dusk', 'Fireworks · Midnight']
            : ['Festival Dawn', 'Lantern Dusk', 'Celestial Night'];
        return {
            // Keep the scene title short enough for the round badge; the HUD subtitle
            // still names the full holiday theme.
            name: id === 'chinesenewyear' ? variantNames[index] : `${p.label} · ${variantNames[index]}`,
            sky: [[0, BG.mix(p.deep, m.top, 0.36)], [0.43, BG.mix(p.mid, m.middle, 0.34)], [0.79, BG.mix(p.horizon, m.horizon, 0.31)], [1, BG.mix(p.light, m.base, 0.26)]],
            body: { kind: m.body, x: [0.74, 0.28, 0.78][index], y: [0.27, 0.38, 0.2][index], r: [44, 38, 28][index], rgb: p.accentRgb },
            haze: p.haze, stars,
            cloudTint: { shade: '70,65,112', hi: '255,238,228', lo: '232,211,221' },
            ridges: {
                n: 11, base: [0.56, 0.88], amp: [0.17, 0.05], oct: [5, 3], far: [far, BG.mix(far, p.mid, 0.35)], near: [near, BG.mix(near, '#101020', 0.28)], fog: [0.42, 0.06],
                deco: (t) => t < 0.16 ? null : t < 0.5 ? [{ k: deco, n: 12, h: 23, c: [p.accent, p.light] }, { k: scene.second, n: 7, h: 16, c: [p.light, p.accent] }] : t < 0.78 ? [{ k: deco, n: 11, h: 34, c: [p.accent, p.light] }, { k: scene.second, n: 8, h: 24, c: [p.light, p.accent] }, { k: 'round', n: 22, h: 20, c: [p.mid, p.accent] }] : [{ k: deco, n: 8, h: 48, c: [p.accent, p.light] }, { k: scene.second, n: 6, h: 36, c: [p.light, p.accent] }, { k: 'round', n: 14, h: 38, c: p.mid }]
            },
            mid: id === 'chinanationalday' ? 'chinanationalday' : ['meadow', 'fortress', 'islands'][index], midF: 0.28,
            city: id === 'chinanationalday' ? { c: ['#3c0b15', '#70121d', '#a51e2b'], lit: ['255,207,84', '255,235,170', '255,116,69'] } : undefined,
            extras: id === 'chinanationalday' ? [] : [
                { k: 'landmark', kind: scene.landmark, f: 0.22, x: index === 1 ? 0.66 : 0.34, y: 0.79, size: index === 2 ? 78 : 68, c: scene.colors, base: p.accent },
                { k: 'landmark', kind: index === 1 ? 'bigMoon' : 'cabin', f: 0.31, x: index === 1 ? 0.2 : 0.78, y: index === 2 ? 0.84 : 0.82, size: index === 2 ? 34 : 42, c: [p.shadow, p.accent], base: p.deep }
            ],
            clouds: [
                { f: 0.08, n: 4, s: [0.6, 1], a: 0.26, v: 0.035, y: [0.07, 0.24] },
                { f: 0.2, n: 4, s: [0.8, 1.2], a: 0.34, v: 0.05, y: [0.1, 0.34] },
                { f: 0.34, n: 3, s: [1, 1.4], a: 0.28, v: 0.07, y: [0.08, 0.3] }
            ],
            mist: [{ f: 0.2, y: [0.62, 0.74], rgb: p.haze, a: 0.15, n: 3 }, { f: 0.46, y: [0.78, 0.9], rgb: p.haze, a: 0.12, n: 2 }],
            parts: p.particles,
            ambient: Object.assign({ rays: index === 0, rayRgb: p.accentRgb }, p.shooting ? { shooting: true } : {}, p.fireworks ? { fireworks: true } : {}),
            ground: id === 'chinanationalday'
                ? { top: '#7a2527', bot: '#2d1117', tufts: 'rubble', c: ['#75272b', '#a64a34', '#d49b4f'] }
                : { top: p.mid, bot: p.shadow, tufts: 'grass', c: p.accent, glow: true },
            fg: id === 'chinanationalday'
                ? { top: { k: 'rocks', c: ['#4c171e', '#79242a'] }, bottom: { k: 'rubble', c: ['#321219', '#552027', '#8b352d'] } }
                : { top: { k: 'leaves', c: [p.accent, p.mid, p.light] }, bottom: { k: 'grass', c: [p.deep, p.mid, p.accent] } },
            post: id
        };
    };

    const toRGB = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };
    const makeTile = (p, seed) => {
        const [canvas, ctx] = Graphics.makeTile(128), rng = Graphics.rng(seed);
        const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, BG.mix(p.shadow, p.mid, 0.28)); g.addColorStop(1, BG.mix(p.shadow, '#090b17', 0.46));
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
        for (let y = 12; y < 128; y += 19) { ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + rng() * 3); ctx.lineTo(128, y - rng() * 3); ctx.stroke(); }
        for (let i = 0; i < 190; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(rng() * 128, rng() * 128, 1 + rng() * 2, 1 + rng() * 2); }
        ctx.fillStyle = p.accent; ctx.globalAlpha = 0.56; ctx.fillRect(0, 0, 128, 3); ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(${toRGB(p.accent)},0.24)`; ctx.lineWidth = 1;
        for (let x = 16; x < 128; x += 32) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x + 6, 28); ctx.lineTo(x, 34); ctx.lineTo(x - 6, 28); ctx.closePath(); ctx.stroke(); }
        return ctx.createPattern(canvas, 'repeat');
    };
    const baseTexture = Level.prototype.getMaterialPattern;
    Level.prototype.getMaterialPattern = function () { return specs[this.material] ? Graphics.textures[this.material] : baseTexture.call(this); };
    const init = Graphics.init;
    Graphics.init = function () { init.call(this); for (const [i, id] of ids.entries()) this.textures[id] = makeTile(specs[id], 9100 + i * 97); };

    const finish = (p) => (ctx, plat, w, h, t) => {
        const pulse = 0.72 + 0.28 * Math.sin(t * 0.045 + plat.seed);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${p.accentRgb},${0.28 + pulse * 0.34})`; ctx.fillRect(1, 0.5, w - 2, 2.4);
        ctx.fillStyle = `rgba(${p.accentRgb},${0.08 + pulse * 0.1})`; ctx.fillRect(3, h, w - 6, 9);
        for (let x = (plat.seed * 17) % 54 + 14; x < w - 10; x += 54) {
            ctx.fillStyle = `rgba(${p.accentRgb},${0.32 + pulse * 0.36})`; ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x + 4, 9); ctx.lineTo(x, 13); ctx.lineTo(x - 4, 9); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    };

    const tint = {};
    for (const [i, id] of ids.entries()) {
        const p = specs[id];
        if (!Level.MATERIALS.includes(id)) Level.MATERIALS.push(id);
        tint[id] = p.accentRgb;
        RIM_LIGHT[id] = [p.accentRgb, -1, -1, 0.4];
        Level.FINISH[id] = finish(p);
        PostFX.P[id] = { bloom: 0.32, th: 0.65, grade: [p.haze, 0.11, toRGB(p.shadow), 0.08], vignette: [toRGB(p.deep), 0.38], grain: 0.025, rays: i % 3 === 0 ? p.accentRgb : null };
        const source = Terrain.MATS[p.base] || Terrain.MATS.dirt;
        Terrain.MATS[id] = Object.fromEntries(Object.entries(source).map(([role, mat]) => [role, Object.assign({}, mat, { name: `${p.label} ${mat.name}`, debris: p.mid })]));
        Terrain.FLOAT[id] = Terrain.FLOAT[p.base] === undefined ? 0.14 : Terrain.FLOAT[p.base];
        Terrain.PILLAR[id] = Terrain.PILLAR[p.base] || 'post';
        Terrain.HANG[id] = Terrain.HANG[p.base] || 'chain';
        Terrain.LIQUID[id] = 0;
        BG_VARIANTS[id] = [0, 1, 2].map((v) => variant(id, p, v));
    }
    // National Day gets a visible, continuously animated firework layer instead
    // of the rare shooting-star effect shared by quieter holiday skies.
    const buildBackdrop = Backdrop.build;
    Backdrop.build = function (level) {
        const bd = buildBackdrop.call(this, level);
        if (level.material === 'chinanationalday') {
            bd.holidayFireworks = [
                { x: bd.W * 0.18, y: bd.H * 0.2, age: 24, launch: 26, life: 170, seed: 0.7, rgb: '255,210,63' },
                { x: bd.W * 0.79, y: bd.H * 0.25, age: 82, launch: 26, life: 170, seed: 2.1, rgb: '255,92,61' },
                { x: bd.W * 0.57, y: bd.H * 0.16, age: 52, launch: 26, life: 170, seed: 4.6, rgb: '255,241,186' }
            ];
            bd.holidayFireworkWait = 18;
        }
        return bd;
    };
    const stepBackdrop = Backdrop.step;
    Backdrop.step = function (bd, dt) {
        stepBackdrop.call(this, bd, dt);
        if (!bd || bd.material !== 'chinanationalday' || dt <= 0) return;
        const bursts = bd.holidayFireworks || (bd.holidayFireworks = []);
        for (const b of bursts) b.age += dt;
        bd.holidayFireworks = bursts.filter(b => b.age < b.life);
        bd.holidayFireworkWait -= dt;
        if (bd.holidayFireworkWait <= 0 && bd.holidayFireworks.length < 5) {
            const colors = ['255,210,63', '255,96,58', '255,239,180', '255,148,66'];
            bd.holidayFireworks.push({ x: bd.W * (0.1 + Math.random() * 0.8), y: bd.H * (0.11 + Math.random() * 0.23), age: 0, launch: 27, life: 170, seed: Math.random() * Math.PI * 2, rgb: colors[(Math.random() * colors.length) | 0] });
            bd.holidayFireworkWait = 37 + Math.random() * 25;
        }
    };
    const drawBackdropLayer = BackdropLayers.anim;
    BackdropLayers.anim = function (ctx, bd, layer) {
        drawBackdropLayer.call(this, ctx, bd, layer);
        if (layer.tag !== 'sky' || !bd.holidayFireworks || !bd.holidayFireworks.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of bd.holidayFireworks) {
            if (b.age < b.launch) {
                const flight = b.age / b.launch, rocketY = bd.H * 0.68 + (b.y - bd.H * 0.68) * flight;
                ctx.strokeStyle = `rgba(${b.rgb},${0.5 * (1 - flight * 0.3)})`; ctx.lineWidth = 2.2;
                ctx.beginPath(); ctx.moveTo(b.x, rocketY + 30 * (1 - flight)); ctx.lineTo(b.x, rocketY); ctx.stroke();
                glow(ctx, b.x, rocketY, 12 + 8 * flight, b.rgb, 0.62);
                continue;
            }
            const progress = (b.age - b.launch) / (b.life - b.launch), spread = Math.min(1, progress / 0.4), fade = Math.max(0, 1 - progress);
            const radius = bd.H * 0.14 * spread, rgb = b.rgb;
            const flash = Math.max(0, 1 - progress * 5);
            if (flash > 0.02) glow(ctx, b.x, b.y, bd.H * (0.06 + flash * 0.07), rgb, 0.7 * flash);
            ctx.strokeStyle = `rgba(${rgb},${fade * 0.82})`;
            ctx.fillStyle = `rgba(255,244,199,${fade * 0.95})`;
            ctx.lineWidth = 1.7;
            for (let i = 0; i < 36; i++) {
                const a = b.seed + i * Math.PI * 2 / 36, jitter = 0.72 + 0.28 * Math.sin(i * 17.3 + b.seed);
                const outer = radius * jitter, inner = outer * (progress < 0.28 ? 0.08 : 0.58);
                const drop = progress * progress * bd.H * 0.045;
                const x0 = b.x + Math.cos(a) * inner, y0 = b.y + Math.sin(a) * inner + drop * 0.35;
                const x1 = b.x + Math.cos(a) * outer, y1 = b.y + Math.sin(a) * outer + drop;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
                const twinkle = 0.66 + 0.34 * Math.sin(b.age * 0.28 + i * 1.7);
                ctx.globalAlpha = fade * twinkle; ctx.beginPath(); ctx.arc(x1, y1, i % 3 === 0 ? 2.2 : 1.45, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
            }
            if (progress < 0.36) {
                ctx.strokeStyle = `rgba(255,225,151,${(1 - progress / 0.36) * 0.6})`; ctx.lineWidth = 1.1;
                ctx.beginPath(); ctx.arc(b.x, b.y, radius * 0.76, 0, Math.PI * 2); ctx.stroke();
            }
        }
        ctx.restore();
    };

    Object.assign(DUST_TINT, tint);
})();
