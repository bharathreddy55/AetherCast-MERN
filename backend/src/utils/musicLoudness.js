const fields = ['inputIntegratedLufs', 'inputTruePeakDbtp', 'outputIntegratedLufs', 'outputTruePeakDbtp', 'appliedGainDb'];
function loudnessDto(value) {
  if (!value || value.mode !== 'linear' || value.targetIntegratedLufs !== -14 || value.maxTruePeakDbtp !== -1 || fields.some(field => !Number.isFinite(value[field]))) return null;
  if ([value.inputIntegratedLufs, value.outputIntegratedLufs].some(number => number < -70 || number > 5)
    || value.inputTruePeakDbtp < -99 || value.inputTruePeakDbtp > 20 || value.outputTruePeakDbtp < -99 || value.outputTruePeakDbtp > -1
    || value.appliedGainDb < -60 || value.appliedGainDb > 6) return null;
  return { ...Object.fromEntries(fields.map(field => [field, value[field]])), mode: 'linear', targetIntegratedLufs: -14, maxTruePeakDbtp: -1 };
}
module.exports = { loudnessDto };
