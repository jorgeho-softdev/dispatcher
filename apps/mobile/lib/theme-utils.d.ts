type ColorTree = { [key: string]: string | ColorTree };

export function hexToRgbTriplet(hex: string): string;
export function buildColorVars(
  colorTree: ColorTree,
  prefix: string,
): { varNames: ColorTree; cssVars: Record<string, string> };
