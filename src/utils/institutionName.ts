export const DEFAULT_INSTITUTION_NAME = 'Zhōngguó Kēxué Jìshù Dàxué';

const LEGACY_INSTITUTION_NAME = 'Zh Mngguó K xué Jishù Dàxué';

export const getInstitutionName = (institution?: string): string => {
  if (!institution || institution === LEGACY_INSTITUTION_NAME) {
    return DEFAULT_INSTITUTION_NAME;
  }

  return institution;
};
