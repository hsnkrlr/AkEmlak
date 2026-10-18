import { Link } from 'react-router-dom';
import { formatLocation, formatPrice, soldLabel } from '../lib/format';
import { CATEGORY_LABEL, DEAL_LABEL, type Listing } from '../types';
import { IconArea, IconCamera, IconPin, IconRooms } from './Icons';
import { Photo } from './Photo';

export function ListingCard({ listing: l, to }: { listing: Listing; to?: string }) {
  const sold = l.status === 'satildi';
  const area = l.netM2 ?? l.grossM2;
  return (
    <Link to={to ?? `/detay/${l.slug}`} className={`card ${sold ? 'is-sold' : ''}`}>
      <div className="card-media">
        <Photo name={l.images[0]} thumb alt={l.title} category={l.category} />
        <div className="card-badges">
          <span className={`badge badge-${l.dealType}`}>{DEAL_LABEL[l.dealType]}</span>
          {l.featured && !sold && <span className="badge badge-featured">Fırsat</span>}
        </div>
        {l.images.length > 1 && (
          <span className="card-count">
            <IconCamera width={14} height={14} /> {l.images.length}
          </span>
        )}
        {sold && <span className="sold-ribbon">{soldLabel(l)}</span>}
      </div>
      <div className="card-body">
        <div className="card-price">{formatPrice(l)}</div>
        <h3 className="card-title">{l.title}</h3>
        <p className="card-loc">
          <IconPin width={16} height={16} /> {formatLocation(l)}
        </p>
        <ul className="card-facts">
          <li>{CATEGORY_LABEL[l.category]}</li>
          {l.rooms && (
            <li>
              <IconRooms width={15} height={15} /> {l.rooms}
            </li>
          )}
          {area && (
            <li>
              <IconArea width={15} height={15} /> {area} m²
            </li>
          )}
        </ul>
      </div>
    </Link>
  );
}
