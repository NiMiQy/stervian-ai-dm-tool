import { initialiseGame } from './containers/gameContainer.js';
import { initialiseGameScreenLayout } from './components/gameScreenLayout.js';

initialiseGameScreenLayout();
await initialiseGame();
