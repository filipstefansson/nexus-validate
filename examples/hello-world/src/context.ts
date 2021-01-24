export interface Context {
  secret: string;
}

export function createContext(): Context {
  return { secret: 'nexus' };
}
