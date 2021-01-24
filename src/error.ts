import { GetGen } from 'nexus/dist/core';
import { ValidationError } from 'yup';

export interface ValidatePluginErrorConfig {
  error: Error | ValidationError;
  args: any;
  ctx: GetGen<'context'>;
}

export class UserInputError extends Error {
  extensions: {
    invalidArgs: string[];
    code: string;
  };

  constructor(
    message: string,
    extensions: {
      invalidArgs: string[];
      code?: string;
    }
  ) {
    super(message);
    this.extensions = {
      ...extensions,
      code: extensions.code || 'BAD_USER_INPUT',
    };
  }
}

export const defaultFormatError = ({
  error,
}: ValidatePluginErrorConfig): Error => {
  if (error instanceof ValidationError) {
    return new UserInputError(error.message, {
      invalidArgs: error.path ? [error.path] : [],
    });
  }

  return error;
};

export { ValidationError };
