import { bigIntToBytes } from '../js_crypto/bigint-helpers.js';
import { Fp, mod } from '../js_crypto/finite_field.js';
import { BinableWithBits, defineBinable, withBits } from './binable.js';
import { GenericHashInput, GenericProvableExtended } from './generic.js';

export { Field, Bool, UInt32, UInt64, Sign };
export {
  pseudoClass,
  ProvableExtended,
  HashInput,
  ProvableBigint,
  BinableBigint,
  sizeInBits,
  checkRange,
  checkField,
};

type Field = bigint;
type Bool = 0n | 1n;
type UInt32 = bigint;
type UInt64 = bigint;

const sizeInBits = Fp.sizeInBits;

type minusOne = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000000n;
const minusOne: minusOne = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000000n;
type Sign = 0n | minusOne;

type HashInput = GenericHashInput<Field>;
type ProvableExtended<T, J> = GenericProvableExtended<T, J, Field>;

const checkField = checkRange(BigInt(0), Fp.modulus, 'Field');
const checkBool = checkWhitelist(new Set([BigInt(0), BigInt(1)]), 'Bool');
const checkSign = checkWhitelist(new Set([BigInt(1), minusOne]), 'Sign');

/**
 * The base field of the Pallas curve
 */
const Field = pseudoClass(
  function Field(value: bigint | number | string): Field {
    return mod(BigInt(value), Fp.modulus);
  },
  {
    ...ProvableBigint(checkField),
    ...BinableBigint(Fp.sizeInBits, checkField),
    ...Fp,
  }
);

/**
 * A field element which is either 0 or 1
 */
const Bool = pseudoClass(
  function Bool(value: boolean): Bool {
    return BigInt(value) as Bool;
  },
  {
    ...ProvableBigint<Bool>(checkBool),
    ...BinableBigint<Bool>(1, checkBool),
    toInput(x: Bool): HashInput {
      return { fields: [], packed: [[x, 1]] };
    },
    toBoolean(x: Bool) {
      return !!x;
    },
    toJSON(x: Bool) {
      return !!x;
    },
    fromJSON(b: boolean) {
      let x = BigInt(b) as Bool;
      checkBool(x);
      return x;
    },
    sizeInBytes() {
      return 1;
    },
    fromField(x: Field) {
      checkBool(x);
      return x as BigInt(0) | BigInt(1);
    },
  }
);

function Unsigned(bits: number) {
  let maxValue = (BigInt(1) << BigInt(bits)) - BigInt(1);
  let checkUnsigned = checkRange(BigInt(0), BigInt(1) << BigInt(bits), `UInt${bits}`);

  return pseudoClass(
    function Unsigned(value: bigint | number | string) {
      let x = BigInt(value);
      checkUnsigned(x);
      return x;
    },
    {
      ...ProvableBigint(checkUnsigned),
      ...BinableBigint(bits, checkUnsigned),
      toInput(x: bigint): HashInput {
        return { fields: [], packed: [[x, bits]] };
      },
      maxValue,
    }
  );
}
const UInt32 = Unsigned(32);
const UInt64 = Unsigned(64);

const Sign = pseudoClass(
  function Sign(value: 1 | -1): Sign {
    if (value !== 1 && value !== -1)
      throw Error('Sign: input must be 1 or -1.');
    return (BigInt(value) % Fp.modulus) as Sign;
  },
  {
    ...ProvableBigint<Sign, 'Positive' | 'Negative'>(checkSign),
    ...BinableBigint<Sign>(1, checkSign),
    emptyValue() {
      return BigInt(1);
    },
    toInput(x: Sign): HashInput {
      return { fields: [], packed: [[x === BigInt(1) ? BigInt(1) : BigInt(0), 1]] };
    },
    fromFields([x]: Field[]): Sign {
      if (x === BigInt(0)) return BigInt(1);
      checkSign(x);
      return x as Sign;
    },
    toJSON(x: Sign) {
      return x === BigInt(1) ? 'Positive' : 'Negative';
    },
    fromJSON(x: 'Positive' | 'Negative'): Sign {
      if (x !== 'Positive' && x !== 'Negative')
        throw Error('Sign: invalid input');
      return x === 'Positive' ? BigInt(1) : minusOne;
    },
  }
);

// helper

function pseudoClass<
  F extends (...args: any) => any,
  M
  // M extends Provable<ReturnType<F>>
>(constructor: F, module: M) {
  return Object.assign<F, M>(constructor, module);
}

function ProvableBigint<
  T extends bigint = bigint,
  TJSON extends string = string
>(check: (x: bigint) => void): ProvableExtended<T, TJSON> {
  return {
    sizeInFields() {
      return 1;
    },
    toFields(x): Field[] {
      return [x];
    },
    toAuxiliary() {
      return [];
    },
    check,
    fromFields([x]) {
      check(x);
      return x as T;
    },
    toInput(x) {
      return { fields: [x], packed: [] };
    },
    toJSON(x) {
      return x.toString() as TJSON;
    },
    fromJSON(json) {
      let x = BigInt(json) as T;
      check(x);
      return x;
    },
  };
}

function BinableBigint<T extends bigint = bigint>(
  sizeInBits: number,
  check: (x: bigint) => void
): BinableWithBits<T> {
  let sizeInBytes = Math.ceil(sizeInBits / 8);
  return withBits(
    defineBinable({
      toBytes(x) {
        return bigIntToBytes(x, sizeInBytes);
      },
      readBytes(bytes, start) {
        let x = BigInt(0);
        let bitPosition = BigInt(0);
        let end = Math.min(start + sizeInBytes, bytes.length);
        for (let i = start; i < end; i++) {
          x += BigInt(bytes[i]) << bitPosition;
          bitPosition += BigInt(8);
        }
        check(x);
        return [x as T, end];
      },
    }),
    sizeInBits
  );
}

// validity checks

function checkRange(lower: bigint, upper: bigint, name: string) {
  return (x: bigint) => {
    if (x < lower)
      throw Error(
        `${name}: inputs smaller than ${lower} are not allowed, got ${x}`
      );
    if (x >= upper)
      throw Error(
        `${name}: inputs larger than ${upper - BigInt(1)} are not allowed, got ${x}`
      );
  };
}

function checkWhitelist(valid: Set<bigint>, name: string) {
  return (x: bigint) => {
    if (!valid.has(x)) {
      throw Error(
        `${name}: input must be one of ${[...valid].join(', ')}, got ${x}`
      );
    }
  };
}
