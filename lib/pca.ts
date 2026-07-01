/**
 * Plain covariance PCA for small problems (our design matrix is n cases × 9
 * justices). No regularization, no scaling to unit variance — we mean-center
 * each justice's column and eigendecompose the sample covariance. A symmetric
 * Jacobi rotation solver is plenty for a 9×9 matrix and avoids any dependency.
 */

export interface PCAResult {
  /** number of observations (cases) */
  n: number;
  /** number of variables (justices) */
  p: number;
  /** column means that were subtracted (length p) */
  mean: number[];
  /** eigenvalues, descending — variance along each principal component */
  eigenvalues: number[];
  /**
   * loadings[j][k] = loading of variable j on PC k (the eigenvectors, columns
   * aligned to `eigenvalues`). Each column is a unit vector; the rows are the
   * per-variable coordinates in PC space.
   */
  loadings: number[][];
  /** fraction of total variance on each PC (eigenvalue / trace) */
  varianceExplained: number[];
  /** λ_max / λ_min — how close the covariance is to singular */
  conditionNumber: number;
}

/** Sample covariance (p×p) of an n×p matrix after subtracting column means. */
function covariance(X: number[][], mean: number[]): number[][] {
  const n = X.length;
  const p = mean.length;
  const S = Array.from({ length: p }, () => new Array(p).fill(0));
  for (const row of X) {
    for (let i = 0; i < p; i++) {
      const di = row[i] - mean[i];
      for (let j = i; j < p; j++) S[i][j] += di * (row[j] - mean[j]);
    }
  }
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < p; i++)
    for (let j = i; j < p; j++) S[i][j] = S[j][i] = S[i][j] / denom;
  return S;
}

/**
 * Eigendecomposition of a real symmetric matrix via cyclic Jacobi rotations.
 * Returns eigenvalues and eigenvectors (columns), unsorted.
 */
function jacobiEigen(
  Ain: number[][],
  maxSweeps = 100,
  tol = 1e-12
): { values: number[]; vectors: number[][] } {
  const p = Ain.length;
  const A = Ain.map((r) => r.slice());
  // V accumulates the rotations → eigenvectors as columns.
  const V: number[][] = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))
  );

  const offDiagNorm = () => {
    let s = 0;
    for (let i = 0; i < p; i++)
      for (let j = i + 1; j < p; j++) s += A[i][j] * A[i][j];
    return Math.sqrt(s);
  };

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    if (offDiagNorm() < tol) break;
    for (let q = 0; q < p; q++) {
      for (let r = q + 1; r < p; r++) {
        if (Math.abs(A[q][r]) < 1e-300) continue;
        const theta = (A[r][r] - A[q][q]) / (2 * A[q][r]);
        const t =
          Math.sign(theta || 1) /
          (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // Apply the rotation to A (rows/cols q, r) and accumulate into V.
        for (let k = 0; k < p; k++) {
          const akq = A[k][q];
          const akr = A[k][r];
          A[k][q] = c * akq - s * akr;
          A[k][r] = s * akq + c * akr;
        }
        for (let k = 0; k < p; k++) {
          const aqk = A[q][k];
          const ark = A[r][k];
          A[q][k] = c * aqk - s * ark;
          A[r][k] = s * aqk + c * ark;
        }
        for (let k = 0; k < p; k++) {
          const vkq = V[k][q];
          const vkr = V[k][r];
          V[k][q] = c * vkq - s * vkr;
          V[k][r] = s * vkq + c * vkr;
        }
      }
    }
  }
  const values = A.map((_, i) => A[i][i]);
  return { values, vectors: V };
}

/**
 * Run covariance PCA on an n×p matrix. `orient` optionally flips each PC's sign
 * so a chosen variable (e.g. the most conservative justice) loads positive,
 * making PCs comparable across datasets.
 */
export function pca(
  X: number[][],
  orient?: (loadings: number[][], pc: number) => number
): PCAResult {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const mean = new Array(p).fill(0);
  for (const row of X) for (let j = 0; j < p; j++) mean[j] += row[j] / n;

  const S = covariance(X, mean);
  const { values, vectors } = jacobiEigen(S);

  // sort PCs by descending eigenvalue
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const eigenvalues = order.map((i) => values[i]);
  // loadings[j][k] — reorder eigenvector columns to match sorted eigenvalues
  const loadings = Array.from({ length: p }, (_, j) =>
    order.map((i) => vectors[j][i])
  );

  // sign convention
  for (let k = 0; k < p; k++) {
    const sign = orient
      ? orient(loadings, k)
      : // default: make the largest-magnitude loading positive
        (() => {
          let best = 0;
          for (let j = 1; j < p; j++)
            if (Math.abs(loadings[j][k]) > Math.abs(loadings[best][k])) best = j;
          return loadings[best][k];
        })();
    if (sign < 0) for (let j = 0; j < p; j++) loadings[j][k] *= -1;
  }

  const trace = eigenvalues.reduce((a, b) => a + b, 0) || 1;
  const varianceExplained = eigenvalues.map((v) => v / trace);
  const posit = eigenvalues.filter((v) => v > 1e-12);
  const conditionNumber = posit.length
    ? eigenvalues[0] / posit[posit.length - 1]
    : Infinity;

  return { n, p, mean, eigenvalues, loadings, varianceExplained, conditionNumber };
}

/** Project a single observation (length p) into PC space → scores per PC. */
export function project(row: number[], r: PCAResult): number[] {
  const centered = row.map((v, j) => v - r.mean[j]);
  return r.loadings[0].map((_, k) =>
    centered.reduce((s, v, j) => s + v * r.loadings[j][k], 0)
  );
}
