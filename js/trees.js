// Upgrade tree data. x = column (fractions ok), y = row. A node unlocks when ANY parent in `req` has a level
// and the game's stage reaches the row tier (rows 0-2: stage 0, 3-4: 3, 5-6: 8, 7-8: 15).
// Each main tree: root → 3 branches → 2 paths each; every path ends in its own capstone (★). No paths merge.
// fx = 'stat+v' (adds v per level) or 'stat*v' (multiplies by v per level). game/modes.js read stats by name.
const n = (id, x, y, icon, name, desc, req, max, cost, k, fx) => ({ id, x, y, icon, name, desc, req: req ? [req] : [], max, cost, k, fx });

export const TREES = {
  dice: [
    n('d_pip',   2.5, 0, '⚀', 'Pip Polish',      '+1 value on every face',            null,      25, 10,   1.4, 'val+1'),
    n('d_auto',  0.5, 1, '🤖', 'Auto Roll',       'Dice roll by themselves',           'd_pip',   1,  60,   1,   'auto+1'),
    n('d_die',   2.5, 1, '🎲', 'Extra Die',       '+1 die (bigger sums, combos)',      'd_pip',   4,  250,  5,   'dice+1'),
    n('d_crit',  4.5, 1, '🎯', 'Lucky Streak',    '+2% crit chance',                   'd_pip',   15, 250,  1.6, 'crit+0.02'),
    // Tempo: speed
    n('d_speed', 0, 2, '⏱️', 'Quick Hands',       'Auto roll 10% faster',              'd_auto',  10, 150,  1.75, 'spd*0.9'),
    n('d_over',  0, 3, '⚡', 'Overclock',         'Auto roll 15% faster',              'd_speed', 5,  15e3, 4,   'spd*0.85'),
    n('d_burst', 0, 4, '💫', 'Burst Roll',        'Every 10th roll pays ×(1+lvl)',     'd_over',  10, 4e4,  2.2, 'burst+1'),
    n('d_perp',  0, 5, '♾️', 'Perpetual Motion',  '★ Auto roll 5% faster (min 0.1s)',  'd_burst', 100, 2e6, 1.8, 'spd*0.95'),
    // Tempo: echo
    n('d_echo',  1, 2, '🔁', 'Echo Roll',         '+4% chance a roll pays twice',      'd_auto',  10, 800,  1.9, 'echo+0.04'),
    n('d_snake', 1, 3, '🐍', 'Snake Eyes',        '1s pay +5 each',                    'd_echo',  10, 5e3,  2,   'one+5'),
    n('d_ring',  1, 4, '🔔', 'Ringing',           'Echoes pay +1× more',               'd_snake', 10, 3e4,  2.2, 'reson+1'),
    n('d_chorus', 1, 6, '🎶', 'Chorus',           '★ +1% echo chance',                 'd_ring',  40, 5e6,  1.6, 'echo+0.01'),
    // Dice: combos
    n('d_combo', 2, 2, '🔥', 'Combo Power',       '+25% combo bonus',                  'd_die',   10, 400,  1.9, 'combo+0.25'),
    n('d_jack',  2, 3, '🎰', 'Jackpot Hunter',    'JACKPOT pays ×2',                   'd_combo', 5,  2e4,  6,   'jack*2'),
    n('d_quad',  2, 5, '4️⃣', 'Quad Squad',        'Four of a Kind pays ×2',            'd_jack',  5,  2e6,  5,   'quad*2'),
    n('d_fate',  2, 7, '🔮', 'Fated Combos',      '★ All combo bonuses +15%',         'd_quad',  100, 2e10, 1.6, 'fate*1.15'),
    // Dice: more dice
    n('d_load',  3, 2, '🧲', 'Loaded Dice',       'Lowest die rerolls (keeps best)',   'd_die',   3,  3e3,  6,   'load+1'),
    n('d_six',   3, 3, '✨', 'Sixth Die',         '+1 more die',                       'd_load',  1,  1e6,  1,   'dice+1'),
    n('d_seven', 3, 5, '🌠', 'Seventh Die',       '+1 more die',                       'd_six',   1,  2e7,  1,   'dice+1'),
    n('d_rush',  3, 6, '🚀', 'Dice Rush',         '★ All dice income +15%',           'd_seven', 100, 3e7, 1.6, 'mul*1.15'),
    // Fortune: crits
    n('d_critx', 4, 2, '💥', 'Heavy Hitter',      '+0.5× crit payout',                 'd_crit',  10, 1500, 2.6, 'critx+0.5'),
    n('d_ocrit', 4, 3, '☄️', 'Overcrit',          'Crit payout ×1.2',                  'd_critx', 20, 2e4,  2,   'ocrit*1.2'),
    n('d_keen',  4, 5, '🗡️', 'Keen Eye',          '+1% crit chance',                   'd_ocrit', 30, 2e6,  1.5, 'crit+0.01'),
    n('d_mega',  4, 7, '🌋', 'Mega Crit',         '★ Crits pay +25%',                 'd_keen',  100, 2e10, 1.6, 'ocrit*1.25'),
    // Fortune: gold
    n('d_gild',  5, 2, '🌟', 'Gold Rush',         'Golden dice appear 20% more',       'd_crit',  5,  1e3,  3,   'gold+0.2'),
    n('d_alch',  5, 3, '⚗️', 'Gilded Sixes',      'Every 6 rolled pays ×1.2 more',     'd_gild',  30, 1e4,  1.9, 'six*1.2'),
    n('d_midas', 5, 4, '👑', 'Midas',             'Lucky golden dice pay +50%',        'd_alch',  5,  5e4,  3,   'lucky+0.5'),
    n('d_philo', 5, 6, '🪨', "Philosopher's Die", '★ +3 value on every face',          'd_midas', 100, 5e6, 1.6, 'val+3'),
  ],
  coin: [
    n('c_shiny', 2.5, 0, '✨', 'Shiny Coin',      '+1 coin value',                     null,      25, 10,   1.4, 'val+1'),
    n('c_auto',  0.5, 1, '🤖', 'Auto Flip',       'Coins flip by themselves',          'c_shiny', 1,  60,   1,   'auto+1'),
    n('c_weight', 2.5, 1, '⚖️', 'Weighted Coin',  '+1.5% heads chance',                'c_shiny', 10, 150,  1.7, 'head+0.015'),
    n('c_edge',  4.5, 1, '🌀', 'Edge Case',       'Coins land on edge more (pays ×250)', 'c_shiny', 5, 2e3,  3,   'edge+0.002'),
    // Tempo: speed
    n('c_speed', 0, 2, '⏱️', 'Quick Thumb',       'Auto flip 10% faster',              'c_auto',  10, 150,  1.75, 'spd*0.9'),
    n('c_over',  0, 3, '⚡', 'Flick Master',      'Auto flip 15% faster',              'c_speed', 5,  15e3, 4,   'spd*0.85'),
    n('c_flurry', 0, 4, '🌬️', 'Flurry',           '+10% chance a flip pays double',    'c_over',  5,  5e4,  3,   'flurry+0.1'),
    n('c_perp',  0, 5, '♾️', 'Perpetual Flip',    '★ Auto flip 5% faster (min 0.1s)',  'c_flurry', 100, 2e6, 1.8, 'spd*0.95'),
    // Tempo: more coins
    n('c_twin',  1, 2, '🪙', 'Twin Coins',        '+1 coin per flip',                  'c_auto',  4,  600,  9,   'coins+1'),
    n('c_purse', 1, 3, '👛', 'Heavy Purse',       '+2 coin value',                     'c_twin',  10, 6e3,  2,   'val+2'),
    n('c_storm', 1, 5, '🌧️', 'Coin Storm',        '+1 more coin per flip',             'c_purse', 3,  2e6,  8,   'coins+1'),
    n('c_hoard', 1, 7, '🐉', 'Dragon Hoard',      '★ All coin income +15%',           'c_storm', 100, 2e10, 1.6, 'mul*1.15'),
    // Streak: growth
    n('c_pow',   2, 2, '🔥', 'Streak Power',      'Pot grows faster on each heads',    'c_weight', 10, 400, 1.9, 'grow+0.04'),
    n('c_ins',   2, 3, '🛡️', 'Insurance',         'Tails keeps 25% of pot and streak', 'c_pow',   2,  5e3,  6,   'ins+0.25'),
    n('c_net',   2, 4, '🥅', 'Safety Net',        'Tails keeps 15% more',              'c_ins',   2,  1e5,  8,   'ins+0.15'),
    n('c_hot',   2, 6, '🌶️', 'Hot Hand',          '★ Banked pots +15%',               'c_net',   100, 5e6, 1.6, 'hot*1.15'),
    // Streak: length
    n('c_cap',   3, 2, '📈', 'Long Streak',       '+2 max streak',                     'c_weight', 5, 8e3,  3,   'cap+2'),
    n('c_thumb', 3, 3, '👍', 'Lucky Thumb',       '+1% heads chance',                  'c_cap',   10, 3e4,  2,   'head+0.01'),
    n('c_legend', 3, 5, '🏆', 'Legendary Run',    '+1 max streak',                     'c_thumb', 20, 2e6,  2.2, 'cap+1'),
    n('c_moment', 3, 7, '🌊', 'Momentum',         '★ Pot growth +0.01',                'c_legend', 100, 2e10, 1.8, 'grow+0.01'),
    // Rarity: value
    n('c_mint',  4, 2, '🏛️', 'Mint Grade',        'Coins pay ×2 (better metal)',       'c_edge',  7,  5e4,  10,  'mul*2'),
    n('c_press', 4, 3, '🗜️', 'Coin Press',        'Banked pots pay +25%',              'c_mint',  10, 3e4,  2.5, 'bank+0.25'),
    n('c_rush',  4, 5, '🚀', 'Proof Strike',      '★ All coin income +15%',           'c_press', 100, 3e7, 1.6, 'mul*1.15'),
    // Rarity: edges
    n('c_razor', 5, 2, '🔪', 'Razor Edge',        'Edge landings pay +100×',           'c_edge',  5,  1e4,  3,   'edgex+100'),
    n('c_spin',  5, 3, '🌪️', 'Spin Doctor',       '+0.1% edge chance',                 'c_razor', 20, 3e4,  1.8, 'edge+0.001'),
    n('c_rim',   5, 5, '💍', 'Golden Rim',        'Edge landings pay ×2',              'c_spin',  5,  2e6,  5,   'edgem*2'),
    n('c_lord',  5, 7, '🗿', 'Edge Lord',         '★ +0.05% edge chance',              'c_rim',   100, 2e10, 1.6, 'edge+0.0005'),
  ],
  cards: [
    n('k_sharp', 2.5, 0, '🃏', 'Card Sharp',      '+25% card value',                   null,      25, 25,   1.4, 'valp+0.25'),
    n('k_auto',  0.5, 1, '🤖', 'Auto Deal',       'Hands deal themselves',             'k_sharp', 1,  150,  1,   'auto+1'),
    n('k_power', 2.5, 1, '🔥', 'Hand Power',      '+25% hand bonus',                   'k_sharp', 10, 400,  1.9, 'power+0.25'),
    n('k_thin',  4.5, 1, '✂️', 'Thin Deck',       'Remove the lowest rank from deck',  'k_sharp', 4,  2e3,  6,   'thin+1'),
    // Tempo: speed
    n('k_speed', 0, 2, '⏱️', 'Fast Dealer',       'Auto deal 10% faster',              'k_auto',  10, 300,  1.75, 'spd*0.9'),
    n('k_over',  0, 3, '⚡', 'Card Shark',        'Auto deal 15% faster',              'k_speed', 5,  3e4,  4,   'spd*0.85'),
    n('k_riffle', 0, 4, '🌀', 'Riffle',           '+10% chance a hand pays double',    'k_over',  5,  8e4,  3,   'flurry+0.1'),
    n('k_perp',  0, 5, '♾️', 'Perpetual Deal',    '★ Auto deal 5% faster (min 0.1s)',  'k_riffle', 100, 4e6, 1.8, 'spd*0.95'),
    // Tempo: draws
    n('k_extra', 1, 2, '➕', 'Extra Card',        'Deal +1 card, best 5 count',        'k_auto',  2,  5e3,  25,  'extra+1'),
    n('k_draw',  1, 3, '🔄', 'Second Draw',       '+1 draw per hand',                  'k_extra', 1,  5e4,  1,   'draws+1'),
    n('k_second', 1, 4, '👀', 'Second Look',      '+8% chance to deal twice, keep best', 'k_draw', 10, 1e5, 1.9, 'second+0.08'),
    n('k_third', 1, 6, '🔁', 'Third Draw',        '+1 draw per hand',                  'k_second', 1, 5e7,  1,   'draws+1'),
    n('k_house', 1, 8, '🏠', 'House Edge',        '★ All card income +15%',           'k_third', 100, 5e10, 1.6, 'mul*1.15'),
    // Hands: big hands
    n('k_royal', 2, 2, '👑', 'Royal Treatment',   'Straights and better pay +100%',    'k_power', 5,  2e4,  4,   'royal+1'),
    n('k_grand', 2, 3, '🎩', 'High Roller',       'Straights and better ×1.15',        'k_royal', 30, 1e5,  1.75, 'grand*1.15'),
    n('k_fever', 2, 5, '♥️', 'Flush Fever',       'Flushes pay ×2',                    'k_grand', 5,  3e6,  4,   'flushm*2'),
    n('k_court', 2, 7, '🏰', 'Royal Court',       '★ Straights and better +20%',       'k_fever', 100, 3e10, 1.6, 'grand*1.2'),
    // Hands: small hands
    n('k_pairs', 3, 2, '👯', 'Pair Bonus',        'Pairs, Two Pair, Trips pay +50%',   'k_power', 5,  1500, 3,   'pairs+0.5'),
    n('k_bread', 3, 3, '🍞', 'Bread & Butter',    'Pairs, Two Pair, Trips ×1.15',      'k_pairs', 30, 1e5,  1.75, 'bread*1.15'),
    n('k_sets',  3, 5, '🎲', 'Set Collector',     'Trips and Full Houses ×2',          'k_bread', 5,  3e6,  4,   'setm*2'),
    n('k_grind', 3, 7, '⚙️', 'The Grind',         '★ Pairs, Two Pair, Trips +20%',     'k_sets',  100, 3e10, 1.6, 'bread*1.2'),
    // Deck: stock
    n('k_foil',  4, 2, '🌈', 'Foil Cards',        'Cards pay ×2 (shinier stock)',      'k_thin',  7,  1e5,  10,  'mul*2'),
    n('k_holo',  4, 4, '💿', 'Holo Foil',         'Cards pay ×3',                      'k_foil',  3,  1e7,  15,  'mul*3'),
    n('k_rush',  4, 6, '🚀', 'Card Rush',         '★ All card income +15%',           'k_holo',  100, 1e8, 1.6, 'mul*1.15'),
    // Deck: shape
    n('k_suit',  5, 2, '♠️', 'Suit Purge',        'Remove a whole suit (more flushes)', 'k_thin', 1,  5e4,  1,   'suit+1'),
    n('k_face',  5, 3, '🤴', 'Face Value',        'J, Q, K, A worth +25%',             'k_suit',  30, 3e4,  1.6, 'face+0.25'),
    n('k_ace',   5, 5, '🅰️', 'Ace High',          'Aces count as 25',                  'k_face',  1,  5e6,  1,   'ace+11'),
    n('k_crown', 5, 7, '💎', 'Crown Jewels',      '★ J, Q, K, A worth +50%',           'k_ace',   100, 2e10, 1.7, 'face+0.5'),
  ],
  slots: [
    n('s_bet',   2.5, 0, '🪙', 'Bigger Bet',      '+1 bet per spin',                   null,      25, 10,   1.4, 'val+1'),
    n('s_auto',  0.5, 1, '🤖', 'Auto Spin',       'Reels spin by themselves',          's_bet',   1,  60,   1,   'auto+1'),
    n('s_reel',  2.5, 1, '🎞️', 'Fourth Reel',     '+1 reel (longer lines)',            's_bet',   1,  5e3,  1,   'reels+1'),
    n('s_wild',  4.5, 1, '🃏', 'Wild Card',       '+1 wild 🃏 on every reel',          's_bet',   5,  800,  4,   'wild+1'),
    // Tempo: speed
    n('s_speed', 0, 2, '⏱️', 'Quick Pull',        'Auto spin 10% faster',              's_auto',  10, 150,  1.75, 'spd*0.9'),
    n('s_over',  0, 3, '⚡', 'Hair Trigger',      'Auto spin 15% faster',              's_speed', 5,  15e3, 4,   'spd*0.85'),
    n('s_turbo', 0, 4, '🌀', 'Turbo Spin',        '+10% chance a spin pays double',    's_over',  5,  5e4,  3,   'flurry+0.1'),
    n('s_perp',  0, 5, '♾️', 'Perpetual Reels',   '★ Auto spin 5% faster (min 0.1s)',  's_turbo', 100, 2e6, 1.8, 'spd*0.95'),
    // Tempo: lines
    n('s_line',  1, 2, '〰️', 'More Lines',        '+2 paylines (max 5)',               's_auto',  2,  2e3,  20,  'lines+2'),
    n('s_near',  1, 3, '🤏', 'Near Miss',         'Two-in-a-row pays +50%',            's_line',  10, 5e3,  2,   'pair+0.5'),
    n('s_multi', 1, 5, '🧮', 'Line Combo',        'Each extra winning line ×1.25',     's_near',  10, 3e6,  2.2, 'lcomb+0.25'),
    n('s_mega',  1, 7, '📺', 'Mega Lines',        '★ All slot income +15%',           's_multi', 100, 2e10, 1.6, 'mul*1.15'),
    // Reels: long matches
    n('s_long',  2, 2, '📏', 'Long Shot',         '4+ in a row pays ×2',               's_reel',  5,  5e3,  4,   'longm*2'),
    n('s_reel5', 2, 3, '🎬', 'Fifth Reel',        '+1 reel',                           's_long',  1,  2e5,  1,   'reels+1'),
    n('s_five',  2, 5, '🖐️', 'Five Alive',        '5 in a row pays ×3',                's_reel5', 5,  5e6,  5,   'fivem*3'),
    n('s_prog',  2, 7, '7️⃣', 'Progressive',       '★ 7️⃣ lines +20%',                   's_five',  100, 2e10, 1.6, 'seven*1.2'),
    // Reels: symbols
    n('s_fruit', 3, 2, '🍒', 'Fruit Salad',       '🍒🍋🔔 pay +50%',                   's_reel',  10, 600,  2,   'low+0.5'),
    n('s_cherry', 3, 3, '💣', 'Cherry Bomb',      'A 🍒 starting a line pays 1× bet',  's_fruit', 10, 1e4,  2.2, 'cherry+1'),
    n('s_high',  3, 5, '💎', 'High Rollers',      '⭐💎7️⃣ pay +50%',                    's_cherry', 20, 2e6, 2,   'high+0.5'),
    n('s_glit',  3, 7, '✨', 'Glitter',           '★ All symbols pay +25%',            's_high',  100, 2e10, 1.7, 'sym+0.25'),
    // Wilds
    n('s_wildx', 4, 2, '✖️', 'Wild Multiplier',   'Wins with a wild pay ×2',           's_wild',  5,  5e3,  4,   'wildm*2'),
    n('s_expand', 4, 4, '↕️', 'Expanding Wild',   'Wilds fill their whole reel',       's_wildx', 1,  5e5,  1,   'expand+1'),
    n('s_rush',  4, 6, '🚀', 'Jackpot Rush',      '★ All slot income +15%',           's_expand', 100, 5e7, 1.6, 'mul*1.15'),
    // Scatters
    n('s_scat',  5, 2, '💠', 'Scatter',           '+1 scatter 💠 per reel (3+ = free spins)', 's_wild', 5, 3e3, 3, 'scatter+1'),
    n('s_free',  5, 3, '🎁', 'Free Spins',        '+3 free spins per trigger',         's_scat',  10, 3e4,  2,   'freen+3'),
    n('s_bonus', 5, 5, '🎊', 'Bonus Round',       'Free spins pay +1×',                's_free',  10, 3e6,  2.5, 'freem+1'),
    n('s_retrig', 5, 7, '🔂', 'Retrigger',        '★ Free spins pay +15%',            's_bonus', 100, 2e10, 1.6, 'freex*1.15'),
  ],
  plinko: [
    n('l_drop',  2.5, 0, '💧', 'Heavier Drops',   '+1 ball value',                     null,      25, 10,   1.4, 'val+1'),
    n('l_auto',  0.5, 1, '🤖', 'Auto Drop',       'Balls drop by themselves',          'l_drop',  1,  60,   1,   'auto+1'),
    n('l_ball',  2.5, 1, '🔵', 'Extra Ball',      '+1 ball per drop',                  'l_drop',  4,  400,  8,   'balls+1'),
    n('l_rows',  4.5, 1, '📐', 'Taller Board',    '+2 rows (edges pay more)',          'l_drop',  4,  2e3,  12,  'rows+2'),
    // Tempo: speed
    n('l_speed', 0, 2, '⏱️', 'Quick Release',     'Auto drop 10% faster',              'l_auto',  10, 150,  1.75, 'spd*0.9'),
    n('l_over',  0, 3, '⚡', 'Gravity Well',      'Auto drop 15% faster',              'l_speed', 5,  15e3, 4,   'spd*0.85'),
    n('l_rain',  0, 4, '🌧️', 'Downpour',          '+10% chance a drop pays double',    'l_over',  5,  5e4,  3,   'flurry+0.1'),
    n('l_perp',  0, 5, '♾️', 'Perpetual Rain',    '★ Auto drop 5% faster (min 0.1s)',  'l_rain',  100, 2e6, 1.8, 'spd*0.95'),
    // Tempo: more balls
    n('l_split', 1, 2, '✂️', 'Splitter',          '+5% chance a ball splits in two',   'l_auto',  10, 1500, 2,   'split+0.05'),
    n('l_bouncy', 1, 3, '🏀', 'Bouncy Balls',     '+0.5 value per board row',          'l_split', 10, 1e4,  2,   'rowv+0.5'),
    n('l_pit',   1, 5, '🫧', 'Ball Pit',          '+1 ball per drop',                  'l_bouncy', 4, 3e6,  8,   'balls+1'),
    n('l_flood', 1, 7, '🌊', 'Flood',             '★ All plinko income +15%',         'l_pit',   100, 2e10, 1.6, 'mul*1.15'),
    // Board: edges
    n('l_tilt',  2, 2, '↗️', 'Tilt Table',        '+3% tilt strength',                 'l_ball',  5,  500,  3,   'tiltp+0.03'),
    n('l_magnet', 2, 3, '🧲', 'Edge Magnet',      'Edge buckets ×1.5',                 'l_tilt',  10, 2e4,  2.2, 'edgem*1.5'),
    n('l_extreme', 2, 5, '🎢', 'Extremes',        'Outer 2 buckets each side ×2',      'l_magnet', 5, 5e6,  4,   'outerm*2'),
    n('l_abyss', 2, 7, '🕳️', 'Abyss',             '★ Edge buckets +25%',              'l_extreme', 100, 2e10, 1.6, 'edgem*1.25'),
    // Board: centre
    n('l_safe',  3, 2, '🛟', 'Safe Zone',         'Middle 3 buckets +0.5×',            'l_ball',  10, 600,  2,   'centera+0.5'),
    n('l_wide',  3, 3, '🪣', 'Wide Buckets',      'All buckets +10%',                  'l_safe',  20, 2e4,  1.8, 'bkt+0.1'),
    n('l_crowd', 3, 5, '👥', 'Crowd Bonus',       'Balls sharing a bucket +50% each',  'l_wide',  10, 2e6,  2.2, 'same+0.5'),
    n('l_echo',  3, 7, '🔁', 'Echo Drop',         '★ +2% chance a ball drops again',   'l_crowd', 50, 2e10, 1.6, 'redrop+0.02'),
    // Gold: golden pegs
    n('l_gpeg',  4, 2, '🟡', 'Golden Pegs',       '1% per bounce: ball ×2',            'l_rows',  10, 3e3,  2.2, 'gpeg+0.01'),
    n('l_leaf',  4, 3, '🍂', 'Gold Leaf',         'Golden pegs pay +1×',               'l_gpeg',  5,  5e4,  3,   'gpm+1'),
    n('l_glow',  4, 5, '🔆', 'Gold Glow',         '+0.5% golden pegs',                 'l_leaf',  20, 3e6,  1.8, 'gpeg+0.005'),
    n('l_midas', 4, 7, '👑', 'Midas Board',       '★ Golden hits +5% each',           'l_glow',  100, 2e10, 1.6, 'gpx*1.05'),
    // Gold: value
    n('l_polish', 5, 2, '✨', 'Bucket Polish',    'Plinko pays ×2',                    'l_rows',  7,  5e4,  10,  'mul*2'),
    n('l_prism', 5, 4, '🔷', 'Prism',             'Plinko pays ×3',                    'l_polish', 3, 1e7,  15,  'mul*3'),
    n('l_rush',  5, 6, '🚀', 'Plinko Rush',       '★ All plinko income +15%',         'l_prism', 100, 1e8, 1.6, 'mul*1.15'),
  ],
};

// Rebirth trees, bought with that game's ✦ Essence; never reset.
const rb = (p, a, b) => [
  n(p + 'r_inc',   2.5, 0, '🌱', 'Inheritance',  'Income ×1.5',                          null,        100, 1,  1.4, 'mul*1.5'),
  n(p + 'r_auto',  0.5, 1, '🤖', 'Muscle Memory', 'Start every run with Auto',           p + 'r_inc', 1,   2,  1,   'auto+1'),
  n(p + 'r_ess',   2.5, 1, '🔮', 'Essence Well', '+25% essence from rebirth',            p + 'r_inc', 20,  3,  1.6, 'essm+0.25'),
  n(p + 'r_disc',  4.5, 1, '🏷️', 'Bargain',      'Main upgrades 10% cheaper',            p + 'r_inc', 10,  2,  1.7, 'disc*0.9'),
  n(p + 'r_spd',   0,   2, '⏱️', 'Reflexes',     'Auto 10% faster',                      p + 'r_auto', 10, 3,  1.8, 'spd*0.9'),
  n(p + 'r_start', 1,   2, '💰', 'Nest Egg',     'Start runs with 100×10^lvl',           p + 'r_auto', 5,  2,  2.5, 'start+1'),
  n(p + 'r_stage', 2.5, 2, '🪜', 'Ladder Climber', 'Stage bonus +2% per stage',          p + 'r_ess', 10,  5,  2,   'stg+0.02'),
  n(...a(4, 2, p + 'r_disc')),
  n(...b(5, 2, p + 'r_disc')),
  n(p + 'r_legacy', 2.5, 3, '🏛️', 'Legacy',       '★ Income ×2',                          p + 'r_stage', 100, 50, 2, 'mul*2'),
];
export const RTREES = {
  dice:   rb('d', (x, y, r) => ['dr_die', x, y, '🎲', 'Ancestral Die', '+1 die', r, 2, 10, 5, 'dice+1'],
              (x, y, r) => ['dr_crit', x, y, '🍀', 'Born Lucky', '+5% crit chance', r, 5, 5, 2, 'crit+0.05']),
  coin:   rb('c', (x, y, r) => ['cr_head', x, y, '⚖️', 'Loaded Coin', '+3% heads chance', r, 5, 5, 2, 'head+0.03'],
              (x, y, r) => ['cr_cap', x, y, '📈', 'Endless Streak', '+3 max streak', r, 5, 5, 2, 'cap+3']),
  cards:  rb('k', (x, y, r) => ['kr_extra', x, y, '➕', 'Sleight', '+1 card dealt', r, 1, 15, 1, 'extra+1'],
              (x, y, r) => ['kr_draw', x, y, '🔄', 'Mulligan', '+1 draw per hand', r, 1, 20, 1, 'draws+1']),
  slots:  rb('s', (x, y, r) => ['sr_wild', x, y, '🃏', 'Lucky Charm', '+1 wild per reel', r, 3, 8, 3, 'wild+1'],
              (x, y, r) => ['sr_scat', x, y, '💠', 'Scatter Brain', '+1 scatter per reel', r, 3, 8, 3, 'scatter+1']),
  plinko: rb('l', (x, y, r) => ['lr_ball', x, y, '🔵', 'Ball Bearing', '+1 ball per drop', r, 3, 8, 3, 'balls+1'],
              (x, y, r) => ['lr_gold', x, y, '🟡', 'Gilded Board', '+1% golden pegs', r, 5, 5, 2, 'gpeg+0.01']),
};
