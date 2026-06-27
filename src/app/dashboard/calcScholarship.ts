type ApplicationInput = {
    householdIncome: number;
    familySize: number;
    siblingCount: number;
    specialCircumstanceScore?: number; // 0–100
  };
  
  function incomeScore(income: number) {
    if (income < 30000) return 100;
    if (income < 60000) return 80;
    if (income < 90000) return 60;
    if (income < 120000) return 40;
    return 20;
  }
  
  function familySizeScore(size: number) {
    if (size >= 5) return 100;
    if (size === 4) return 80;
    if (size === 3) return 60;
    if (size === 2) return 40;
    return 20;
  }
  
  function siblingScore(count: number) {
    if (count >= 3) return 100;
    if (count === 2) return 70;
    return 40;
  }
  
  function benchmarkScore(): number {
    return 70; // placeholder until we connect real dataset
  }
  
  export function calculateScholarship(input: ApplicationInput) {
    const income = incomeScore(input.householdIncome);
    const family = familySizeScore(input.familySize);
    const sibling = siblingScore(input.siblingCount);
    const special = input.specialCircumstanceScore ?? 0;
    const benchmark = benchmarkScore();
  
    const score =
      income * 0.45 +
      family * 0.20 +
      sibling * 0.15 +
      special * 0.10 +
      benchmark * 0.10;
  
    let min = 0;
    let max = 1000;
  
    if (score >= 80) {
      min = 7000; max = 10000;
    } else if (score >= 60) {
      min = 4000; max = 7500;
    } else if (score >= 40) {
      min = 2000; max = 5000;
    } else if (score >= 20) {
      min = 500; max = 2500;
    }
  
    return {
      score: Math.round(score),
      suggestedMin: min,
      suggestedMax: max,
    };
  }