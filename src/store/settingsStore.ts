import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

type SettingsState = {
  apiKey: string;
  model: string;
  useLlmGrouping: boolean;
  showRationale: boolean;

  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setUseLlmGrouping: (v: boolean) => void;
  setShowRationale: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      model: DEFAULT_MODEL,
      useLlmGrouping: true,
      showRationale: true,

      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setUseLlmGrouping: (useLlmGrouping) => set({ useLlmGrouping }),
      setShowRationale: (showRationale) => set({ showRationale }),
    }),
    {
      name: 'zenimator.settings',
      // Don't persist secrets via the default key — keep the API key in a
      // separate localStorage slot so it's explicit and easy to wipe.
      partialize: (s) => ({
        apiKey: s.apiKey,
        model: s.model,
        useLlmGrouping: s.useLlmGrouping,
        showRationale: s.showRationale,
      }),
    },
  ),
);
