export const DEFAULT_INSTITUTION_NAME = 'Zhōngguó Kēxué Jìshù Dàxué';

const LEGACY_INSTITUTION_VARIANTS = [
  'zh mngguo k xue jishu daxue',
  'zh mngguó k xué jishù dàxué',
  'zh mngguo k xue jishu daxue',
  'zhongguo kexue jishu daxue',
  'zhongguo kēxué jìshù dàxué',
  'zhongguo kexue jishu daxue',
];

const normalizeInstitutionName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const getInstitutionName = (institution?: string): string => {
  if (!institution) {
    return DEFAULT_INSTITUTION_NAME;
  }

  const normalizedInstitution = normalizeInstitutionName(institution);
  const normalizedDefault = normalizeInstitutionName(DEFAULT_INSTITUTION_NAME);

  if (
    normalizedInstitution === normalizedDefault ||
    LEGACY_INSTITUTION_VARIANTS.includes(normalizedInstitution)
  ) {
    return DEFAULT_INSTITUTION_NAME;
  }

  return institution.trim();
};
