import { plugin } from 'nexus';
import {
  NexusArgDef,
  printedGenTyping,
  printedGenTypingImport,
} from 'nexus/dist/core';

import { rules } from './rules';
import { ValidatePluginErrorConfig, ValidationError } from './error';
import { resolver } from './resolver';

const ValidateResolverImport = printedGenTypingImport({
  module: 'nexus-validate',
  bindings: ['ValidateResolver', 'InputObjectValidateResolver'],
});

const fieldDefTypes = printedGenTyping({
  optional: true,
  name: 'validate',
  description: 'Validate mutation arguments.',
  type: 'ValidateResolver<TypeName, FieldName>',
  imports: [ValidateResolverImport],
});

const inputObjectdDefTypes = printedGenTyping({
  optional: true,
  name: 'validate',
  description: 'Validate mutation arguments.',
  type: 'InputObjectValidateResolver',
  imports: [ValidateResolverImport],
});

export interface ValidatePluginConfig {
  formatError?: (config: ValidatePluginErrorConfig) => Error;
}

export const validatePlugin = (validateConfig: ValidatePluginConfig = {}) => {
  return plugin({
    name: 'NexusValidate',
    description: 'The validate plugin provides validation for arguments.',
    fieldDefTypes: fieldDefTypes,
    inputObjectTypeDefTypes: inputObjectdDefTypes,
    onCreateFieldResolver: resolver(validateConfig),
    onAddOutputField: (config) => {
      const args = config?.args ?? {};
      // loop through args and look for a validate function
      Object.keys(args).forEach((key) => {
        const arg = args[key] as NexusArgDef<any>;
        const validate = arg?.value?.type?.config?.validate;

        if (!validate) {
          return;
        }

        // create schema
        const schema = validate(rules);
        const fn = () => ({
          [key]: rules.object(schema),
        });

        // @ts-ignore we know validate might exist here
        let validateConfig = config['validate'];

        // pass it to validation array
        if (Array.isArray(validateConfig)) {
          validateConfig = [...validateConfig, fn];
        } else {
          validateConfig = [fn];
        }

        // @ts-ignore
        // update config
        config['validate'] = validateConfig;
      });

      return config;
    },
  });
};

export * from './resolver';
export * from './error';
export { ValidationError };
