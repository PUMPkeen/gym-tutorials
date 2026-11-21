import { useRoute } from './lib/router';
import { Library } from './screens/Library';
import { ClipForm } from './screens/ClipForm';
import { WorkoutDeck } from './screens/WorkoutDeck';
import { Settings } from './screens/Settings';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'add':
      return <ClipForm mode={{ kind: 'add' }} />;
    case 'edit':
      return <ClipForm key={route.id} mode={{ kind: 'edit', id: route.id }} />;
    case 'workout':
      return <WorkoutDeck />;
    case 'settings':
      return <Settings />;
    default:
      return <Library />;
  }
}
