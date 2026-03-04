/**
 *
 * @param nanoSeconds - The time in nanoseconds to be transformed into a human-readable format.
 * @returns A string representing the time in a human-readable format (e.g., "00:00:02.10").
 */
export function transformNanoSeccondsToTimeFormat(nanoSeconds: bigint): string {
  const totalSeconds = Number(nanoSeconds) / 1e9;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(2);

  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = seconds.toString().padStart(5, "0");

  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}

/** *
 * @param nanoseconds - The time in nanoseconds number to be transformed into nanoseconds as a bigint.
 * @returns A bigint representing the time in nanoseconds.
 */
export function transformNonBigIntNanoToBigIntNano(
  nanoseconds: number,
): bigint {
  return BigInt(nanoseconds);
}

export function transformSecondsToTimeFormat(seconds: number): string {
  const nanoSeconds = BigInt(Math.round(seconds * 1e9));
  return transformNanoSeccondsToTimeFormat(nanoSeconds);
}
