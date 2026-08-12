export const RANDOM_DRAW_FRAME_DELAYS = [90, 100, 115, 135, 165, 205, 250, 300] as const;

export function randomDrawFrames(candidateNames: string[], winnerName: string): string[] {
  const candidates = [...new Set(candidateNames.filter(Boolean))];
  if (candidates.length === 0) return [winnerName];
  return [
    ...RANDOM_DRAW_FRAME_DELAYS.map((_, index) => candidates[index % candidates.length]!),
    winnerName,
  ];
}
