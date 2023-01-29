import { Fq } from '../js_crypto/finite_field.js';
import { GroupProjective, Pallas } from '../js_crypto/elliptic_curve.js';
import { versionBytes } from '../js_crypto/constants.js';
import { record, withCheck, withVersionNumber } from './binable.js';
import { base58, withBase58 } from './base58.js';
import {
  BinableBigint,
  Bool,
  checkRange,
  Field,
  ProvableBigint,
  pseudoClass,
} from './field-bigint.js';
import { provable } from './provable-bigint.js';
import { HashInputLegacy } from './poseidon-bigint.js';

export { Group, PublicKey, Scalar, PrivateKey, versionNumbers };

// TODO generate
const versionNumbers = {
  field: 1,
  scalar: 1,
  publicKey: 1,
  signature: 1,
};

type Group = { x: Field; y: Field };
type PublicKey = { x: Field; isOdd: Bool };
type Scalar = bigint;
type PrivateKey = bigint;

/**
 * A non-zero point on the Pallas curve in affine form { x, y }
 */
const Group = {
  toProjective({ x, y }: Group): GroupProjective {
    return Pallas.ofAffine({ x, y, infinity: false });
  },
  /**
   * Convert a projective point to a non-zero affine point.
   * Throws an error if the point is zero / infinity, i.e. if z === 0
   */
  fromProjective(point: GroupProjective): Group {
    let { x, y, infinity } = Pallas.toAffine(point);
    if (infinity) throw Error('Group.fromProjective: point is infinity');
    return { x, y };
  },
  get generatorMina(): Group {
    return Group.fromProjective(Pallas.one);
  },
  scale(point: Group, scalar: Scalar): Group {
    return Group.fromProjective(
      Pallas.scale(Group.toProjective(point), scalar)
    );
  },
};

let FieldWithVersion = withVersionNumber(Field, versionNumbers.field);
let BinablePublicKey = withVersionNumber(
  withCheck(
    record({ x: FieldWithVersion, isOdd: Bool }, ['x', 'isOdd']),
    ({ x }) => {
      let { mul, add } = Field;
      let ySquared = add(mul(x, mul(x, x)), BigInt(5));
      if (!Field.isSquare(ySquared)) {
        throw Error('PublicKey: not a valid group element');
      }
    }
  ),
  versionNumbers.publicKey
);

/**
 * A public key, represented by a non-zero point on the Pallas curve, in compressed form { x, isOdd }
 */
const PublicKey = {
  ...provable({ x: Field, isOdd: Bool }),
  ...withBase58(BinablePublicKey, versionBytes.publicKey),

  toJSON(publicKey: PublicKey) {
    return PublicKey.toBase58(publicKey);
  },
  fromJSON(json: string): PublicKey {
    return PublicKey.fromBase58(json);
  },

  toGroup({ x, isOdd }: PublicKey): Group {
    let { mul, add } = Field;
    let ySquared = add(mul(x, mul(x, x)), BigInt(5));
    let y = Field.sqrt(ySquared);
    if (y === undefined) {
      throw Error('PublicKey.toGroup: not a valid group element');
    }
    if (isOdd !== (y & BigInt(1))) y = Field.negate(y);
    return { x, y };
  },
  fromGroup({ x, y }: Group): PublicKey {
    let isOdd = (y & BigInt(1)) as Bool;
    return { x, isOdd };
  },

  toInputLegacy({ x, isOdd }: PublicKey): HashInputLegacy {
    return { fields: [x], bits: [!!isOdd] };
  },
};

const checkScalar = checkRange(BigInt(0), Fq.modulus, 'Scalar');

/**
 * The scalar field of the Pallas curve
 */
const Scalar = pseudoClass(
  function Scalar(value: bigint | number | string): Scalar {
    return BigInt(value) % Fq.modulus;
  },
  {
    ...ProvableBigint(checkScalar),
    ...BinableBigint(Fq.sizeInBits, checkScalar),
    ...Fq,
  }
);

let BinablePrivateKey = withVersionNumber(Scalar, versionNumbers.scalar);
let Base58PrivateKey = base58(BinablePrivateKey, versionBytes.privateKey);

/**
 * A private key, represented by a scalar of the Pallas curve
 */
const PrivateKey = {
  ...Scalar,
  ...provable(Scalar),
  ...Base58PrivateKey,
  ...BinablePrivateKey,
  toPublicKey(key: PrivateKey) {
    return PublicKey.fromGroup(Group.scale(Group.generatorMina, key));
  },
};
