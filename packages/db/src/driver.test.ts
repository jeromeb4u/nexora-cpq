import { describe, expect, it } from 'vitest';

import { driverFor } from './driver';

describe('database driver selection', () => {
  it('uses the Neon serverless driver for Neon hosts', () => {
    expect(
      driverFor('postgresql://u:p@ep-cool-name-123-pooler.c-5.eu-central-1.aws.neon.tech/db?sslmode=require'),
    ).toBe('neon');
  });

  it('uses node-postgres for an ordinary Postgres server', () => {
    expect(driverFor('postgresql://postgres:postgres@localhost:5432/nexora_test')).toBe('pg');
    expect(driverFor('postgresql://u:p@db.internal.example.com:5432/app')).toBe('pg');
  });

  it('does not treat a look-alike host as Neon', () => {
    // A suffix match without the dot boundary would misroute this.
    expect(driverFor('postgresql://u:p@notneon.tech/db')).toBe('pg');
    expect(driverFor('postgresql://u:p@neon.tech.attacker.example/db')).toBe('pg');
  });

  it('falls back to node-postgres for an unparseable string', () => {
    expect(driverFor('not a url')).toBe('pg');
  });
});
