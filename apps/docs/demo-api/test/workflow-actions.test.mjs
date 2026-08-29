import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/workflow-actions';

function getRegion(query = '') {
  return handleDemoApi(new Request(`${BASE}/region${query}`, { headers: { 'HX-Request': 'true' } }));
}

function transition(params) {
  return handleDemoApi(
    new Request(`${BASE}/transition`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }),
  );
}

const SUBMITTED = [['state', 'submitted'], ['version', '7']];

describe('workflow-actions demo API', () => {
  it('renders the submitted region: version, current step, legal actions only', async () => {
    const response = await getRegion();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-hc-workflow');
    expect(body).toContain('name="version" value="7"');
    expect(body).toContain('aria-current="step"');
    expect(body).toContain('value="approve"');
    expect(body).toContain('value="return"');
    expect(body).not.toContain('value="resubmit"');
  });

  it('approve applies: new state, bumped version, next action set, toast', async () => {
    const response = await transition([...SUBMITTED, ['transition', 'approve']]);
    expect(response.status).toBe(200);
    expect(response.headers.get('HX-Trigger')).toContain('hc:toast');
    const body = await response.text();
    expect(body).toContain('name="version" value="8"');
    expect(body).toContain('name="state" value="approved"');
    expect(body).not.toContain('value="approve"');
  });

  it('return without a comment 422s into the comment-required shape, version untouched', async () => {
    const response = await transition([...SUBMITTED, ['transition', 'return']]);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('name="comment"');
    expect(body).toContain('required');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('name="version" value="7"');
  });

  it('return with a comment applies into returned, whose only action is resubmit', async () => {
    const body = await (
      await transition([...SUBMITTED, ['transition', 'return'], ['comment', 'Wrong cost centre']])
    ).text();
    expect(body).toContain('name="state" value="returned"');
    expect(body).toContain('value="resubmit"');
    expect(body).not.toContain('value="approve"');
  });

  it('a lost race 409s with the region from current truth and a who-won explanation', async () => {
    const response = await transition([...SUBMITTED, ['transition', 'approve'], ['race', '1']]);
    expect(response.status).toBe(409);
    expect(response.headers.get('HX-Trigger')).toContain('hc:toast');
    const body = await response.text();
    expect(body).toContain('name="state" value="approved"');
    expect(body).toContain('name="version" value="9"');
    expect(body).toContain('Your action was not applied');
    expect(body).toContain('role="status"');
  });

  it('an illegal transition (double-click racing itself) 409s from current truth', async () => {
    const response = await transition([
      ['state', 'approved'], ['version', '9'], ['transition', 'approve'],
    ]);
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).toContain('not available in the current state');
    expect(body).toContain('name="state" value="approved"');
  });

  it('answers no-JS requests with a full page', async () => {
    const response = await handleDemoApi(new Request(`${BASE}/region`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});
