import { Annotation } from '@langchain/langgraph';

export const HarnessStateAnnotation = Annotation.Root({
  userId: Annotation({ reducer: (_, b) => b }),
  characterId: Annotation({ reducer: (_, b) => b }),
  actionText: Annotation({ reducer: (_, b) => b }),
  actionMode: Annotation({ reducer: (_, b) => b, default: () => 'story' }),
  history: Annotation({ reducer: (_, b) => b, default: () => [] }),
  character: Annotation({ reducer: (_, b) => b }),
  party: Annotation({ reducer: (_, b) => b, default: () => null }),
  nearbyNpcs: Annotation({ reducer: (_, b) => b, default: () => [] }),
  targetNpc: Annotation({ reducer: (_, b) => b, default: () => null }),
  isTargetNone: Annotation({ reducer: (_, b) => b, default: () => false }),
  messages: Annotation({
    reducer: (curr, update) => curr.concat(update),
    default: () => []
  }),
  iterationCount: Annotation({
    reducer: (curr, update) => (typeof update === 'number' ? update : curr + 1),
    default: () => 0
  }),
  finalStory: Annotation({ reducer: (_, b) => b, default: () => '' }),
  encounter: Annotation({ reducer: (_, b) => b, default: () => null }),
  isMetaJailbreak: Annotation({ reducer: (_, b) => b, default: () => false }),
  isFallback: Annotation({ reducer: (_, b) => b, default: () => false }),
  modelName: Annotation({ reducer: (_, b) => b, default: () => '' }),
  trace: Annotation({
    reducer: (curr, update) => {
      if (!update) return curr;
      return {
        ...curr,
        ...update,
        steps: (curr?.steps || []).concat(update.steps || [])
      };
    },
    default: () => ({
      startTime: Date.now(),
      steps: [],
      failedStep: null,
      failedMessage: null,
      iterationFailed: null
    })
  })
});

// ============================================================================
