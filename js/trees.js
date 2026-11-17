// Upgrade tree data. x = column 0..4, y = row. A node unlocks when ANY parent in `req` has a level.
// Cost of next level = cost * k^level. Effects are read by id in game.js.
const n = (id, x, y, icon, name, desc, req, max, cost, k) => ({ id, x, y, icon, name, desc, req, max, cost, k });

export const TREES = {
  dice: [
    n('d_pip',   2, 0, '⚀', 'Pip Polish',     '+1 value on every face',            [],                  25, 10,    1.4),
    n('d_auto',  1, 1, '🤖', 'Auto Roll',      'Dice roll by themselves',           ['d_pip'],           1,  60,    1),
    n('d_die',   3, 1, '🎲', 'Extra Die',      '+1 die (bigger sums, combos)',      ['d_pip'],           4,  250,   10),
    n('d_speed', 0, 2, '⏱️', 'Quick Hands',    'Auto roll 10% faster',              ['d_auto'],          10, 150,   1.75),
    n('d_crit',  2, 2, '🎯', 'Lucky Streak',   '+2% crit chance',                   ['d_auto', 'd_die'], 15, 250,   1.6),
    n('d_combo', 4, 2, '🔥', 'Combo Power',    '+25% combo bonus',                  ['d_die'],           10, 400,   1.9),
    n('d_over',  0, 3, '⚡', 'Overclock',      'Auto roll 15% faster',              ['d_speed'],         5,  15e3,  4),
    n('d_critx', 2, 3, '💥', 'Heavy Hitter',   '+0.5× crit payout',                 ['d_crit'],          10, 1500,  2.6),
    n('d_load',  3, 3, '🧲', 'Loaded Dice',    'Lowest die rerolls (keeps best)',   ['d_die'],           3,  3e3,   6),
    n('d_jack',  4, 3, '🎰', 'Jackpot Hunter', 'JACKPOT pays ×2',                   ['d_combo'],         5,  2e4,   6),
    n('d_mat',   1, 4, '💎', 'Materials',      'Dice pay ×2 (new material)',        ['d_over', 'd_critx'], 7, 5e4, 10),
    n('d_six',   3, 4, '✨', 'Sixth Die',      '+1 more die',                       ['d_load'],          1,  1e6,   1),
    n('d_rush',  2, 5, '🚀', 'Dice Rush',      'All dice income ×1.15',             ['d_mat', 'd_six'],  100, 3e5,  1.7),
  ],
  coin: [
    n('c_shiny', 2, 0, '✨', 'Shiny Coin',     '+1 coin value',                     [],                  25, 10,    1.4),
    n('c_auto',  1, 1, '🤖', 'Auto Flip',      'Coins flip by themselves',          ['c_shiny'],         1,  60,    1),
    n('c_weight',3, 1, '⚖️', 'Weighted Coin',  '+1.5% heads chance',                ['c_shiny'],         10, 150,   1.7),
    n('c_speed', 0, 2, '⏱️', 'Quick Thumb',    'Auto flip 10% faster',              ['c_auto'],          10, 150,   1.75),
    n('c_pow',   2, 2, '🔥', 'Streak Power',   'Each heads in a row pays more',     ['c_auto', 'c_weight'], 10, 400, 1.9),
    n('c_twin',  4, 2, '🪙', 'Twin Coins',     '+1 coin per flip',                  ['c_weight'],        4,  600,   9),
    n('c_over',  0, 3, '⚡', 'Flick Master',   'Auto flip 15% faster',              ['c_speed'],         5,  15e3,  4),
    n('c_ins',   2, 3, '🛡️', 'Insurance',      'Tails keeps 25% of your streak',    ['c_pow'],           2,  5e3,   6),
    n('c_cap',   3, 3, '📈', 'Long Streak',    '+2 max streak',                     ['c_pow'],           5,  8e3,   3),
    n('c_edge',  4, 3, '🌀', 'Edge Case',      'Coin lands on edge more (×250)',    ['c_twin'],          5,  2e4,   3),
    n('c_mint',  1, 4, '🏛️', 'Mint Grade',     'Coins pay ×2 (better metal)',       ['c_over', 'c_ins'], 7,  5e4,   10),
    n('c_rush',  2, 5, '🚀', 'Coin Rush',      'All coin income ×1.15',             ['c_mint', 'c_cap'], 100, 3e5,  1.7),
  ],
  cards: [
    n('k_sharp', 2, 0, '🃏', 'Card Sharp',     '+25% card value',                   [],                  25, 25,    1.4),
    n('k_auto',  1, 1, '🤖', 'Auto Deal',      'Hands deal themselves',             ['k_sharp'],         1,  150,   1),
    n('k_power', 3, 1, '🔥', 'Hand Power',     '+25% hand bonus',                   ['k_sharp'],         10, 400,   1.9),
    n('k_speed', 0, 2, '⏱️', 'Fast Dealer',    'Auto deal 10% faster',              ['k_auto'],          10, 300,   1.75),
    n('k_extra', 2, 2, '➕', 'Extra Card',     'Deal +1 card, best 5 count',        ['k_auto', 'k_power'], 2, 5e3,  25),
    n('k_thin',  4, 2, '✂️', 'Thin Deck',      'Remove the lowest rank from deck',  ['k_power'],         4,  2e3,   6),
    n('k_over',  0, 3, '⚡', 'Card Shark',     'Auto deal 15% faster',              ['k_speed'],         5,  3e4,   4),
    n('k_royal', 4, 3, '👑', 'Royal Treatment','Straights and better pay +100%',    ['k_thin'],          5,  2e4,   4),
    n('k_foil',  1, 4, '🌈', 'Foil Cards',     'Cards pay ×2 (shinier stock)',      ['k_over', 'k_extra'], 7, 1e5,  10),
    n('k_rush',  2, 5, '🚀', 'Card Rush',      'All card income ×1.15',             ['k_foil', 'k_royal'], 100, 6e5, 1.7),
  ],
  // Bought with chips; never reset.
  perm: [
    n('p_bonus', 1, 0, '🎰', 'Chip Bonus',     '+10% all income',                   [],                  100, 1,    1.25),
    n('p_coin',  3, 0, '🪙', 'Coinflip Table', 'Unlock the Coinflip game',          [],                  1,  3,     1),
    n('p_off',   0, 1, '🌙', 'Offline Vault',  '+2h offline earnings cap',          ['p_bonus'],         5,  2,     2),
    n('p_head',  1, 1, '💰', 'Head Start',     'Start runs with gold',              ['p_bonus'],         5,  2,     2.5),
    n('p_gold',  2, 1, '🌟', 'Golden Touch',   'Golden dice appear 25% more',       ['p_bonus'],         4,  3,     2),
    n('p_autop', 3, 1, '🛠️', 'Auto Pilot',     'Start runs with every Auto owned',  ['p_coin'],          1,  6,     1),
    n('p_cards', 4, 1, '🃏', 'Card Table',     'Unlock the Cards game',             ['p_coin'],          1,  12,    1),
    n('p_disc',  1, 2, '🏷️', 'Discount',       'Gold upgrades cost 5% less',        ['p_head'],          10, 5,     1.6),
  ],
};
