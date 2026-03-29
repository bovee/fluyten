import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import '../i18n';
import { setupAudioMocks } from './audioMocks';
import { useStore } from '../store';

setupAudioMocks();

// Default to onboarded so the OnboardingDialog doesn't block tests that
// aren't specifically testing the onboarding flow.
beforeEach(() => {
  useStore.setState({ onboarded: true });
});

afterEach(() => {
  // Cleanup after each test
});
