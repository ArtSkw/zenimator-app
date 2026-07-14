import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/** Prior defaults that should follow the current DEFAULT_MODEL when the user
 *  never picked a custom model — so an app-wide upgrade reaches existing users
 *  without clobbering a deliberate override. */
const SUPERSEDED_DEFAULTS = new Set(['claude-sonnet-4-6']);

type SettingsState = {
  apiKey: string;
  model: string;
  /** Engine service base URL. Empty = use the built-in default (VITE_STUDIO_AGENT_URL
   *  or localhost). Set this to point the app at a hosted/tunnelled engine. */
  agentUrl: string;
  /** Bearer token for a remote engine (STUDIO_AGENT_TOKEN on the service). Never
   *  baked into the build — entered here at runtime, since the app ships public. */
  agentToken: string;

  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setAgentUrl: (url: string) => void;
  setAgentToken: (token: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      model: DEFAULT_MODEL,
      agentUrl: '',
      agentToken: '',

      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setAgentUrl: (agentUrl) => set({ agentUrl: agentUrl.trim().replace(/\/+$/, '') }),
      setAgentToken: (agentToken) => set({ agentToken: agentToken.trim() }),
    }),
    {
      name: 'zenimator.settings',
      version: 1,
      // The API key is OPTIONAL — it powers only background project-title
      // naming (generation/edit run on the local `claude` login, never this
      // key). It persists in this localStorage slot, readable by same-origin
      // scripts; acceptable for a local single-user tool. Clearing it in
      // Settings wipes it. Hosted phases (v3.0) move key handling server-side.
      partialize: (s) => ({
        apiKey: s.apiKey,
        model: s.model,
        agentUrl: s.agentUrl,
        agentToken: s.agentToken,
      }),
      // Carry users forward off a superseded default onto the new one. A model
      // they explicitly chose (anything not in SUPERSEDED_DEFAULTS) is kept.
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (!s.model || SUPERSEDED_DEFAULTS.has(s.model)) s.model = DEFAULT_MODEL;
        return s as SettingsState;
      },
    },
  ),
);
