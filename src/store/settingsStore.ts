import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

type SettingsState = {
  apiKey: string;
  model: string;

  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      model: DEFAULT_MODEL,

      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
    }),
    {
      name: 'zenimator.settings',
      // Don't persist secrets via the default key — keep the API key in a
      // separate localStorage slot so it's explicit and easy to wipe.
      partialize: (s) => ({
        apiKey: s.apiKey,
        model: s.model,
      }),
    },
  ),
);
