import type { Input } from "@/web/src/input/Input";

let bound: Input | null = null;

export function bindMobileInput(input: Input): void {
  bound = input;
}

export function mobileInput(): Input | null {
  return bound;
}
