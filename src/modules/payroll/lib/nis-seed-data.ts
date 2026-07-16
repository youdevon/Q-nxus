import type { NisEarningsClassInput } from "./nis-contribution";

/** Official T&T NIS earnings classes effective 5 January 2026. */
export const TT_NIS_2026_EFFECTIVE_FROM = "2026-01-05";

export const TT_NIS_2026_CLASSES: NisEarningsClassInput[] = [
  { classCode: "I", monthlyMin: 867, monthlyMax: 1472.99, employeeWeeklyAmount: 14.6, employerWeeklyAmount: 29.2 },
  { classCode: "II", monthlyMin: 1473, monthlyMax: 1949.99, employeeWeeklyAmount: 21.3, employerWeeklyAmount: 42.6 },
  { classCode: "III", monthlyMin: 1950, monthlyMax: 2642.99, employeeWeeklyAmount: 28.6, employerWeeklyAmount: 57.2 },
  { classCode: "IV", monthlyMin: 2643, monthlyMax: 3292.99, employeeWeeklyAmount: 37, employerWeeklyAmount: 74 },
  { classCode: "V", monthlyMin: 3293, monthlyMax: 4029.99, employeeWeeklyAmount: 45.6, employerWeeklyAmount: 91.2 },
  { classCode: "VI", monthlyMin: 4030, monthlyMax: 4852.99, employeeWeeklyAmount: 55.4, employerWeeklyAmount: 110.8 },
  { classCode: "VII", monthlyMin: 4853, monthlyMax: 5632.99, employeeWeeklyAmount: 65.3, employerWeeklyAmount: 130.6 },
  { classCode: "VIII", monthlyMin: 5633, monthlyMax: 6456.99, employeeWeeklyAmount: 75.3, employerWeeklyAmount: 150.6 },
  { classCode: "IX", monthlyMin: 6457, monthlyMax: 7409.99, employeeWeeklyAmount: 86.4, employerWeeklyAmount: 172.8 },
  { classCode: "X", monthlyMin: 7410, monthlyMax: 8276.99, employeeWeeklyAmount: 97.7, employerWeeklyAmount: 195.4 },
  { classCode: "XI", monthlyMin: 8277, monthlyMax: 9272.99, employeeWeeklyAmount: 109.4, employerWeeklyAmount: 218.8 },
  { classCode: "XII", monthlyMin: 9273, monthlyMax: 10312.99, employeeWeeklyAmount: 122, employerWeeklyAmount: 244 },
  { classCode: "XIII", monthlyMin: 10313, monthlyMax: 11396.99, employeeWeeklyAmount: 135.3, employerWeeklyAmount: 270.6 },
  { classCode: "XIV", monthlyMin: 11397, monthlyMax: 12652.99, employeeWeeklyAmount: 149.9, employerWeeklyAmount: 299.8 },
  { classCode: "XV", monthlyMin: 12653, monthlyMax: 13599.99, employeeWeeklyAmount: 163.6, employerWeeklyAmount: 327.2 },
  { classCode: "XVI", monthlyMin: 13600, monthlyMax: null, employeeWeeklyAmount: 169.5, employerWeeklyAmount: 339 },
];
