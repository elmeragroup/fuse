export interface Array<T> {
  readonly projectMarker: T;
}

export type Extract<T, U> = T extends U ? T : never;
