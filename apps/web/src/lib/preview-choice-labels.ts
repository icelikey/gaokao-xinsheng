/** Display text for the existing synthetic MVP fixture, NOT historical Gaokao content. */
const choices: Record<string, readonly string[]> = {
  "01": ["{x | x ≤ 1}", "{x | 1 < x < 4}", "{x | x ≥ 4}", "∅"],
  "02": ["x = −1", "x = 0", "x = 1", "x = 2"],
  "03": ["30°", "45°", "60°", "90°"],
  "04": ["8", "11", "12", "14"],
  "05": ["(0, 1)", "(0, 1/4)", "(1/4, 0)", "(0, −1/4)"],
  "06": ["−1", "1", "i", "−i"],
  "07": ["ℝ", "[0, +∞)", "(0, +∞)", "(−∞, 0)"],
  "08": ["0", "3", "5", "6"],
  "09": ["(−1, 1)", "[−1, 1]", "(1, +∞)", "(−∞, −1) ∪ (1, +∞)"],
  "10": ["2", "4", "√2", "1"],
  "11": ["1", "2", "3", "6"],
  "12": ["2x − 1", "(x − 1)/2", "(x + 1)/2", "1/(2x + 1)"],
  "25": ["45°", "30°", "60°", "90°"],
  "26": ["(1, 0)", "(0, 1)", "(0, 2)", "(2, 0)"]
};
export function previewChoiceLabels(questionId: string): Record<string, string> | undefined {
  const match = /^q_2010_sd_math_(\d{2})$/.exec(questionId);
  const labels = match ? choices[match[1]] : undefined;
  return labels ? Object.fromEntries(labels.map((label, i) => ["ABCD"[i], label])) : undefined;
}
