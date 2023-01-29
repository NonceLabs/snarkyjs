import { Field } from './field-bigint.js';
import { expect } from 'expect';
import { shutdown } from '../snarky.js';
import { bytesToBigInt, bigIntToBytes } from '../js_crypto/bigint-helpers.js';

function testBigintRoundtrip(x: bigint, size: number) {
  let bytes = bigIntToBytes(x, size);
  let x1 = bytesToBigInt(bytes);
  expect(x1).toEqual(x);
}
let fieldSize = Field.sizeInBytes();

testBigintRoundtrip(BigInt(0), 1);
testBigintRoundtrip(BigInt(0), fieldSize);
testBigintRoundtrip(BigInt(56), 2);
testBigintRoundtrip(BigInt(40), fieldSize);
testBigintRoundtrip(BigInt(1309180), fieldSize);
testBigintRoundtrip(BigInt(0x10000000), 4);
testBigintRoundtrip(BigInt(0xffffffff), 4);
testBigintRoundtrip(BigInt(0x10ff00ffff), fieldSize);
testBigintRoundtrip(Field.modulus, fieldSize);

// failure cases
expect(() => bigIntToBytes(BigInt(256), 1)).toThrow(/does not fit in 1 bytes/);
expect(() => bigIntToBytes(100_000n, 2)).toThrow(/does not fit in 2 bytes/);
expect(() => bigIntToBytes(BigInt(4) * Field.modulus, 32)).toThrow(
  /does not fit in 32 bytes/
);

console.log('bigint unit tests are passing! 🎉');
shutdown();
