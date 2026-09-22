/**
 * Client-side Artist Note Translation Service
 * 
 * Re-exports translation functions from aiService.ts for seamless modularity.
 */

export {
  translateArtistNoteWithGemini,
  translateArtistNote,
  translateArtistNote as requestArtistNoteTranslation,
} from './aiService';
