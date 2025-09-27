export const defaultPlans = [
  {
    name: "silver",
    minInvestment: 500,
    maxInvestment: 999,
    minReturnRate:3,
    maxReturnRate:6,
    features: [
      "Basic support",
      "Access to limited traders",
      "Monthly reports"
    ]
  },
  {
    name: "gold",
    minInvestment: 1000,
    maxInvestment: 2499,
    minReturnRate:6,
    maxReturnRate:10,
    features: [
      "Priority support",
      "Access to more traders",
      "Weekly reports",
      "Exclusive market insights"
    ]
  },
  {
    name: "platinum",
    minInvestment: 2500,
    maxInvestment: 5000,
    minReturnRate:10,
    maxReturnRate:15,
    features: [
      "24/7 dedicated support",
      "Access to all traders",
      "Daily reports",
      "Personal account manager",
      "Early access to new features"
    ]
  }
];
