// author: caitriona mccann
// date: 15/04/2026
// unit tests for the sustainability scoring algorithm in impactCalculator.js
// covers happy path, sustainable fibres, second-hand bonus, edge cases and synthetic microplastics
// uses jest with arrange-act-assert pattern

import { calculateImpactScore } from '../impactCalculator';

// UT-01: happy path — standard cotton item
// cotton has baseScore 60, expect a mid-range grade C score
test('UT-01: 100% Cotton produces a grade C score', () => {
  // Arrange
  const fibers = [{ name: 'Cotton', percentage: 100 }];

  // Act
  const result = calculateImpactScore(fibers, 300, false);

  // Assert
  expect(result.score).toBe(60);
  expect(result.grade).toBe('C');
  expect(result.waterUsage).toBeGreaterThan(0);
  expect(result.carbonFootprint).toBeGreaterThan(0);
});

// UT-02: sustainable fibre edge case — Hemp has baseScore 84, should produce grade A
test('UT-02: 100% Hemp produces a grade A score', () => {
  // Arrange
  const fibers = [{ name: 'Hemp', percentage: 100 }];

  // Act
  const result = calculateImpactScore(fibers, 300, false);

  // Assert
  expect(result.score).toBe(84);
  expect(result.grade).toBe('A');
});

// UT-03: second-hand bonus — cotton score 60 + 15pt bonus = 75, still grade B
test('UT-03: second-hand flag adds 15 points and reduces water and carbon by 80%', () => {
  // Arrange
  const fibers = [{ name: 'Cotton', percentage: 100 }];
  const newItem = calculateImpactScore(fibers, 300, false);

  // Act
  const secondHandItem = calculateImpactScore(fibers, 300, true);

  // Assert
  expect(secondHandItem.score).toBe(newItem.score + 15);
  expect(secondHandItem.waterUsage).toBeCloseTo(newItem.waterUsage * 0.2, 1);
  expect(secondHandItem.carbonFootprint).toBeCloseTo(newItem.carbonFootprint * 0.2, 1);
});

// UT-04: empty fibre array — should return safe default grade C score of 50
test('UT-04: empty fibre array returns default score of 50 and grade C', () => {
  // Arrange
  const fibers = [];

  // Act
  const result = calculateImpactScore(fibers);

  // Assert
  expect(result.score).toBe(50);
  expect(result.grade).toBe('C');
});

// UT-05: synthetic microplastic penalty — polyester has baseScore 30
// score should stay below grade D threshold (35)
test('UT-05: 100% Polyester scores below 35 and receives grade F', () => {
  // Arrange
  const fibers = [{ name: 'Polyester', percentage: 100 }];

  // Act
  const result = calculateImpactScore(fibers, 300, false);

  // Assert
  expect(result.score).toBeLessThan(35);
  expect(result.grade).toBe('F');
});

// UT-06: blended fibre weighted average — 60% Cotton (score 60) + 40% Polyester (score 30)
// expected weighted score: (60 * 0.6) + (30 * 0.4) = 36 + 12 = 48, grade D
test('UT-06: 60% Cotton 40% Polyester blend produces a weighted average score', () => {
  // Arrange
  const fibers = [
    { name: 'Cotton', percentage: 60 },
    { name: 'Polyester', percentage: 40 },
  ];

  // Act
  const result = calculateImpactScore(fibers, 300, false);

  // Assert
  expect(result.score).toBe(48);
  expect(result.grade).toBe('D');
});

// UT-07: grade boundary — score of exactly 80 should return grade A
// score of 79 should return grade B, confirming the threshold is correct
test('UT-07: grade boundaries are correct at the A/B threshold', () => {
  // Arrange — Organic Cotton has baseScore 80, sits exactly on the A boundary
  const fibersAt80 = [{ name: 'Organic Cotton', percentage: 100 }];
  // Cotton (60) second-hand = 75, sits just below A boundary
  const fibersAt75 = [{ name: 'Cotton', percentage: 100 }];

  // Act
  const resultA = calculateImpactScore(fibersAt80, 300, false);
  const resultB = calculateImpactScore(fibersAt75, 300, true);

  // Assert
  expect(resultA.score).toBe(80);
  expect(resultA.grade).toBe('A');
  expect(resultB.score).toBe(75);
  expect(resultB.grade).toBe('B');
});
