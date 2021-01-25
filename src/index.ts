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
  bindings: ['ValidateResolver'],
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
    // @ts-ignore requires: https://github.com/graphql-nexus/nexus/pull/799
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
        let schema = validate(rules);

        // @ts-ignore
        // create a nested schema for this arg
        config['validate'] = () => ({
          [key]: rules.object(schema),
        });
      });

      return config;
    },
  });
};

export * from './resolver';
export * from './error';
export { ValidationError };
