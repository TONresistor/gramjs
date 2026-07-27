import bigInt from "big-integer";
import { Factorizator } from "../../gramjs/crypto/Factorizator";

describe("calcKey function", () => {
  test("returns a sorted non-trivial factor pair", () => {
    const input = bigInt(
      "325672672642762197972197217945794795197912791579174576454600704764276407047277"
    );
    const { p, q } = Factorizator.factorize(input);

    expect(p.greater(bigInt.one)).toBe(true);
    expect(q.greater(bigInt.one)).toBe(true);
    expect(p.lesserOrEquals(q)).toBe(true);
    expect(p.multiply(q)).toEqual(input);
  });
});
