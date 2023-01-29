import { Fp, Fq } from './finite_field.js';

for (let F of [Fp, Fq]) {
  // t is computed correctly from p = 2^32 * t + 1
  console.assert(F.t * (BigInt(1) << BigInt(32)) + BigInt(1) === F.modulus);

  // the primitive root of unity is computed correctly as 5^t
  let generator = BigInt(5);
  let rootFp = F.power(generator, F.t);
  console.assert(rootFp === F.twoadicRoot);

  // the primitive roots of unity `r` actually satisfy the equations defining them:
  // r^(2^32) = 1, r^(2^31) != 1
  let shouldBe1 = F.power(F.twoadicRoot, BigInt(1) << BigInt(32));
  let shouldBeMinus1 = F.power(F.twoadicRoot, BigInt(1) << BigInt(31));
  console.assert(shouldBe1 === BigInt(1));
  console.assert(shouldBeMinus1 + BigInt(1) === F.modulus);

  // the primitive roots of unity are non-squares
  // -> verifies that the two-adicity is 32, and that they can be used as non-squares in the sqrt algorithm
  console.assert(!F.isSquare(F.twoadicRoot));
}
