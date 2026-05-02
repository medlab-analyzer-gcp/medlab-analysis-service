/**
 * Medical Blood Test Analyzer
 *
 * Analyzes blood test results and provides health recommendations
 * Supports multiple test types with gender-specific normal ranges
 */

// ==============================================================================
// Normal Ranges Database
// ==============================================================================

const NORMAL_RANGES = {
  // Complete Blood Count (CBC)
  hemoglobin: {
    male: { min: 13.5, max: 17.5, unit: "g/dL" },
    female: { min: 12.0, max: 15.5, unit: "g/dL" },
  },
  wbc: {
    // White Blood Cells
    male: { min: 4.5, max: 11.0, unit: "10^9/L" },
    female: { min: 4.5, max: 11.0, unit: "10^9/L" },
  },
  rbc: {
    // Red Blood Cells
    male: { min: 4.7, max: 6.1, unit: "10^12/L" },
    female: { min: 4.2, max: 5.4, unit: "10^12/L" },
  },
  platelets: {
    male: { min: 150, max: 400, unit: "10^9/L" },
    female: { min: 150, max: 400, unit: "10^9/L" },
  },
  hematocrit: {
    male: { min: 38.8, max: 50.0, unit: "%" },
    female: { min: 34.9, max: 44.5, unit: "%" },
  },

  // Metabolic Panel
  glucose: {
    male: { min: 70, max: 100, unit: "mg/dL" },
    female: { min: 70, max: 100, unit: "mg/dL" },
  },
  cholesterol: {
    male: { min: 0, max: 200, unit: "mg/dL" },
    female: { min: 0, max: 200, unit: "mg/dL" },
  },
  ldl: {
    // LDL Cholesterol
    male: { min: 0, max: 100, unit: "mg/dL" },
    female: { min: 0, max: 100, unit: "mg/dL" },
  },
  hdl: {
    // HDL Cholesterol
    male: { min: 40, max: 999, unit: "mg/dL" },
    female: { min: 50, max: 999, unit: "mg/dL" },
  },
  triglycerides: {
    male: { min: 0, max: 150, unit: "mg/dL" },
    female: { min: 0, max: 150, unit: "mg/dL" },
  },

  // Liver Function
  alt: {
    // Alanine Aminotransferase
    male: { min: 7, max: 55, unit: "U/L" },
    female: { min: 7, max: 45, unit: "U/L" },
  },
  ast: {
    // Aspartate Aminotransferase
    male: { min: 8, max: 48, unit: "U/L" },
    female: { min: 8, max: 43, unit: "U/L" },
  },

  // Kidney Function
  creatinine: {
    male: { min: 0.7, max: 1.3, unit: "mg/dL" },
    female: { min: 0.6, max: 1.1, unit: "mg/dL" },
  },
  bun: {
    // Blood Urea Nitrogen
    male: { min: 7, max: 20, unit: "mg/dL" },
    female: { min: 7, max: 20, unit: "mg/dL" },
  },

  // Thyroid Function
  tsh: {
    // Thyroid Stimulating Hormone
    male: { min: 0.4, max: 4.0, unit: "mIU/L" },
    female: { min: 0.4, max: 4.0, unit: "mIU/L" },
  },

  // Electrolytes
  sodium: {
    male: { min: 136, max: 145, unit: "mmol/L" },
    female: { min: 136, max: 145, unit: "mmol/L" },
  },
  potassium: {
    male: { min: 3.5, max: 5.0, unit: "mmol/L" },
    female: { min: 3.5, max: 5.0, unit: "mmol/L" },
  },
};

// ==============================================================================
// Health Recommendations
// ==============================================================================

const RECOMMENDATIONS = {
  hemoglobin: {
    low: "Low hemoglobin may indicate anemia. Consider iron-rich foods and consult your doctor.",
    high: "Elevated hemoglobin may indicate dehydration or other conditions. Consult your doctor.",
  },
  wbc: {
    low: "Low WBC count may indicate weakened immune system. Avoid infections and consult your doctor.",
    high: "Elevated WBC count may indicate infection or inflammation. Consult your doctor.",
  },
  rbc: {
    low: "Low RBC count may indicate anemia. Consult your doctor for further evaluation.",
    high: "Elevated RBC count needs medical evaluation. Consult your doctor.",
  },
  platelets: {
    low: "Low platelet count increases bleeding risk. Avoid activities with injury risk and see your doctor.",
    high: "High platelet count may increase clotting risk. Consult your doctor.",
  },
  glucose: {
    low: "Low blood sugar detected. Eat regular meals and monitor glucose levels.",
    high: "Elevated glucose may indicate prediabetes or diabetes. Reduce sugar intake and consult your doctor.",
  },
  cholesterol: {
    high: "High cholesterol increases heart disease risk. Reduce saturated fats and exercise regularly.",
  },
  ldl: {
    high: "High LDL cholesterol increases heart disease risk. Improve diet and exercise, consult your doctor.",
  },
  hdl: {
    low: "Low HDL cholesterol increases heart disease risk. Exercise regularly and eat healthy fats.",
  },
  triglycerides: {
    high: "High triglycerides increase heart disease risk. Reduce carbs and alcohol, increase omega-3 intake.",
  },
  alt: {
    high: "Elevated ALT may indicate liver inflammation. Avoid alcohol and consult your doctor.",
  },
  ast: {
    high: "Elevated AST may indicate liver or muscle damage. Consult your doctor for evaluation.",
  },
  creatinine: {
    high: "Elevated creatinine may indicate kidney problems. Stay hydrated and consult your doctor.",
  },
  bun: {
    high: "Elevated BUN may indicate kidney issues or dehydration. Increase water intake and see your doctor.",
  },
  tsh: {
    low: "Low TSH may indicate hyperthyroidism. Consult an endocrinologist.",
    high: "High TSH may indicate hypothyroidism. Consult an endocrinologist.",
  },
  sodium: {
    low: "Low sodium levels can be dangerous. Consult your doctor immediately.",
    high: "High sodium levels need evaluation. Reduce salt intake and consult your doctor.",
  },
  potassium: {
    low: "Low potassium can affect heart rhythm. Eat potassium-rich foods and consult your doctor.",
    high: "High potassium can be dangerous. Consult your doctor immediately.",
  },
};

// ==============================================================================
// Analysis Functions
// ==============================================================================

/**
 * Determine if a test result is normal, low, or high
 */
function evaluateTestResult(testName, value, gender) {
  const normalRange = NORMAL_RANGES[testName.toLowerCase()];

  if (!normalRange) {
    return {
      status: "unknown",
      message: "Test not recognized",
    };
  }

  const genderRange = normalRange[gender.toLowerCase()];

  if (!genderRange) {
    return {
      status: "unknown",
      message: "Invalid gender",
    };
  }

  const { min, max, unit } = genderRange;

  if (value < min) {
    return {
      status: "low",
      value: value,
      normalRange: { min, max },
      unit: unit,
      difference: min - value,
      percentageDeviation: (((min - value) / min) * 100).toFixed(1),
    };
  } else if (value > max) {
    return {
      status: "high",
      value: value,
      normalRange: { min, max },
      unit: unit,
      difference: value - max,
      percentageDeviation: (((value - max) / max) * 100).toFixed(1),
    };
  } else {
    return {
      status: "normal",
      value: value,
      normalRange: { min, max },
      unit: unit,
    };
  }
}

/**
 * Get health recommendation for abnormal result
 */
function getRecommendation(testName, status) {
  const recommendations = RECOMMENDATIONS[testName.toLowerCase()];

  if (!recommendations) {
    return "Consult your healthcare provider for interpretation.";
  }

  if (status === "low" && recommendations.low) {
    return recommendations.low;
  } else if (status === "high" && recommendations.high) {
    return recommendations.high;
  } else if (recommendations.high) {
    // For tests that only have 'high' recommendation (like cholesterol)
    return recommendations.high;
  }

  return "Values are within normal range.";
}

/**
 * Analyze complete blood test results
 */
function analyzeBloodTest(testResults, patientInfo) {
  const { age, gender } = patientInfo;

  const analyzedTests = [];
  let normalCount = 0;
  let abnormalCount = 0;
  const concerns = [];
  const recommendations = [];

  // Analyze each test
  for (const [testName, value] of Object.entries(testResults)) {
    const evaluation = evaluateTestResult(testName, value, gender);

    const testAnalysis = {
      testName: testName,
      ...evaluation,
    };

    if (evaluation.status === "normal") {
      normalCount++;
      testAnalysis.recommendation = "Continue maintaining healthy lifestyle.";
    } else if (evaluation.status === "low" || evaluation.status === "high") {
      abnormalCount++;
      const recommendation = getRecommendation(testName, evaluation.status);
      testAnalysis.recommendation = recommendation;

      concerns.push({
        test: testName,
        status: evaluation.status,
        severity:
          Math.abs(parseFloat(evaluation.percentageDeviation)) > 20
            ? "high"
            : "moderate",
      });

      recommendations.push({
        test: testName,
        advice: recommendation,
      });
    } else {
      testAnalysis.recommendation = "Test not recognized in database.";
    }

    analyzedTests.push(testAnalysis);
  }

  // Determine overall health status
  let overallStatus = "healthy";
  let overallMessage =
    "All test results are within normal ranges. Continue maintaining a healthy lifestyle.";

  if (abnormalCount > 0) {
    const severeConcerns = concerns.filter((c) => c.severity === "high").length;

    if (severeConcerns > 0 || abnormalCount >= 3) {
      overallStatus = "concern";
      overallMessage = `${abnormalCount} test result(s) are outside normal ranges. Please consult your healthcare provider for a comprehensive evaluation.`;
    } else {
      overallStatus = "attention_needed";
      overallMessage = `${abnormalCount} test result(s) need attention. Review recommendations and consult your healthcare provider if needed.`;
    }
  }

  return {
    summary: {
      totalTests: analyzedTests.length,
      normalResults: normalCount,
      abnormalResults: abnormalCount,
      overallStatus: overallStatus,
    },
    overallMessage: overallMessage,
    patientInfo: {
      age: age,
      gender: gender,
    },
    testResults: analyzedTests,
    concerns: concerns,
    recommendations: recommendations,
    disclaimer:
      "This analysis is for informational purposes only and should not replace professional medical advice. Always consult with your healthcare provider for proper interpretation and treatment.",
  };
}

// ==============================================================================
// Exports
// ==============================================================================

module.exports = {
  analyzeBloodTest,
  evaluateTestResult,
  getRecommendation,
  NORMAL_RANGES,
};
