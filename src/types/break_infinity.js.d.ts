declare module 'break_infinity.js' {
  export class Decimal {
    constructor(value?: number | string | Decimal);

    // スタティックプロパティ
    static MAX_VALUE: Decimal;
    static NUMBER_MAX_VALUE: number;
    static MIN_VALUE: Decimal;
    static ZERO: Decimal;
    static ONE: Decimal;
    static NEGATIVE_ONE: Decimal;
    static NaN: Decimal;
    static POSITIVE_INFINITY: Decimal;
    static NEGATIVE_INFINITY: Decimal;

    // インスタンスプロパティ
    mantissa: number;
    exponent: number;

    // メソッド
    plus(n: Decimal | number | string): Decimal;
    minus(n: Decimal | number | string): Decimal;
    times(n: Decimal | number | string): Decimal;
    dividedBy(n: Decimal | number | string): Decimal;
    equals(n: Decimal | number | string): boolean;
    lessThan(n: Decimal | number | string): boolean;
    lessThanOrEqualTo(n: Decimal | number | string): boolean;
    greaterThan(n: Decimal | number | string): boolean;
    greaterThanOrEqualTo(n: Decimal | number | string): boolean;
    isInteger(): boolean;
    floor(): Decimal;
    toString(): string;
  }
}
