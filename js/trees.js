// Upgrade tree data. x = column (fractions ok), y = row. A node unlocks when ANY parent in `req` has a level.
// Each game tree: root → 3 branches → 2 paths each, every path ends in its own capstone (★). No paths merge.
// Cost of next level = cost * k^level. Effects are read by id in game.js.
const n = (id, x, y, icon, name, desc, req, max, cost, k) => ({ id, x, y, icon, name, desc, req, max, cost, k });

export const TREES = {
  dice: [
    n('d_pip',   2.5, 0, '⚀', 'Pip Polish',      '+1 value on every face',              [],          25, 10,   1.4),
    // Tempo
    n('d_auto',  0.5, 1, '🤖', 'Auto Roll',       'Dice roll by themselves',             ['d_pip'],   1,  60,   1),
    n('d_speed', 0,   2, '⏱️', 'Quick Hands',     'Auto roll 10% faster',                ['d_auto'],  10, 150,  1.75),
    n('d_over',  0,   3, '⚡', 'Overclock',       'Auto roll 15% faster',                ['d_speed'], 5,  15e3, 4),
    n('d_perp',  0,   4, '♾️', 'Perpetual Motion', '★ Auto roll 5% faster (min 0.1s)',   ['d_over'],  100, 2e5, 1.8),
    n('d_echo',  1,   2, '🔁', 'Echo Roll',       '+4% chance a roll pays twice',        ['d_auto'],  10, 800,  1.9),
    n('d_reson', 1,   3, '🔔', 'Resonance',       '★ Echoes pay +1× more',               ['d_echo'],  100, 1.5e4, 1.7),
    // Dice
    n('d_die',   2.5, 1, '🎲', 'Extra Die',       '+1 die (bigger sums, combos)',        ['d_pip'],   4,  250,  10),
    n('d_combo', 2,   2, '🔥', 'Combo Power',     '+25% combo bonus',                    ['d_die'],   10, 400,  1.9),
    n('d_jack',  2,   3, '🎰', 'Jackpot Hunter',  'JACKPOT pays ×2',                     ['d_combo'], 5,  2e4,  6),
    n('d_fate',  2,   4, '🔮', 'Fated Combos',    '★ All combo bonuses ×1.15',           ['d_jack'],  100, 2e5, 1.75),
    n('d_load',  3,   2, '🧲', 'Loaded Dice',     'Lowest die rerolls (keeps best)',     ['d_die'],   3,  3e3,  6),
    n('d_six',   3,   3, '✨', 'Sixth Die',       '+1 more die',                         ['d_load'],  1,  1e6,  1),
    n('d_rush',  3,   4, '🚀', 'Dice Rush',       '★ All dice income ×1.15',             ['d_six'],   100, 3e5, 1.7),
    // Fortune
    n('d_crit',  4.5, 1, '🎯', 'Lucky Streak',    '+2% crit chance',                     ['d_pip'],   15, 250,  1.6),
    n('d_critx', 4,   2, '💥', 'Heavy Hitter',    '+0.5× crit payout',                   ['d_crit'],  10, 1500, 2.6),
    n('d_mat',   4,   3, '💎', 'Materials',       'Dice pay ×2 (new material)',          ['d_critx'], 7,  5e4,  10),
    n('d_ocrit', 4,   4, '☄️', 'Overcrit',        '★ Crit payout ×1.2',                  ['d_mat'],   100, 2e5, 1.8),
    n('d_gild',  5,   2, '🌟', 'Gold Rush',       'Golden dice appear 20% more',         ['d_crit'],  5,  1e3,  3),
    n('d_alch',  5,   3, '⚗️', 'Gilded Sixes',    '★ Every 6 rolled pays ×1.2 more',     ['d_gild'],  100, 1e4, 1.75),
  ],
  coin: [
    n('c_shiny', 2.5, 0, '✨', 'Shiny Coin',      '+1 coin value',                       [],          25, 10,   1.4),
    // Tempo
    n('c_auto',  0.5, 1, '🤖', 'Auto Flip',       'Coins flip by themselves',            ['c_shiny'], 1,  60,   1),
    n('c_speed', 0,   2, '⏱️', 'Quick Thumb',     'Auto flip 10% faster',                ['c_auto'],  10, 150,  1.75),
    n('c_over',  0,   3, '⚡', 'Flick Master',    'Auto flip 15% faster',                ['c_speed'], 5,  15e3, 4),
    n('c_perp',  0,   4, '♾️', 'Perpetual Flip',  '★ Auto flip 5% faster (min 0.1s)',    ['c_over'],  100, 2e5, 1.8),
    n('c_twin',  1,   2, '🪙', 'Twin Coins',      '+1 coin per flip',                    ['c_auto'],  4,  600,  9),
    n('c_storm', 1,   3, '🌧️', 'Coin Storm',      '★ +1 more coin per flip',             ['c_twin'],  6,  1e5,  5),
    // Streak
    n('c_weight', 2.5, 1, '⚖️', 'Weighted Coin',  '+1.5% heads chance',                  ['c_shiny'], 10, 150,  1.7),
    n('c_pow',   2,   2, '🔥', 'Streak Power',    'Each heads in a row pays more',       ['c_weight'], 10, 400, 1.9),
    n('c_ins',   2,   3, '🛡️', 'Insurance',       'Tails keeps 25% of your streak',      ['c_pow'],   2,  5e3,  6),
    n('c_hot',   2,   4, '🌶️', 'Hot Hand',        '★ Heads pay ×1.15',                   ['c_ins'],   100, 2e5, 1.75),
    n('c_cap',   3,   2, '📈', 'Long Streak',     '+2 max streak',                       ['c_weight'], 5, 8e3,  3),
    n('c_legend', 3,  3, '🏆', 'Legendary Run',   '★ +1 max streak',                     ['c_cap'],   100, 1e5, 2.2),
    // Rarity
    n('c_edge',  4.5, 1, '🌀', 'Edge Case',       'Coin lands on edge more (×250)',      ['c_shiny'], 5,  2e3,  3),
    n('c_mint',  4,   2, '🏛️', 'Mint Grade',      'Coins pay ×2 (better metal)',         ['c_edge'],  7,  5e4,  10),
    n('c_rush',  4,   3, '🚀', 'Proof Strike',    '★ All coin income ×1.15',             ['c_mint'],  100, 3e5, 1.7),
    n('c_razor', 5,   2, '🔪', 'Razor Edge',      'Edge landings pay +100×',             ['c_edge'],  5,  1e4,  3),
    n('c_spin',  5,   3, '🌪️', 'Spin Doctor',     '★ +0.1% edge chance',                 ['c_razor'], 50, 3e4,  1.6),
  ],
  cards: [
    n('k_sharp', 2.5, 0, '🃏', 'Card Sharp',      '+25% card value',                     [],          25, 25,   1.4),
    // Tempo
    n('k_auto',  0.5, 1, '🤖', 'Auto Deal',       'Hands deal themselves',               ['k_sharp'], 1,  150,  1),
    n('k_speed', 0,   2, '⏱️', 'Fast Dealer',     'Auto deal 10% faster',                ['k_auto'],  10, 300,  1.75),
    n('k_over',  0,   3, '⚡', 'Card Shark',      'Auto deal 15% faster',                ['k_speed'], 5,  3e4,  4),
    n('k_perp',  0,   4, '♾️', 'Perpetual Deal',  '★ Auto deal 5% faster (min 0.1s)',    ['k_over'],  100, 4e5, 1.8),
    n('k_extra', 1,   2, '➕', 'Extra Card',      'Deal +1 card, best 5 count',          ['k_auto'],  2,  5e3,  25),
    n('k_second', 1,  3, '👀', 'Second Look',     '★ +8% chance to deal twice, keep best', ['k_extra'], 12, 2e4, 1.9),
    // Hands
    n('k_power', 2.5, 1, '🔥', 'Hand Power',      '+25% hand bonus',                     ['k_sharp'], 10, 400,  1.9),
    n('k_royal', 2,   2, '👑', 'Royal Treatment', 'Straights and better pay +100%',      ['k_power'], 5,  2e4,  4),
    n('k_grand', 2,   3, '🎩', 'High Roller',     '★ Straights and better ×1.15',        ['k_royal'], 100, 2e5, 1.75),
    n('k_pairs', 3,   2, '👯', 'Pair Bonus',      'Pairs, Two Pair, Trips pay +50%',     ['k_power'], 5,  1500, 3),
    n('k_bread', 3,   3, '🍞', 'Bread & Butter',  '★ Pairs, Two Pair, Trips ×1.15',      ['k_pairs'], 100, 1e5, 1.75),
    // Deck
    n('k_thin',  4.5, 1, '✂️', 'Thin Deck',       'Remove the lowest rank from deck',    ['k_sharp'], 4,  2e3,  6),
    n('k_foil',  4,   2, '🌈', 'Foil Cards',      'Cards pay ×2 (shinier stock)',        ['k_thin'],  7,  1e5,  10),
    n('k_rush',  4,   3, '🚀', 'Card Rush',       '★ All card income ×1.15',             ['k_foil'],  100, 6e5, 1.7),
    n('k_suit',  5,   2, '♠️', 'Suit Purge',      'Remove a whole suit (more flushes)',  ['k_thin'],  1,  5e4,  1),
    n('k_face',  5,   3, '🤴', 'Face Value',      '★ J, Q, K, A worth +25% more',        ['k_suit'],  100, 3e4, 1.6),
  ],
  // Bought with chips; never reset.
  perm: [
    n('p_bonus', 1,   0, '🎰', 'Chip Bonus',      '+10% all income',                     [],          100, 1,   1.25),
    n('p_coin',  4,   0, '🪙', 'Coinflip Table',  'Unlock the Coinflip game',            [],          1,  3,    1),
    n('p_off',   0,   1, '🌙', 'Offline Vault',   '+2h offline earnings cap',            ['p_bonus'], 5,  2,    2),
    n('p_offx',  0,   2, '🛌', 'Night Shift',     'Offline earnings +25%',               ['p_off'],   8,  4,    1.8),
    n('p_head',  1,   1, '💰', 'Head Start',      'Start runs with gold',                ['p_bonus'], 5,  2,    2.5),
    n('p_disc',  1,   2, '🏷️', 'Discount',        'Gold upgrades cost 5% less',          ['p_head'],  10, 5,    1.6),
    n('p_gold',  2,   1, '🌟', 'Golden Touch',    'Golden dice appear 25% more',         ['p_bonus'], 4,  3,    2),
    n('p_chipx', 2,   2, '🎲', 'High Stakes',     '+10% chips from prestige',            ['p_gold'],  10, 8,    1.7),
    n('p_autop', 3.5, 1, '🛠️', 'Auto Pilot',      'Start runs with every Auto owned',    ['p_coin'],  1,  6,    1),
    n('p_cards', 4.5, 1, '🃏', 'Card Table',      'Unlock the Cards game',               ['p_coin'],  1,  12,   1),
  ],
};
