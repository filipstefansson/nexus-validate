import { string, number, boolean, date, object, array } from 'yup';
import { ObjectShape } from 'yup/lib/object';

export const rules = {
  string,
  number,
  boolean,
  date,
  object,
  array,
};

export type ValidationRules = typeof rules;
export { ObjectShape };
