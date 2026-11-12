import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', () => 'Hello from Precedent!');

export const handler = resolver.getDefinitions();
