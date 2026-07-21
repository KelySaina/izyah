import { test, expect } from '@playwright/test';

// Self-contained: the API is mocked so no backend is required.
const FAKE_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  displayName: 'Guest',
  avatar: '#7C3AED',
  createdAt: '2030-01-01T00:00:00.000Z',
  lastSeenAt: '2030-01-01T00:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  // Identity bootstrap + refresh.
  await page.route('**/api/users**', (route) => route.fulfill({ json: FAKE_USER }));
  // Any event listing.
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: [] } }));
});

test('home loads and can navigate to create', async ({ page }) => {
  await page.goto('/');

  // Brand is visible once identity has bootstrapped.
  await expect(page.getByText("Izy'Ah").first()).toBeVisible();

  // The create control (bottom-nav FAB) navigates to /create.
  await page.getByRole('link', { name: 'Create event' }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole('heading', { name: 'Create event' })).toBeVisible();
});
