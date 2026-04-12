import { expect, test } from '@playwright/test';

test('Auth form can switch from sign-in to sign-up', async ({ page }) => {
  await page.goto('/sign-in');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('Auth form can open recovery views', async ({ page }) => {
  await page.goto('/sign-in');

  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByRole('button', { name: 'Sign in with magic link' }).click();
  await expect(page.getByRole('heading', { name: 'Magic link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
});

test('Verified page shows session status messaging', async ({ page }) => {
  await page.goto('/verified');

  await expect(page.getByRole('heading', { name: 'Vaja AI verified your email' })).toBeVisible();
  await expect(page.getByText(/Attempt \d+\/10/)).toBeVisible();
});
