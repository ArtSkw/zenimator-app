import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** Per-turn reasoning depth for the engine. 'medium' is Opus 5.5's own default
 *  and its quality/speed sweet spot — it still runs the full verification loop;
 *  'low' goes faster, 'high'/'xhigh'/'max' go deeper for hero scenes. */
export const DEFAULT_EFFORT = 'medium';
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

/** Prior defaults that should follow the current DEFAULT_MODEL when the user
 *  never picked a custom model — so an app-wide upgrade reaches existing users
 *  without clobbering a deliberate override. */
const SUPERSEDED_DEFAULTS = new Set(['claude-sonnet-4-6', 'claude-sonnet-5']);

type SettingsState = {
  model: string;
  /** Per-turn reasoning depth passed to the engine (see DEFAULT_EFFORT). */
  effort: Effort;
  /** Engine service base URL. Empty = use the built-in default (VITE_STUDIO_AGENT_URL
   *  or localhost). Set this to point the app at a hosted/tunnelled engine. */
  agentUrl: string;
  /** Bearer token for a remote engine (STUDIO_AGENT_TOKEN on the service). Never
   *  baked into the build — entered here at runtime, since the app ships public. */
  agentToken: string;

  setModel: (model: string) => void;
  setEffort: (effort: Effort) => void;
  setAgentUrl: (url: string) => void;
  setAgentToken: (token: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: DEFAULT_MODEL,
      effort: DEFAULT_EFFORT,
      agentUrl: '',
      agentToken: '',

      setModel: (model) => set({ model }),
      setEffort: (effort) => set({ effort }),
      setAgentUrl: (agentUrl) => set({ agentUrl: agentUrl.trim().replace(/\/+$/, '') }),
      setAgentToken: (agentToken) => set({ agentToken: agentToken.trim() }),
    }),
    {
      name: 'zenimator.settings',
      version: 2,
      partialize: (s) => ({
        model: s.model,
        effort: s.effort,
        agentUrl: s.agentUrl,
        agentToken: s.agentToken,
      }),
      // Carry users forward off a superseded default onto the new one. A model
      // they explicitly chose (anything not in SUPERSEDED_DEFAULTS) is kept.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (!s.model || SUPERSEDED_DEFAULTS.has(s.model)) s.model = DEFAULT_MODEL;
        // v2: effort default moved high → medium alongside the Opus 5.5 switch.
        if (version < 2 && s.effort === 'high') s.effort = DEFAULT_EFFORT;
        if (!s.effort || !EFFORT_LEVELS.includes(s.effort)) s.effort = DEFAULT_EFFORT;
        return s as SettingsState;
      },
    },
  ),
);
