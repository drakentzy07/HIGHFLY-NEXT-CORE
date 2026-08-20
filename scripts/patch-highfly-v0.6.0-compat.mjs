import fs from 'node:fs';

const path = 'tests/highfly_training.test.ts';
const before = fs.readFileSync(path, 'utf8');
const needle = '    const state = sim.serializeCharacter();';
if (!before.includes(needle)) throw new Error('HIGHFLY v0.6 serialize test anchor not found');
const after = before.replace(needle, '    const state = sim.serializeCharacter(sim.playerId)!;');
fs.writeFileSync(path, after, 'utf8');
console.log('[HIGHFLY v0.6.0] serialize test compatibility fix applied.');
