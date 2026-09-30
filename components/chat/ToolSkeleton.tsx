import { Icon, type IconName } from './icons';

const LABEL: Record<string, [IconName, string]> = {
  searchFlights: ['plane', 'Searching flights…'],
  searchTrains: ['train', 'Checking trains…'],
  searchBuses: ['bus', 'Comparing buses…'],
  searchHotels: ['bed', 'Finding hotels…'],
  getWeather: ['sun', 'Checking the weather…'],
  getCabHandoff: ['car', 'Pricing local rides…'],
  estimateBudget: ['wallet', 'Totting up the budget…'],
};

export function ToolSkeleton({ name }: { name: string }) {
  const [icon, label] = LABEL[name] ?? ['info', 'Working on it…'];
  return (
    <div className="card skel" role="status">
      <div className="card-h">
        <span className="card-i"><Icon name={icon} /></span>
        <span className="skel-label">{label}</span>
      </div>
      <div className="card-b" aria-hidden="true">
        <span className="shimmer w70" /><span className="shimmer w45" /><span className="shimmer w60" />
      </div>
    </div>
  );
}
