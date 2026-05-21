export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }

  const dimension = vectors[0]?.length ?? 0;
  const totals = new Array<number>(dimension).fill(0);

  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error("Cannot average vectors with different dimensions");
    }

    for (let index = 0; index < dimension; index += 1) {
      totals[index] += vector[index] ?? 0;
    }
  }

  return totals.map((total) => total / vectors.length);
}

export function normalizeScore(
  value: number | null | undefined,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value) || max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, value / max));
}
