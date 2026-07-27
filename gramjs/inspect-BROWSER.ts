const custom: unique symbol = Symbol.for("nodejs.util.inspect.custom") as any;

export const inspect = {
    custom,
};
