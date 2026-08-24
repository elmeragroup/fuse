type Element = { readonly kind: "element" };

interface ButtonProps {
  isPending?: boolean;
}

declare function register<T>(render: T): T;

export const Button = register(
  ({ isPending = false }: ButtonProps): Element => ({
    kind: isPending ? "element" : "element",
  })
);

export function DirectButton({ isPending = false }: ButtonProps): Element {
  return { kind: isPending ? "element" : "element" };
}

type Nested = {
  p00: string;
  p01: string;
  p02: string;
  p03: string;
  p04: string;
  p05: string;
  p06: string;
  p07: string;
  p08: string;
  p09: string;
  p10: string;
  p11: string;
  p12: string;
  p13: string;
  p14: string;
  p15: string;
  p16: string;
  p17: string;
  p18: string;
  p19: string;
  p20: string;
  p21: string;
  p22: string;
  p23: string;
  p24: string;
  p25: string;
  p26: string;
  p27: string;
  p28: string;
  p29: string;
  p30: string;
  p31: string;
  p32: string;
  p33: string;
  p34: string;
  p35: string;
  p36: string;
  p37: string;
  p38: string;
  p39: string;
  p40: string;
  p41: string;
  p42: string;
  p43: string;
  p44: string;
  p45: string;
  p46: string;
  p47: string;
  p48: string;
  p49: string;
  p50: string;
};

export interface ResolutionOptions {
  nested: Nested;
  excluded: string;
}

export const options: ResolutionOptions = {
  nested: {} as Nested,
  excluded: "excluded",
};
